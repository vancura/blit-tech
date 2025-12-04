import type { BitmapFont } from '../assets/BitmapFont';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';

/**
 * WebGPU renderer for Blit–Tech.
 * Handles all drawing operations including primitives (lines, rects) and sprites.
 * Uses batched rendering for performance - vertices are accumulated and drawn at frame end.
 */
export class Renderer {
    private device: GPUDevice;
    private context: GPUCanvasContext;
    private displaySize: Vector2i;

    // Primitive rendering (colored quads/lines)
    private primitivePipeline: GPURenderPipeline | null = null;
    private primitiveUniformBuffer: GPUBuffer | null = null;
    private primitiveBindGroup: GPUBindGroup | null = null;
    private primitiveVertices: Float32Array;
    private primitiveVertexBuffer: GPUBuffer | null = null;
    private primitiveVertexCount: number = 0;
    private maxPrimitiveVertices: number = 100000; // 100k vertices

    // Sprite rendering (textured quads)
    private spritePipeline: GPURenderPipeline | null = null;
    private spriteUniformBuffer: GPUBuffer | null = null;
    private spriteSampler: GPUSampler | null = null;
    private spriteVertices: Float32Array;
    private spriteVertexBuffer: GPUBuffer | null = null;
    private spriteVertexCount: number = 0;
    private maxSpriteVertices: number = 50000; // 50k vertices
    private currentTexture: GPUTexture | null = null;
    private currentBindGroup: GPUBindGroup | null = null;
    private textureBindGroups: Map<GPUTexture, GPUBindGroup> = new Map();

    // Sprite batch queue for multi-texture support
    private spriteBatches: Array<{ bindGroup: GPUBindGroup; vertexStart: number; vertexCount: number }> = [];
    private totalSpriteVertices: number = 0;

    // Current state
    private currentClearColor: Color32 = Color32.black();
    private cameraOffset: Vector2i = Vector2i.zero();

    /**
     * Creates a new renderer instance.
     * Call initialize() before using.
     * @param device - WebGPU device for GPU operations.
     * @param context - WebGPU canvas context for presenting frames.
     * @param displaySize - Render target resolution in pixels.
     */
    constructor(device: GPUDevice, context: GPUCanvasContext, displaySize: Vector2i) {
        this.device = device;
        this.context = context;
        this.displaySize = displaySize;

        // Primitives: 6 floats per vertex (x, y, r, g, b, a)
        this.primitiveVertices = new Float32Array(this.maxPrimitiveVertices * 6);

        // Sprites: 8 floats per vertex (x, y, u, v, r, g, b, a)
        this.spriteVertices = new Float32Array(this.maxSpriteVertices * 8);
    }

    /**
     * Initializes GPU resources: pipelines, buffers, and samplers.
     * Must be called before any rendering operations.
     * @returns Promise resolving to true if initialization succeeded.
     */
    async initialize(): Promise<boolean> {
        try {
            await this.createPrimitivePipeline();
            await this.createSpritePipeline();
            await this.createBuffers();
            return true;
        } catch (error) {
            console.error('[Renderer] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Creates the WGSL shader and render pipeline for colored primitives.
     * Vertices contain position (2D) and color (RGBA).
     */
    private async createPrimitivePipeline(): Promise<void> {
        const shaderModule = this.device.createShaderModule({
            label: 'Primitive Shader',
            code: `
                struct VertexInput {
                    @location(0) position: vec2<f32>,
                    @location(1) color: vec4<f32>,
                }

                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec4<f32>,
                }

                struct Uniforms {
                    resolution: vec2<f32>,
                }

                @group(0) @binding(0) var<uniform> uniforms: Uniforms;

                @vertex
                fn vs_main(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;

                    // Convert from pixel coordinates to clip space (-1 to 1)
                    let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
                    let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;

                    output.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
                    output.color = input.color;

                    return output;
                }

                @fragment
                fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
                    return input.color;
                }
            `,
        });

        this.primitivePipeline = this.device.createRenderPipeline({
            label: 'Primitive Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 6 * 4, // 6 floats * 4 bytes
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
                            { shaderLocation: 1, offset: 2 * 4, format: 'float32x4' }, // color
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat(),
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        },
                    },
                ],
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
        });
    }

    /**
     * Creates the WGSL shader and render pipeline for textured sprites.
     * Vertices contain position, UV coordinates, and tint color.
     */
    private async createSpritePipeline(): Promise<void> {
        const shaderModule = this.device.createShaderModule({
            label: 'Sprite Shader',
            code: `
                struct VertexInput {
                    @location(0) position: vec2<f32>,
                    @location(1) uv: vec2<f32>,
                    @location(2) color: vec4<f32>,
                }

                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) uv: vec2<f32>,
                    @location(1) color: vec4<f32>,
                }

                struct Uniforms {
                    resolution: vec2<f32>,
                }

                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                @group(0) @binding(1) var texSampler: sampler;
                @group(0) @binding(2) var texture: texture_2d<f32>;

                @vertex
                fn vs_main(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;

                    let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
                    let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;

                    output.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
                    output.uv = input.uv;
                    output.color = input.color;

                    return output;
                }

                @fragment
                fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
                    let texColor = textureSample(texture, texSampler, input.uv);
                    return texColor * input.color;
                }
            `,
        });

        this.spritePipeline = this.device.createRenderPipeline({
            label: 'Sprite Pipeline',
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 8 * 4, // 8 floats * 4 bytes
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
                            { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' }, // uv
                            { shaderLocation: 2, offset: 4 * 4, format: 'float32x4' }, // color
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: navigator.gpu.getPreferredCanvasFormat(),
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        },
                    },
                ],
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
        });
    }

    /**
     * Creates GPU buffers for uniforms (resolution) and vertices.
     * Also creates the texture sampler for sprite rendering.
     */
    private async createBuffers(): Promise<void> {
        // Primitive uniform buffer
        this.primitiveUniformBuffer = this.device.createBuffer({
            label: 'Primitive Uniform Buffer',
            size: 8, // vec2
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(
            this.primitiveUniformBuffer,
            0,
            new Float32Array([this.displaySize.x, this.displaySize.y]),
        );

        // Safe assertion: createPrimitivePipeline is called before createBuffers
        const primitivePipelineLayout = (this.primitivePipeline as GPURenderPipeline).getBindGroupLayout(0);
        this.primitiveBindGroup = this.device.createBindGroup({
            label: 'Primitive Bind Group',
            layout: primitivePipelineLayout,
            entries: [{ binding: 0, resource: { buffer: this.primitiveUniformBuffer } }],
        });

        this.primitiveVertexBuffer = this.device.createBuffer({
            label: 'Primitive Vertex Buffer',
            size: this.primitiveVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Sprite uniform buffer
        this.spriteUniformBuffer = this.device.createBuffer({
            label: 'Sprite Uniform Buffer',
            size: 8, // vec2
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(
            this.spriteUniformBuffer,
            0,
            new Float32Array([this.displaySize.x, this.displaySize.y]),
        );

        this.spriteVertexBuffer = this.device.createBuffer({
            label: 'Sprite Vertex Buffer',
            size: this.spriteVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Create sampler for sprites (nearest-neighbor for pixel-perfect rendering)
        this.spriteSampler = this.device.createSampler({
            label: 'Sprite Sampler',
            magFilter: 'nearest', // Pixel-perfect rendering
            minFilter: 'nearest',
            mipmapFilter: 'nearest',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
    }

    /**
     * Begins a new render frame.
     * Resets all frame state including vertex counts, sprite batches, and texture bindings.
     * Safe to call multiple times - defensively resets all state to prevent corruption.
     */
    beginFrame(): void {
        this.primitiveVertexCount = 0;
        this.spriteVertexCount = 0;
        this.totalSpriteVertices = 0;
        this.spriteBatches = [];
        this.currentTexture = null;
        this.currentBindGroup = null;
    }

    /**
     * Sets the background clear color for this frame.
     * @param color - Color to clear the screen with.
     */
    setClearColor(color: Color32): void {
        this.currentClearColor = color.clone();
    }

    // ========================================================================
    // PRIMITIVE DRAWING (Colored shapes)
    // ========================================================================

    /**
     * Draws a filled rectangle using two triangles.
     * @param rect - Rectangle bounds in pixel coordinates.
     * @param color - Fill color.
     */
    drawRectFill(rect: Rect2i, color: Color32): void {
        const x0 = rect.x;
        const y0 = rect.y;
        const x1 = rect.x + rect.width;
        const y1 = rect.y + rect.height;

        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const a = color.a / 255;

        this.addPrimitiveVertex(x0, y0, r, g, b, a);
        this.addPrimitiveVertex(x1, y0, r, g, b, a);
        this.addPrimitiveVertex(x0, y1, r, g, b, a);

        this.addPrimitiveVertex(x1, y0, r, g, b, a);
        this.addPrimitiveVertex(x1, y1, r, g, b, a);
        this.addPrimitiveVertex(x0, y1, r, g, b, a);
    }

    /**
     * Draws placeholder text as colored blocks.
     * Each character is rendered as a small filled rectangle.
     * @param pos - Text position (top-left corner).
     * @param color - Text color.
     * @param text - String to display.
     */
    drawText(pos: Vector2i, color: Color32, text: string): void {
        const charWidth = 6;
        const charHeight = 8;

        for (let i = 0; i < text.length; i++) {
            const x = pos.x + i * charWidth;
            this.drawRectFill(new Rect2i(x, pos.y, charWidth - 1, charHeight), color);
        }
    }

    /**
     * Draws a single pixel as a 1x1 filled rectangle.
     * @param pos - Pixel position.
     * @param color - Pixel color.
     */
    drawPixel(pos: Vector2i, color: Color32): void {
        this.drawRectFill(new Rect2i(pos.x, pos.y, 1, 1), color);
    }

    /**
     * Draws a line using Bresenham's line algorithm.
     * Produces pixel-perfect lines without anti-aliasing.
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Line color.
     */
    drawLine(p0: Vector2i, p1: Vector2i, color: Color32): void {
        let x0 = Math.floor(p0.x);
        let y0 = Math.floor(p0.y);
        const x1 = Math.floor(p1.x);
        const y1 = Math.floor(p1.y);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.drawPixel(new Vector2i(x0, y0), color);
            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    /**
     * Draws a rectangle outline using four lines.
     * @param rect - Rectangle bounds.
     * @param color - Outline color.
     */
    drawRect(rect: Rect2i, color: Color32): void {
        const x0 = rect.x;
        const y0 = rect.y;
        const x1 = rect.x + rect.width - 1;
        const y1 = rect.y + rect.height - 1;

        this.drawLine(new Vector2i(x0, y0), new Vector2i(x1, y0), color);
        this.drawLine(new Vector2i(x1, y0), new Vector2i(x1, y1), color);
        this.drawLine(new Vector2i(x1, y1), new Vector2i(x0, y1), color);
        this.drawLine(new Vector2i(x0, y1), new Vector2i(x0, y0), color);
    }

    /**
     * Fills a rectangular region with a solid color.
     * Alias for drawRectFill for API consistency.
     * @param color - Fill color.
     * @param rect - Region to fill.
     */
    clearRect(color: Color32, rect: Rect2i): void {
        this.drawRectFill(rect, color);
    }

    /**
     * Adds a single vertex to the primitive batch.
     * Flushes the batch if buffer is full.
     * @param x - X position in pixels.
     * @param y - Y position in pixels.
     * @param r - Red component (0-1).
     * @param g - Green component (0-1).
     * @param b - Blue component (0-1).
     * @param a - Alpha component (0-1).
     * @returns Nothing.
     */
    private addPrimitiveVertex(x: number, y: number, r: number, g: number, b: number, a: number): void {
        const index = this.primitiveVertexCount * 6;

        if (index + 6 > this.primitiveVertices.length) {
            console.warn('[Renderer] Primitive buffer full, flushing early');
            this.flushPrimitives();
            return this.addPrimitiveVertex(x, y, r, g, b, a);
        }

        this.primitiveVertices[index + 0] = x - this.cameraOffset.x;
        this.primitiveVertices[index + 1] = y - this.cameraOffset.y;
        this.primitiveVertices[index + 2] = r;
        this.primitiveVertices[index + 3] = g;
        this.primitiveVertices[index + 4] = b;
        this.primitiveVertices[index + 5] = a;

        this.primitiveVertexCount++;
    }

    // ========================================================================
    // SPRITE DRAWING (Textured quads)
    // ========================================================================

    /**
     * Draws a sprite region from a sprite sheet.
     * @param spriteSheet - Source sprite sheet.
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw at.
     * @param tint - Tint color multiplied with texture (defaults to white).
     */
    drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint: Color32 = Color32.white()): void {
        const texture = spriteSheet.getTexture(this.device);
        const uvs = spriteSheet.getUVs(srcRect);

        this.drawTexturedQuad(
            texture,
            destPos,
            new Vector2i(srcRect.width, srcRect.height),
            uvs.u0,
            uvs.v0,
            uvs.u1,
            uvs.v1,
            tint,
        );
    }

    /**
     * Draws text using a bitmap font.
     * Renders each character as a textured sprite.
     * @param font - Bitmap font with character glyphs.
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param color - Text color multiplied with font texture.
     */
    drawBitmapText(font: BitmapFont, pos: Vector2i, text: string, color: Color32 = Color32.white()): void {
        const spriteSheet = font.getSpriteSheet();
        let cursorX = pos.x;

        for (const char of text) {
            const glyph = font.getGlyph(char);

            if (glyph) {
                const drawPos = new Vector2i(cursorX + glyph.offsetX, pos.y + glyph.offsetY);
                this.drawSprite(spriteSheet, glyph.rect, drawPos, color);
                cursorX += glyph.advance;
            }
        }
    }

    /**
     * Checks if there's enough buffer space for a complete quad (6 vertices).
     * @returns True if a quad can be added without splitting.
     */
    private hasSpaceForQuad(): boolean {
        const index = (this.totalSpriteVertices + this.spriteVertexCount) * 8;
        const quadSize = 6 * 8; // 6 vertices * 8 floats per vertex
        return index + quadSize <= this.spriteVertices.length;
    }

    /**
     * Draws a textured quad (two triangles) to the screen.
     * Handles texture switching and batch flushing.
     * Ensures complete quads are added atomically to prevent partial geometry.
     * @param texture - GPU texture to sample from.
     * @param pos - Screen position (top-left corner).
     * @param size - Quad dimensions in pixels.
     * @param u0 - Left UV coordinate (0-1).
     * @param v0 - Top UV coordinate (0-1).
     * @param u1 - Right UV coordinate (0-1).
     * @param v1 - Bottom UV coordinate (0-1).
     * @param tint - Color to multiply with texture.
     */
    private drawTexturedQuad(
        texture: GPUTexture,
        pos: Vector2i,
        size: Vector2i,
        u0: number,
        v0: number,
        u1: number,
        v1: number,
        tint: Color32,
    ): void {
        // Flush if switching textures
        if (this.currentTexture !== texture) {
            if (this.spriteVertexCount > 0) {
                this.flushSprites();
            }
            this.currentTexture = texture;
            this.currentBindGroup = this.getOrCreateBindGroup(texture);
        }

        // Ensure we have space for a complete quad (6 vertices) before adding any
        // This prevents partial quads that would cause rendering corruption
        if (!this.hasSpaceForQuad()) {
            if (this.spriteVertexCount > 0) {
                this.flushSprites();
            }
            // Check again after flush - if still no space, buffer is full for this frame
            if (!this.hasSpaceForQuad()) {
                console.warn('[Renderer] Sprite buffer capacity exceeded for this frame, quad dropped');
                return;
            }
        }

        const x0 = pos.x;
        const y0 = pos.y;
        const x1 = pos.x + size.x;
        const y1 = pos.y + size.y;

        const r = tint.r / 255;
        const g = tint.g / 255;
        const b = tint.b / 255;
        const a = tint.a / 255;

        // Triangle 1
        this.addSpriteVertex(x0, y0, u0, v0, r, g, b, a);
        this.addSpriteVertex(x1, y0, u1, v0, r, g, b, a);
        this.addSpriteVertex(x0, y1, u0, v1, r, g, b, a);

        // Triangle 2
        this.addSpriteVertex(x1, y0, u1, v0, r, g, b, a);
        this.addSpriteVertex(x1, y1, u1, v1, r, g, b, a);
        this.addSpriteVertex(x0, y1, u0, v1, r, g, b, a);
    }

    /**
     * Adds a sprite vertex to the batch.
     * Assumes buffer space was pre-checked via hasSpaceForQuad() in drawTexturedQuad().
     * @param x - X position in pixels.
     * @param y - Y position in pixels.
     * @param u - U texture coordinate.
     * @param v - V texture coordinate.
     * @param r - Red tint (0-1).
     * @param g - Green tint (0-1).
     * @param b - Blue tint (0-1).
     * @param a - Alpha (0-1).
     */
    private addSpriteVertex(
        x: number,
        y: number,
        u: number,
        v: number,
        r: number,
        g: number,
        b: number,
        a: number,
    ): void {
        // Use total vertices (across all batches) + current batch count for the index
        const index = (this.totalSpriteVertices + this.spriteVertexCount) * 8;

        this.spriteVertices[index + 0] = x - this.cameraOffset.x;
        this.spriteVertices[index + 1] = y - this.cameraOffset.y;
        this.spriteVertices[index + 2] = u;
        this.spriteVertices[index + 3] = v;
        this.spriteVertices[index + 4] = r;
        this.spriteVertices[index + 5] = g;
        this.spriteVertices[index + 6] = b;
        this.spriteVertices[index + 7] = a;

        this.spriteVertexCount++;
    }

    /**
     * Gets or creates a bind group for a texture.
     * Bind groups are cached for reuse.
     * @param texture - GPU texture to create bind group for.
     * @returns Bind group containing uniform buffer, sampler, and texture.
     */
    private getOrCreateBindGroup(texture: GPUTexture): GPUBindGroup {
        const existingBindGroup = this.textureBindGroups.get(texture);
        if (existingBindGroup) {
            return existingBindGroup;
        }

        // Safe assertions: these resources are created in initialize() before any drawing
        const bindGroup = this.device.createBindGroup({
            label: 'Sprite Bind Group',
            layout: (this.spritePipeline as GPURenderPipeline).getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.spriteUniformBuffer as GPUBuffer } },
                { binding: 1, resource: this.spriteSampler as GPUSampler },
                { binding: 2, resource: texture.createView() },
            ],
        });
        this.textureBindGroups.set(texture, bindGroup);
        return bindGroup;
    }

    // ========================================================================
    // CAMERA
    // ========================================================================

    /**
     * Sets the camera offset for scrolling.
     * All drawing operations are offset by this amount.
     * @param offset - Camera position in pixels.
     */
    setCameraOffset(offset: Vector2i): void {
        this.cameraOffset = offset.clone();
    }

    /**
     * Gets the current camera offset.
     * @returns Copy of the current camera position.
     */
    getCameraOffset(): Vector2i {
        return this.cameraOffset.clone();
    }

    /**
     * Resets the camera to the origin (0, 0).
     */
    resetCamera(): void {
        this.cameraOffset = Vector2i.zero();
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    /**
     * Uploads primitive vertices to the GPU and resets the batch.
     * Called automatically when buffer is full or frame ends.
     */
    private flushPrimitives(): void {
        if (this.primitiveVertexCount === 0) return;

        // Safe assertion: primitiveVertexBuffer is created in initialize()
        this.device.queue.writeBuffer(
            this.primitiveVertexBuffer as GPUBuffer,
            0,
            this.primitiveVertices.buffer,
            0,
            this.primitiveVertexCount * 6 * 4,
        );

        this.primitiveVertexCount = 0;
    }

    /**
     * Saves the current sprite batch and prepares for a new texture.
     * Called automatically when texture changes.
     */
    private flushSprites(): void {
        if (this.spriteVertexCount === 0 || !this.currentBindGroup) return;

        // Save this batch for rendering at endFrame
        this.spriteBatches.push({
            bindGroup: this.currentBindGroup,
            vertexStart: this.totalSpriteVertices,
            vertexCount: this.spriteVertexCount,
        });

        this.totalSpriteVertices += this.spriteVertexCount;
        this.spriteVertexCount = 0;
    }

    /**
     * Ends the current frame and presents to screen.
     * Uploads all batched vertices, executes render passes, and submits to GPU.
     */
    endFrame(): void {
        // Flush any remaining sprite vertices to the batch queue
        if (this.spriteVertexCount > 0 && this.currentBindGroup) {
            this.spriteBatches.push({
                bindGroup: this.currentBindGroup,
                vertexStart: this.totalSpriteVertices,
                vertexCount: this.spriteVertexCount,
            });
            this.totalSpriteVertices += this.spriteVertexCount;
        }

        // Get current texture to render to
        let texture: GPUTexture;
        try {
            texture = this.context.getCurrentTexture();
        } catch (error) {
            console.error('[Renderer] Failed to get current texture:', error);
            this.resetFrameState();
            return;
        }

        // Validate texture dimensions
        if (texture.width === 0 || texture.height === 0) {
            console.warn('[Renderer] Texture has zero dimensions, skipping frame');
            this.resetFrameState();
            return;
        }

        const textureView = texture.createView();
        const commandEncoder = this.device.createCommandEncoder({ label: 'Render Commands' });

        const renderPass = commandEncoder.beginRenderPass({
            label: 'Render Pass',
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: {
                        r: this.currentClearColor.r / 255,
                        g: this.currentClearColor.g / 255,
                        b: this.currentClearColor.b / 255,
                        a: this.currentClearColor.a / 255,
                    },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        // Draw primitives if any were added this frame
        // Safe assertions: these resources are created in initialize() before any rendering
        if (this.primitiveVertexCount > 0) {
            this.device.queue.writeBuffer(
                this.primitiveVertexBuffer as GPUBuffer,
                0,
                this.primitiveVertices.buffer,
                0,
                this.primitiveVertexCount * 6 * 4,
            );

            renderPass.setPipeline(this.primitivePipeline as GPURenderPipeline);
            renderPass.setBindGroup(0, this.primitiveBindGroup as GPUBindGroup);
            renderPass.setVertexBuffer(0, this.primitiveVertexBuffer as GPUBuffer);
            renderPass.draw(this.primitiveVertexCount);
        }

        // Draw all sprite batches (supports multiple textures per frame)
        // Safe assertions: these resources are created in initialize() before any rendering
        if (this.spriteBatches.length > 0 && this.totalSpriteVertices > 0) {
            // Upload all sprite vertices at once
            this.device.queue.writeBuffer(
                this.spriteVertexBuffer as GPUBuffer,
                0,
                this.spriteVertices.buffer,
                0,
                this.totalSpriteVertices * 8 * 4,
            );

            renderPass.setPipeline(this.spritePipeline as GPURenderPipeline);
            renderPass.setVertexBuffer(0, this.spriteVertexBuffer as GPUBuffer);

            // Draw each batch with its own bind group (texture)
            for (const batch of this.spriteBatches) {
                renderPass.setBindGroup(0, batch.bindGroup);
                renderPass.draw(batch.vertexCount, 1, batch.vertexStart, 0);
            }
        }

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);

        // Reset for next frame
        this.resetFrameState();
    }

    /**
     * Resets all per-frame rendering state.
     * Called at end of frame or when frame must be skipped.
     */
    private resetFrameState(): void {
        this.primitiveVertexCount = 0;
        this.spriteVertexCount = 0;
        this.totalSpriteVertices = 0;
        this.spriteBatches = [];
        this.currentTexture = null;
        this.currentBindGroup = null;
    }
}
