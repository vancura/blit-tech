import type { BitmapFont } from '../assets/BitmapFont';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';

// #region Configuration

/**
 * Maximum number of sprite vertices per a frame.
 * Each vertex uses 8 floats (x, y, u, v, r, g, b, a).
 * 50k vertices = ~1.6 MB buffer, supports ~8.3k sprites per a frame.
 */
const MAX_SPRITE_VERTICES = 50000;

// #endregion

/**
 * WebGPU sprite rendering pipeline.
 * Handles textured quads (sprites, bitmap text) with tinting.
 * Batches draws by texture to minimize GPU state changes.
 * Vertices are accumulated per-frame and drawn at frame end via encodePass().
 */
export class SpritePipeline {
    // #region State

    /** WebGPU device, set during initialize(). */
    private device: GPUDevice | null = null;

    /** Render pipeline for textured sprites. */
    private pipeline: GPURenderPipeline | null = null;

    /** Uniform buffer containing screen resolution. */
    private uniformBuffer: GPUBuffer | null = null;

    /** Nearest-neighbor sampler for pixel-perfect rendering. */
    private sampler: GPUSampler | null = null;

    /** GPU vertex buffer. */
    private vertexBuffer: GPUBuffer | null = null;

    /** CPU-side vertex data (8 floats per vertex: x, y, u, v, r, g, b, a). */
    private readonly vertices: Float32Array;

    /** Number of vertices in the current (unflushed) batch. */
    private vertexCount: number = 0;

    /** Camera offset applied to all drawing operations. */
    private cameraOffset: Vector2i = Vector2i.zero();

    // #endregion

    // #region Batching State

    /** Currently bound texture for sprite rendering. */
    private currentTexture: GPUTexture | null = null;

    /** Currently bound bind group for sprite rendering. */
    private currentBindGroup: GPUBindGroup | null = null;

    /** Cache of texture bind groups for reuse. */
    private readonly textureBindGroups: Map<GPUTexture, GPUBindGroup> = new Map();

    /** Sprite batches to render (one per texture). */
    private batches: Array<{ bindGroup: GPUBindGroup; vertexStart: number; vertexCount: number }> = [];

    /** Total sprite vertices across all flushed batches. */
    private totalVertices: number = 0;

    // #endregion

    // #region Reusable Objects

    /** Pre-allocated vector for character positions in drawBitmapText. */
    private readonly tempVec: Vector2i = new Vector2i(0, 0);

    /** Pre-allocated vector for sprite size in drawSprite. */
    private readonly tempSize: Vector2i = new Vector2i(0, 0);

    // #endregion

    // #region Constructor

    /**
     * Creates a new SpritePipeline.
     * Call initialize() before any drawing operations.
     */
    constructor() {
        this.vertices = new Float32Array(MAX_SPRITE_VERTICES * 8);
    }

    // #endregion

    // #region Initialization

    /**
     * Initializes the WebGPU pipeline, GPU buffers, and sampler.
     * Must be called before any drawing operations.
     *
     * @param device - WebGPU device for GPU operations.
     * @param displaySize - Render target resolution in pixels.
     */
    async initialize(device: GPUDevice, displaySize: Vector2i): Promise<void> {
        this.device = device;
        await this.createPipeline(displaySize);
    }

    /**
     * Creates the WGSL shader, render pipeline, GPU buffers, and sampler for textured sprites.
     * Vertices contain position, UV coordinates, and tint color.
     *
     * @param displaySize - Render target resolution in pixels.
     */
    private async createPipeline(displaySize: Vector2i): Promise<void> {
        const device = this.device as GPUDevice;

        const shaderModule = device.createShaderModule({
            label: 'Sprite Shader',
            code: `
                struct VertexInput {
                    /** Position of the vertex in pixel coordinates. */
                    @location(0) position: vec2<f32>,

                    /** UV coordinates of the vertex. */
                    @location(1) uv: vec2<f32>,

                    /** Tint color of the vertex. */
                    @location(2) color: vec4<f32>,
                }

                struct VertexOutput {
                    /** Position of the vertex in clip coordinates. */
                    @builtin(position) position: vec4<f32>,

                    /** UV coordinates of the vertex in clip coordinates. */
                    @location(0) uv: vec2<f32>,

                    /** Tint color of the vertex in clip coordinates. */
                    @location(1) color: vec4<f32>,
                }

                struct Uniforms {
                    /** Resolution of the screen in pixels. */
                    resolution: vec2<f32>,
                }

                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                @group(0) @binding(1) var texSampler: sampler;
                @group(0) @binding(2) var texture: texture_2d<f32>;

                @vertex
                fn vs_main(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;

                    // Calculate clip coordinates.
                    let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
                    let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;

                    output.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
                    output.uv = input.uv;
                    output.color = input.color;

                    return output;
                }

                @fragment
                fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
                    // Calculate color.
                    let texColor = textureSample(texture, texSampler, input.uv);

                    return texColor * input.color;
                }
            `,
        });

        this.pipeline = device.createRenderPipeline({
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

        this.uniformBuffer = device.createBuffer({
            label: 'Sprite Uniform Buffer',
            size: 8, // vec2
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([displaySize.x, displaySize.y]));

        this.vertexBuffer = device.createBuffer({
            label: 'Sprite Vertex Buffer',
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // Create a sampler for sprites (nearest-neighbor for pixel-perfect rendering).
        this.sampler = device.createSampler({
            label: 'Sprite Sampler',
            magFilter: 'nearest', // Pixel-perfect rendering
            minFilter: 'nearest',
            mipmapFilter: 'nearest',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
    }

    // #endregion

    // #region Camera

    /**
     * Sets the camera offset applied to all drawing operations.
     *
     * @param offset - Camera position in pixels.
     */
    setCameraOffset(offset: Vector2i): void {
        this.cameraOffset = offset;
    }

    // #endregion

    // #region Drawing

    /**
     * Draws a sprite region from a sprite sheet.
     *
     * @param spriteSheet - Source sprite sheet.
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw at.
     * @param tint - Tint color multiplied with texture (defaults to white).
     */
    drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint: Color32 = Color32.white()): void {
        const texture = spriteSheet.getTexture(this.device as GPUDevice);
        const uvs = spriteSheet.getUVs(srcRect);

        // Use a pre-allocated vector for size to avoid allocation.
        this.tempSize.set(srcRect.width, srcRect.height);

        this.drawTexturedQuad(texture, destPos, this.tempSize, uvs.u0, uvs.v0, uvs.u1, uvs.v1, tint);
    }

    /**
     * Draws text using a bitmap font.
     * Renders each character as a textured sprite.
     *
     * @param font - Bitmap font with character glyphs.
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param color - Text color multiplied with font texture.
     */
    drawBitmapText(font: BitmapFont, pos: Vector2i, text: string, color: Color32 = Color32.white()): void {
        const spriteSheet = font.getSpriteSheet();
        let cursorX = pos.x;
        const len = text.length;

        // The optimized loop using charCodeAt and getGlyphByCode for ASCII fast-path.
        for (let i = 0; i < len; i++) {
            const code = text.charCodeAt(i);
            const glyph = font.getGlyphByCode(code);

            if (glyph) {
                // Use a pre-allocated vector to avoid allocation per character.
                this.tempVec.set(cursorX + glyph.offsetX, pos.y + glyph.offsetY);
                this.drawSprite(spriteSheet, glyph.rect, this.tempVec, color);
                cursorX += glyph.advance;
            }
        }
    }

    // #endregion

    // #region Frame Rendering

    /**
     * Encodes all accumulated sprite batches into the given render pass.
     * Flushes the current batch, uploads all vertex data to GPU, and issues draw calls.
     * No-op if no sprites were accumulated this frame.
     *
     * @param renderPass - Active render pass encoder.
     */
    encodePass(renderPass: GPURenderPassEncoder): void {
        // Flush any remaining vertices into the batch queue.
        this.flushCurrentBatch();

        if (this.batches.length === 0 || this.totalVertices === 0) {
            return;
        }

        // Upload all sprite vertices at once.
        // Safe assertions: these resources are created in initialize() before any rendering.
        (this.device as GPUDevice).queue.writeBuffer(
            this.vertexBuffer as GPUBuffer,
            0,
            this.vertices.buffer,
            0,
            this.totalVertices * 8 * 4,
        );

        renderPass.setPipeline(this.pipeline as GPURenderPipeline);
        renderPass.setVertexBuffer(0, this.vertexBuffer as GPUBuffer);

        // Draw each batch with its own bind group (texture).
        for (const batch of this.batches) {
            renderPass.setBindGroup(0, batch.bindGroup);
            renderPass.draw(batch.vertexCount, 1, batch.vertexStart, 0);
        }
    }

    /**
     * Resets all per-frame state.
     * Call at the start and end of each frame.
     */
    reset(): void {
        this.vertexCount = 0;
        this.totalVertices = 0;
        this.batches = [];
        this.currentTexture = null;
        this.currentBindGroup = null;
    }

    // #endregion

    // #region Private Helpers

    /**
     * Draws a textured quad (two triangles) to the screen.
     * Handles texture switching and batch flushing.
     * Ensures complete quads are added atomically to prevent partial geometry.
     *
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
        // Flush if switching textures.
        if (this.currentTexture !== texture) {
            if (this.vertexCount > 0) {
                this.flushCurrentBatch();
            }

            this.currentTexture = texture;
            this.currentBindGroup = this.getOrCreateBindGroup(texture);
        }

        // Ensure there is a space for a complete quad (6 vertices) before adding any.
        // This prevents partial quads that would cause rendering corruption.
        if (!this.hasSpaceForQuad()) {
            if (this.vertexCount > 0) {
                this.flushCurrentBatch();
            }

            // Check again after flush - if still no space, the buffer is full for this frame.
            if (!this.hasSpaceForQuad()) {
                console.warn('[SpritePipeline] Sprite buffer capacity exceeded for this frame, quad dropped');

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

        // Triangle 1.
        this.addVertex(x0, y0, u0, v0, r, g, b, a);
        this.addVertex(x1, y0, u1, v0, r, g, b, a);
        this.addVertex(x0, y1, u0, v1, r, g, b, a);

        // Triangle 2.
        this.addVertex(x1, y0, u1, v0, r, g, b, a);
        this.addVertex(x1, y1, u1, v1, r, g, b, a);
        this.addVertex(x0, y1, u0, v1, r, g, b, a);
    }

    /**
     * Checks if there is enough buffer space for a complete quad (6 vertices).
     *
     * @returns True if a quad can be added without splitting.
     */
    private hasSpaceForQuad(): boolean {
        const index = (this.totalVertices + this.vertexCount) * 8;
        const quadSize = 6 * 8; // 6 vertices * 8 floats per vertex
        return index + quadSize <= this.vertices.length;
    }

    /**
     * Saves the current sprite batch and prepares for a new texture.
     * Called automatically when texture changes or at frame end.
     */
    private flushCurrentBatch(): void {
        if (this.vertexCount === 0 || !this.currentBindGroup) {
            return;
        }

        // Save this batch for rendering at encodePass.
        this.batches.push({
            bindGroup: this.currentBindGroup,
            vertexStart: this.totalVertices,
            vertexCount: this.vertexCount,
        });

        this.totalVertices += this.vertexCount;
        this.vertexCount = 0;
    }

    /**
     * Adds a sprite vertex to the batch.
     * Assumes buffer space was pre-checked via hasSpaceForQuad() in drawTexturedQuad().
     *
     * @param x - X position in pixels.
     * @param y - Y position in pixels.
     * @param u - U texture coordinate.
     * @param v - V texture coordinate.
     * @param r - Red tint (0-1).
     * @param g - Green tint (0-1).
     * @param b - Blue tint (0-1).
     * @param a - Alpha (0-1).
     */
    private addVertex(x: number, y: number, u: number, v: number, r: number, g: number, b: number, a: number): void {
        // Use total vertices (across all batches) + current batch count for the index.
        const index = (this.totalVertices + this.vertexCount) * 8;

        // eslint-disable-next-line security/detect-object-injection
        this.vertices[index] = x - this.cameraOffset.x;
        this.vertices[index + 1] = y - this.cameraOffset.y;
        this.vertices[index + 2] = u;
        this.vertices[index + 3] = v;
        this.vertices[index + 4] = r;
        this.vertices[index + 5] = g;
        this.vertices[index + 6] = b;
        this.vertices[index + 7] = a;

        this.vertexCount++;
    }

    /**
     * Gets or creates a bind group for a texture.
     * Bind groups are cached for reuse.
     *
     * @param texture - GPU texture to create the bind group for.
     * @returns Bind group containing uniform buffer, sampler and texture.
     */
    private getOrCreateBindGroup(texture: GPUTexture): GPUBindGroup {
        const existingBindGroup = this.textureBindGroups.get(texture);

        if (existingBindGroup) {
            return existingBindGroup;
        }

        // Safe assertions: these resources are created in initialize() before any drawing.
        const bindGroup = (this.device as GPUDevice).createBindGroup({
            label: 'Sprite Bind Group',
            layout: (this.pipeline as GPURenderPipeline).getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer as GPUBuffer } },
                { binding: 1, resource: this.sampler as GPUSampler },
                { binding: 2, resource: texture.createView() },
            ],
        });

        this.textureBindGroups.set(texture, bindGroup);

        return bindGroup;
    }

    // #endregion
}
