import type { BitmapFont } from '../assets/BitmapFont';
import type { Palette } from '../assets/Palette';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import { FrameCapture } from '../utils/FrameCapture';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { PrimitivePipeline } from './PrimitivePipeline';
import { SpritePipeline } from './SpritePipeline';

// #region Configuration

/**
 * GPU palette uniform buffer size: 256 entries x 4 floats x 4 bytes = 4096 bytes.
 */
const PALETTE_BUFFER_SIZE = 256 * 4 * 4;

// #endregion

/**
 * High-level renderer that coordinates primitive and sprite pipelines.
 *
 * `Renderer` owns frame begin/end, clear color, camera state, palette buffer,
 * and frame capture. Actual draw batching is delegated to
 * {@link PrimitivePipeline} and {@link SpritePipeline}.
 */
export class Renderer {
    // #region State

    /** WebGPU device for GPU operations. */
    private readonly device: GPUDevice;

    /** WebGPU canvas context for presenting frames. */
    private context: GPUCanvasContext;

    /** Render target resolution in pixels. */
    private readonly displaySize: Vector2i;

    /** Palette index used for the frame clear color. Defaults to 0 (transparent). */
    private clearPaletteIndex: number = 0;

    /** Camera offset for scrolling effects. */
    private cameraOffset: Vector2i = Vector2i.zero();

    /** Frame capture manager for PNG export. */
    private readonly frameCapture = new FrameCapture();

    // #endregion

    // #region Palette State

    /** Active palette for color lookups and GPU upload. */
    private palette: Palette | null = null;

    /** GPU uniform buffer for the 256-entry palette. */
    private paletteBuffer: GPUBuffer | null = null;

    /** Reusable staging buffer for GPU palette uploads. Avoids per-frame allocation. */
    private readonly paletteStaging = new Float32Array(256 * 4);

    /** True when the palette has changed and needs to be re-uploaded to the GPU. */
    private paletteDirty: boolean = false;

    // #endregion

    // #region Pipelines

    /** Pipeline for palette-indexed geometry (pixels, lines, rectangles). */
    private readonly primitives: PrimitivePipeline;

    /** Pipeline for textured quads (sprites, bitmap text). */
    private readonly sprites: SpritePipeline;

    // #endregion

    // #region Constructor

    /**
     * Creates a renderer bound to an initialized device and canvas context.
     *
     * @param device - WebGPU device for GPU operations.
     * @param context - WebGPU canvas context for presenting frames.
     * @param displaySize - Render target resolution in pixels.
     */
    constructor(device: GPUDevice, context: GPUCanvasContext, displaySize: Vector2i) {
        this.device = device;
        this.context = context;
        this.displaySize = displaySize.clone();
        this.primitives = new PrimitivePipeline();
        this.sprites = new SpritePipeline();
    }

    // #endregion

    // #region Initialization

    /**
     * Initializes the underlying render pipelines and GPU resources.
     *
     * @returns `true` when GPU resources are ready; otherwise `false`.
     */
    async initialize(): Promise<boolean> {
        try {
            // Create shared palette uniform buffer (256 entries x vec4f).
            this.paletteBuffer = this.device.createBuffer({
                label: 'Palette Uniform Buffer',
                size: PALETTE_BUFFER_SIZE,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            await this.primitives.initialize(this.device, this.displaySize, this.paletteBuffer);
            await this.sprites.initialize(this.device, this.displaySize, this.paletteBuffer);

            return true;
        } catch (error) {
            console.error('[Renderer] Initialization failed:', error);

            return false;
        }
    }

    // #endregion

    // #region Palette

    /**
     * Sets the active palette used for rendering.
     *
     * @param palette - Palette to use for color lookups and GPU upload.
     */
    setPalette(palette: Palette): void {
        this.palette = palette.clone();
        this.paletteDirty = true;
    }

    /**
     * Returns a copy of the active palette, or null if none has been set.
     *
     * Returns a clone so callers cannot mutate the internal palette and bypass
     * the dirty flag that drives GPU re-upload.
     *
     * @returns Clone of the active palette instance, or null.
     */
    getPalette(): Palette | null {
        return this.palette?.clone() ?? null;
    }

    // #endregion

    // #region Frame Management

    /**
     * Begins a new frame by clearing all per-frame batching state.
     *
     * @throws Error if no palette has been set via {@link setPalette}.
     */
    beginFrame(): void {
        if (!this.palette) {
            throw new Error('Cannot begin frame: no active palette. Call setPalette() first.');
        }

        this.primitives.reset();
        this.sprites.reset();
    }

    /**
     * Sets the background clear color for this frame using a palette index.
     *
     * @param paletteIndex - Palette index for the clear color.
     */
    setClearColor(paletteIndex: number): void {
        this.clearPaletteIndex = paletteIndex;
    }

    /**
     * Ends the current frame and presents to the screen.
     * Uploads the palette uniform buffer, encodes both pipelines into a render
     * pass, and submits the command buffer.
     */
    endFrame(): void {
        // Get the current texture to render to.
        let texture: GPUTexture;

        try {
            texture = this.context.getCurrentTexture();
        } catch (error) {
            console.error('[Renderer] Failed to get current texture:', error);

            this.primitives.reset();
            this.sprites.reset();

            return;
        }

        // Validate texture dimensions.
        if (texture.width === 0 || texture.height === 0) {
            console.warn('[Renderer] Texture has zero dimensions, skipping frame');

            this.primitives.reset();
            this.sprites.reset();

            return;
        }

        // Upload palette to GPU only when it has changed.
        if (this.palette && this.paletteBuffer && this.paletteDirty) {
            this.palette.toFloat32ArrayInto(this.paletteStaging);
            this.device.queue.writeBuffer(this.paletteBuffer, 0, this.paletteStaging);
            this.paletteDirty = false;
        }

        // Resolve clear color from palette.
        const clearColor = this.resolveClearColor();

        const textureView = texture.createView();
        const commandEncoder = this.device.createCommandEncoder({ label: 'Render Commands' });

        const renderPass = commandEncoder.beginRenderPass({
            label: 'Render Pass',
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: {
                        r: clearColor.r / 255,
                        g: clearColor.g / 255,
                        b: clearColor.b / 255,
                        a: clearColor.a / 255,
                    },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        this.primitives.encodePass(renderPass);
        this.sprites.encodePass(renderPass);

        renderPass.end();

        // If a frame capture is pending, add the texture-to-buffer copy before submitting.
        const capturing = this.frameCapture.hasPendingCapture();

        if (capturing) {
            this.frameCapture.executeCaptureInEncoder(this.device, texture, commandEncoder);
        }

        this.device.queue.submit([commandEncoder.finish()]);

        // Resolve the capture asynchronously (does not block the game loop).
        if (capturing) {
            void this.frameCapture.resolveCapture(this.device);
        }

        // Defensive reset so the pipeline state is clean even if beginFrame() is not called next.
        // beginFrame() also resets; this prevents stale data from persisting across frames.
        this.primitives.reset();
        this.sprites.reset();
    }

    // #endregion

    // #region Primitive Drawing

    /**
     * Draws a filled rectangle using two triangles.
     *
     * @param rect - Rectangle bounds in pixel coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawRectFill(rect: Rect2i, paletteIndex: number): void {
        this.primitives.drawRectFill(rect, paletteIndex);
    }

    /**
     * Draws placeholder text as colored blocks.
     * Each character is rendered as a small filled rectangle.
     *
     * @param pos - Text position (top-left corner).
     * @param paletteIndex - Palette color index.
     * @param text - String to display.
     */
    drawText(pos: Vector2i, paletteIndex: number, text: string): void {
        this.primitives.drawText(pos, paletteIndex, text);
    }

    /**
     * Draws a single pixel as a 1x1 filled rectangle.
     *
     * @param pos - Pixel position.
     * @param paletteIndex - Palette color index.
     */
    drawPixel(pos: Vector2i, paletteIndex: number): void {
        this.drawPixelXYInternal(pos.x, pos.y, paletteIndex);
    }

    /**
     * Draws a single pixel at integer coordinates.
     * Enforces integer coordinates per rendering guidelines.
     *
     * @param pos - Pixel position.
     * @param paletteIndex - Palette color index.
     */
    drawPixelXY(pos: Vector2i, paletteIndex: number): void {
        this.drawPixelXYInternal(pos.x, pos.y, paletteIndex);
    }

    /**
     * Draws a line using optimized quad rendering for axis-aligned lines,
     * falling back to Bresenham's algorithm for diagonal lines.
     *
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param paletteIndex - Palette color index.
     */
    drawLine(p0: Vector2i, p1: Vector2i, paletteIndex: number): void {
        this.primitives.drawLine(p0, p1, paletteIndex);
    }

    /**
     * Draws a rectangle outline using four 1-pixel quads.
     *
     * @param rect - Rectangle bounds.
     * @param paletteIndex - Palette color index.
     */
    drawRect(rect: Rect2i, paletteIndex: number): void {
        this.primitives.drawRect(rect, paletteIndex);
    }

    /**
     * Fills a rectangular region with a palette-indexed color.
     *
     * @param rect - Region to fill in pixel coordinates.
     * @param paletteIndex - Palette color index.
     */
    clearRect(rect: Rect2i, paletteIndex: number): void {
        this.primitives.clearRect(rect, paletteIndex);
    }

    // #endregion

    // #region Sprite Drawing

    /**
     * Draws a sprite region from a sprite sheet.
     *
     * @param spriteSheet - Source sprite sheet.
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw at.
     * @param tint - Tint color multiplied with texture (defaults to white).
     */
    drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint: Color32 = Color32.white()): void {
        this.sprites.drawSprite(spriteSheet, srcRect, destPos, tint);
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
        this.sprites.drawBitmapText(font, pos, text, color);
    }

    // #endregion

    // #region Frame Capture

    /**
     * Captures the next rendered frame as a PNG blob.
     * The capture happens on the next `endFrame()` call.
     * If a capture is already pending, the previous one is rejected.
     *
     * @returns Promise resolving to a PNG Blob of the rendered frame.
     */
    captureFrame(): Promise<Blob> {
        return this.frameCapture.requestCapture();
    }

    // #endregion

    // #region Camera

    /**
     * Sets the camera offset for scrolling.
     * The offset is propagated to both internal pipelines.
     *
     * @param offset - Camera position in pixels.
     */
    setCameraOffset(offset: Vector2i): void {
        this.cameraOffset = offset.clone();
        this.primitives.setCameraOffset(this.cameraOffset);
        this.sprites.setCameraOffset(this.cameraOffset);
    }

    /**
     * Gets the current camera offset.
     *
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
        this.primitives.setCameraOffset(this.cameraOffset);
        this.sprites.setCameraOffset(this.cameraOffset);
    }

    // #endregion

    // #region Private Helpers

    /**
     * Fast-path pixel draw using raw integer coordinates.
     * Avoids Vector2i unpacking overhead when coordinates are already available as numbers.
     *
     * @param x - X position.
     * @param y - Y position.
     * @param paletteIndex - Palette color index.
     */
    private drawPixelXYInternal(x: number, y: number, paletteIndex: number): void {
        this.primitives.drawPixelXY(x, y, paletteIndex);
    }

    /**
     * Resolves the clear palette index into a Color32 for the render pass.
     * Falls back to black if no palette is available.
     *
     * @returns Resolved clear color.
     */
    private resolveClearColor(): Color32 {
        if (!this.palette) {
            return Color32.black();
        }

        try {
            return this.palette.get(this.clearPaletteIndex);
        } catch (error) {
            console.warn('[Renderer] resolveClearColor: clearPaletteIndex out of range, falling back to black:', error);

            return Color32.black();
        }
    }

    // #endregion
}
