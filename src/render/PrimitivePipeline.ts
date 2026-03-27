import type { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';

// #region Configuration

/**
 * Maximum number of primitive vertices retained for a frame.
 *
 * Note: Axis-aligned lines are optimized to use 6 vertices total instead of
 * 6 vertices per pixel, dramatically reducing buffer requirements.
 */
const MAX_PRIMITIVE_VERTICES = 50000;

// #endregion

/**
 * Batched WebGPU pipeline for solid-color primitives.
 *
 * The pipeline collects CPU-side vertices for pixels, lines, rectangles, and
 * placeholder text during a frame, then uploads and draws them in `encodePass()`.
 */
export class PrimitivePipeline {
    // #region State

    /** WebGPU device, set during initialize(). */
    private device: GPUDevice | null = null;

    /** Render pipeline for colored geometry. */
    private pipeline: GPURenderPipeline | null = null;

    /** Uniform buffer containing screen resolution. */
    private uniformBuffer: GPUBuffer | null = null;

    /** Bind group for the uniform buffer. */
    private bindGroup: GPUBindGroup | null = null;

    /** GPU vertex buffer. */
    private vertexBuffer: GPUBuffer | null = null;

    /** CPU-side vertex data (6 floats per vertex: x, y, r, g, b, a). */
    private readonly vertices: Float32Array;

    /** Number of vertices in the current (unflushed) batch. */
    private vertexCount: number = 0;

    /** Camera offset applied to all drawing operations. */
    private cameraOffset: Vector2i = Vector2i.zero();

    // #endregion

    // #region Batching State

    /** Primitive batches recorded after each early flush. */
    private batches: Array<{ vertexStart: number; vertexCount: number }> = [];

    /** Total primitive vertices across all flushed batches. */
    private totalVertices: number = 0;

    // #endregion

    // #region Reusable Objects

    /** Pre-allocated rect to avoid per-call allocations in hot paths. */
    private readonly tempRect: Rect2i = new Rect2i(0, 0, 0, 0);

    // #endregion

    // #region Constructor

    /**
     * Creates an empty primitive pipeline.
     * Call `initialize()` before encoding GPU work.
     */
    constructor() {
        this.vertices = new Float32Array(MAX_PRIMITIVE_VERTICES * 6);
    }

    // #endregion

    // #region Initialization

    /**
     * Initializes the GPU pipeline state and backing buffers.
     *
     * @param device - WebGPU device for GPU operations.
     * @param displaySize - Render target resolution in pixels.
     */
    async initialize(device: GPUDevice, displaySize: Vector2i): Promise<void> {
        this.device = device;
        await this.createPipeline(displaySize);
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
     * Draws a filled rectangle using two triangles.
     *
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

        this.addVertex(x0, y0, r, g, b, a);
        this.addVertex(x1, y0, r, g, b, a);
        this.addVertex(x0, y1, r, g, b, a);

        this.addVertex(x1, y0, r, g, b, a);
        this.addVertex(x1, y1, r, g, b, a);
        this.addVertex(x0, y1, r, g, b, a);
    }

    /**
     * Draws placeholder text as colored blocks.
     * Each character is rendered as a small filled rectangle.
     *
     * @param pos - Text position (top-left corner).
     * @param color - Text color.
     * @param text - String to display.
     */
    drawText(pos: Vector2i, color: Color32, text: string): void {
        const charWidth = 6;
        const charHeight = 8;

        // Pre-compute color values once for all characters.
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const a = color.a / 255;

        for (let i = 0; i < text.length; i++) {
            const x0 = pos.x + i * charWidth;
            const x1 = x0 + charWidth - 1;
            const y0 = pos.y;
            const y1 = y0 + charHeight;

            // Draw directly without allocating Rect2i.
            this.addVertex(x0, y0, r, g, b, a);
            this.addVertex(x1, y0, r, g, b, a);
            this.addVertex(x0, y1, r, g, b, a);

            this.addVertex(x1, y0, r, g, b, a);
            this.addVertex(x1, y1, r, g, b, a);
            this.addVertex(x0, y1, r, g, b, a);
        }
    }

    /**
     * Draws a single pixel as a 1x1 filled rectangle.
     *
     * @param pos - Pixel position.
     * @param color - Pixel color.
     */
    drawPixel(pos: Vector2i, color: Color32): void {
        // Use pre-allocated rect to avoid allocation per pixel.
        this.tempRect.set(pos.x, pos.y, 1, 1);
        this.drawRectFill(this.tempRect, color);
    }

    /**
     * Draws a single pixel at raw coordinates.
     * More efficient than `drawPixel()` when coordinates are already unpacked.
     *
     * @param x - X position.
     * @param y - Y position.
     * @param color - Pixel color.
     */
    drawPixelXY(x: number, y: number, color: Color32): void {
        // Direct vertex addition without any object allocation.
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const a = color.a / 255;

        // Draw 1x1 rectangle (2 triangles = 6 vertices).
        const x1 = x + 1;
        const y1 = y + 1;

        this.addVertex(x, y, r, g, b, a);
        this.addVertex(x1, y, r, g, b, a);
        this.addVertex(x, y1, r, g, b, a);

        this.addVertex(x1, y, r, g, b, a);
        this.addVertex(x1, y1, r, g, b, a);
        this.addVertex(x, y1, r, g, b, a);
    }

    /**
     * Draws a line using optimized quad rendering for axis-aligned lines,
     * falling back to Bresenham's algorithm for diagonal lines.
     *
     * Horizontal and vertical lines are emitted as a single quad. Diagonal
     * lines fall back to Bresenham-style pixel steps for pixel-art fidelity.
     *
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Line color.
     */
    drawLine(p0: Vector2i, p1: Vector2i, color: Color32): void {
        // Vector2i already guarantees integers, but |0 ensures the 32-bit int for bitwise ops.
        const x0 = p0.x | 0;
        const y0 = p0.y | 0;
        const x1 = p1.x | 0;
        const y1 = p1.y | 0;

        // Optimization: Axis-aligned lines use a single quad (6 vertices total).
        // This provides ~600x vertex reduction for typical grid lines.
        if (y0 === y1) {
            // Horizontal line: single 1px-tall quad.
            const minX = Math.min(x0, x1);
            const maxX = Math.max(x0, x1);

            this.tempRect.set(minX, y0, maxX - minX + 1, 1);
            this.drawRectFill(this.tempRect, color);

            return;
        }

        if (x0 === x1) {
            // Vertical line: single 1px-wide quad.
            const minY = Math.min(y0, y1);
            const maxY = Math.max(y0, y1);

            this.tempRect.set(x0, minY, 1, maxY - minY + 1);
            this.drawRectFill(this.tempRect, color);

            return;
        }

        // Diagonal lines: fall back to Bresenham for pixel-perfect rendering.
        this.drawLineBresenham(x0, y0, x1, y1, color);
    }

    /**
     * Draws a rectangle outline using four 1-pixel quads.
     * Emits quads directly rather than delegating to `drawLine()`.
     *
     * @param rect - Rectangle bounds.
     * @param color - Outline color.
     */
    drawRect(rect: Rect2i, color: Color32): void {
        const x0 = rect.x;
        const y0 = rect.y;
        const x1 = rect.x + rect.width - 1;
        const y1 = rect.y + rect.height - 1;

        // Draw 4-line quads directly using the pre-allocated tempRect.
        // This avoids 4 function calls to drawLine and their overhead.

        // Top line (horizontal): from (x0, y0) to (x1, y0), 1px tall.
        this.tempRect.set(x0, y0, x1 - x0 + 1, 1);
        this.drawRectFill(this.tempRect, color);

        // Bottom line (horizontal): from (x0, y1) to (x1, y1), 1px tall.
        this.tempRect.set(x0, y1, x1 - x0 + 1, 1);
        this.drawRectFill(this.tempRect, color);

        // Left line (vertical): from (x0, y0+1) to (x0, y1-1), 1px wide.
        // Shortened to avoid corner overlap with top/bottom lines.
        if (y1 - y0 > 1) {
            this.tempRect.set(x0, y0 + 1, 1, y1 - y0 - 1);
            this.drawRectFill(this.tempRect, color);
        }

        // Right line (vertical): from (x1, y0+1) to (x1, y1-1), 1px wide.
        // Shortened to avoid corner overlap with top/bottom lines.
        if (y1 - y0 > 1) {
            this.tempRect.set(x1, y0 + 1, 1, y1 - y0 - 1);
            this.drawRectFill(this.tempRect, color);
        }
    }

    /**
     * Fills a rectangular region with a solid color.
     * Alias for `drawRectFill()` kept for renderer API consistency.
     *
     * @param color - Fill color.
     * @param rect - Region to fill.
     */
    clearRect(color: Color32, rect: Rect2i): void {
        this.drawRectFill(rect, color);
    }

    /**
     * Uploads accumulated primitive vertices and encodes draw calls.
     * No-op when nothing has been queued for the current frame.
     *
     * @param renderPass - Active render pass encoder.
     */
    encodePass(renderPass: GPURenderPassEncoder): void {
        // Flush any remaining vertices into the batch queue.
        this.earlyFlush();

        if (this.batches.length === 0 || this.totalVertices === 0) {
            return;
        }

        // Upload all vertex data at once.
        // Safe assertions: these resources are created in initialize() before any rendering.
        (this.device as GPUDevice).queue.writeBuffer(
            this.vertexBuffer as GPUBuffer,
            0,
            this.vertices.buffer,
            0,
            this.totalVertices * 6 * 4,
        );

        renderPass.setPipeline(this.pipeline as GPURenderPipeline);
        renderPass.setBindGroup(0, this.bindGroup as GPUBindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer as GPUBuffer);

        for (const batch of this.batches) {
            renderPass.draw(batch.vertexCount, 1, batch.vertexStart, 0);
        }
    }

    // #endregion

    // #region Frame Rendering

    /**
     * Clears per-frame batching state.
     */
    reset(): void {
        this.vertexCount = 0;
        this.totalVertices = 0;
        this.batches = [];
    }

    /**
     * Creates shader modules, pipeline state, and GPU buffers for primitive draws.
     *
     * @param displaySize - Render target resolution in pixels.
     */
    private async createPipeline(displaySize: Vector2i): Promise<void> {
        const device = this.device as GPUDevice;

        const shaderModule = device.createShaderModule({
            label: 'Primitive Shader',
            code: `
                /**
                 * Vertex input structure for primitive rendering.
                 */
                struct VertexInput {
                    // Position in clip space.
                    @location(0) position: vec2<f32>,

                    // Color in RGBA.
                    @location(1) color: vec4<f32>,
                }

                /**
                 * Vertex output structure for primitive rendering.
                 */
                struct VertexOutput {
                    // Position in clip space.
                    @builtin(position) position: vec4<f32>,

                    // Color in RGBA.
                    @location(0) color: vec4<f32>,
                }

                /**
                 * Uniforms for primitive rendering.
                 */
                struct Uniforms {
                    // Resolution in pixels.
                    resolution: vec2<f32>,
                }

                /**
                 * Uniforms for primitive rendering.
                 */
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;

                /**
                 * Vertex shader main function.
                 */
                @vertex
                fn vs_main(input: VertexInput) -> VertexOutput {
                    // Output vertex.
                    var output: VertexOutput;

                    // Convert from pixel coordinates to clip space (-1 to 1).
                    let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
                    let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;

                    // Set the position of the vertex in clip space.
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

        this.pipeline = device.createRenderPipeline({
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

        this.uniformBuffer = device.createBuffer({
            label: 'Primitive Uniform Buffer',
            size: 8, // vec2
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([displaySize.x, displaySize.y]));

        // Safe assertion: pipeline is created above.
        this.bindGroup = device.createBindGroup({
            label: 'Primitive Bind Group',
            layout: (this.pipeline as GPURenderPipeline).getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });

        this.vertexBuffer = device.createBuffer({
            label: 'Primitive Vertex Buffer',
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }

    // #endregion

    // #region Private Helpers

    /**
     * Draws a diagonal line using Bresenham's line algorithm.
     * Produces pixel-perfect lines without antialiasing by emitting 1x1 quads
     * for each stepped pixel.
     *
     * @param x0 - Start X coordinate.
     * @param y0 - Start Y coordinate.
     * @param x1 - End X coordinate.
     * @param y1 - End Y coordinate.
     * @param color - Line color.
     */
    private drawLineBresenham(x0: number, y0: number, x1: number, y1: number, color: Color32): void {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let cx = x0;
        let cy = y0;

        // Pre-compute color values once for the entire line.
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const a = color.a / 255;

        while (true) {
            // Draw pixel directly without creating Vector2i.
            this.addPixelVertices(cx, cy, r, g, b, a);

            if (cx === x1 && cy === y1) {
                break;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                cx += sx;
            }
            if (e2 < dx) {
                err += dx;
                cy += sy;
            }
        }
    }

    /**
     * Adds vertices for a single pixel (6 vertices for 2 triangles).
     * Internal helper used by the Bresenham path.
     *
     * @param x - X position.
     * @param y - Y position.
     * @param r - Red component (0-1).
     * @param g - Green component (0-1).
     * @param b - Blue component (0-1).
     * @param a - Alpha component (0-1).
     */
    private addPixelVertices(x: number, y: number, r: number, g: number, b: number, a: number): void {
        // Ensure space for complete pixel (6 vertices) to prevent partial geometry
        const index = (this.totalVertices + this.vertexCount) * 6;

        if (index + 36 > this.vertices.length) {
            // 6 vertices * 6 floats
            if (this.vertexCount > 0) {
                this.earlyFlush();
            }

            // Check again after flush - if still no space, buffer is exhausted
            if ((this.totalVertices + this.vertexCount) * 6 + 36 > this.vertices.length) {
                console.warn('[PrimitivePipeline] Buffer exhausted, pixel dropped');

                return;
            }
        }

        const x1 = x + 1;
        const y1 = y + 1;

        this.addVertex(x, y, r, g, b, a);
        this.addVertex(x1, y, r, g, b, a);
        this.addVertex(x, y1, r, g, b, a);

        this.addVertex(x1, y, r, g, b, a);
        this.addVertex(x1, y1, r, g, b, a);
        this.addVertex(x, y1, r, g, b, a);
    }

    /**
     * Adds a single vertex to the primitive batch.
     * Flushes batching state first if the frame buffer has been filled.
     *
     * @param x - X position in pixels.
     * @param y - Y position in pixels.
     * @param r - Red component (0-1).
     * @param g - Green component (0-1).
     * @param b - Blue component (0-1).
     * @param a - Alpha component (0-1).
     */
    private addVertex(x: number, y: number, r: number, g: number, b: number, a: number): void {
        const index = (this.totalVertices + this.vertexCount) * 6;

        if (index + 6 > this.vertices.length) {
            this.earlyFlush();

            // Re-check after flush - if still no space, buffer is exhausted for this frame.
            const newIndex = (this.totalVertices + this.vertexCount) * 6;

            if (newIndex + 6 > this.vertices.length) {
                console.warn('[PrimitivePipeline] Primitive buffer capacity exceeded for this frame, vertex dropped');
                return;
            }

            // Space available after flush, continue with vertex addition below.
        }

        // eslint-disable-next-line security/detect-object-injection
        this.vertices[index] = x - this.cameraOffset.x;
        this.vertices[index + 1] = y - this.cameraOffset.y;
        this.vertices[index + 2] = r;
        this.vertices[index + 3] = g;
        this.vertices[index + 4] = b;
        this.vertices[index + 5] = a;

        this.vertexCount++;
    }

    /**
     * Records the current vertex batch and resets the vertex count.
     * Used for early flush when the buffer is full mid-frame.
     * Does not write to GPU — encodePass() uploads all batches at once.
     */
    private earlyFlush(): void {
        if (this.vertexCount === 0) {
            return;
        }

        this.batches.push({ vertexStart: this.totalVertices, vertexCount: this.vertexCount });
        this.totalVertices += this.vertexCount;
        this.vertexCount = 0;
    }

    // #endregion
}
