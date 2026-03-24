import type { BitmapFont } from '../assets/BitmapFont';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { PrimitivePipeline } from './PrimitivePipeline';
import { SpritePipeline } from './SpritePipeline';

/**
 * WebGPU renderer for Blit-Tech.
 * Orchestrates the primitive and sprite pipelines.
 * Handles frame lifecycle, camera, and delegates all drawing to the appropriate pipeline.
 */
export class Renderer {
    // #region State

    /** WebGPU device for GPU operations. */
    private readonly device: GPUDevice;

    /** WebGPU canvas context for presenting frames. */
    private context: GPUCanvasContext;

    /** Render target resolution in pixels. */
    private displaySize: Vector2i;

    /** Current clear color for the background. */
    private currentClearColor: Color32 = Color32.black();

    /** Camera offset for scrolling effects. */
    private cameraOffset: Vector2i = Vector2i.zero();

    // #endregion

    // #region Pipelines

    /** Pipeline for colored geometry (pixels, lines, rectangles). */
    private readonly primitives: PrimitivePipeline;

    /** Pipeline for textured quads (sprites, bitmap text). */
    private readonly sprites: SpritePipeline;

    // #endregion

    // #region Constructor

    /**
     * Creates a new renderer instance.
     * Call initialize() before using.
     *
     * @param device - WebGPU device for GPU operations.
     * @param context - WebGPU canvas context for presenting frames.
     * @param displaySize - Render target resolution in pixels.
     */
    constructor(device: GPUDevice, context: GPUCanvasContext, displaySize: Vector2i) {
        this.device = device;
        this.context = context;
        this.displaySize = displaySize;
        this.primitives = new PrimitivePipeline();
        this.sprites = new SpritePipeline();
    }

    // #endregion

    // #region Initialization

    /**
     * Initializes GPU resources: pipelines, buffers and samplers.
     * Must be called before any rendering operations.
     *
     * @returns Promise resolving to true if initialization succeeded.
     */
    async initialize(): Promise<boolean> {
        try {
            await this.primitives.initialize(this.device, this.displaySize);
            await this.sprites.initialize(this.device, this.displaySize);

            return true;
        } catch (error) {
            console.error('[Renderer] Initialization failed:', error);

            return false;
        }
    }

    // #endregion

    // #region Frame Management

    /**
     * Begins a new render frame.
     * Resets all frame states, including vertex counts, sprite batches, and texture bindings.
     * Safe to call multiple times - defensively resets all states to prevent corruption.
     */
    beginFrame(): void {
        this.primitives.reset();
        this.sprites.reset();
    }

    /**
     * Sets the background clear color for this frame.
     *
     * @param color - Color to clear the screen with.
     */
    setClearColor(color: Color32): void {
        this.currentClearColor = color.clone();
    }

    /**
     * Ends the current frame and presents to the screen.
     * Executes render passes for both pipelines and submits to GPU.
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

        this.primitives.encodePass(renderPass);
        this.sprites.encodePass(renderPass);

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);

        // Reset for next frame.
        this.primitives.reset();
        this.sprites.reset();
    }

    // #endregion

    // #region Primitive Drawing

    /**
     * Draws a filled rectangle using two triangles.
     *
     * @param rect - Rectangle bounds in pixel coordinates.
     * @param color - Fill color.
     */
    drawRectFill(rect: Rect2i, color: Color32): void {
        this.primitives.drawRectFill(rect, color);
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
        this.primitives.drawText(pos, color, text);
    }

    /**
     * Draws a single pixel as a 1x1 filled rectangle.
     *
     * @param pos - Pixel position.
     * @param color - Pixel color.
     */
    drawPixel(pos: Vector2i, color: Color32): void {
        this.primitives.drawPixel(pos, color);
    }

    /**
     * Draws a single pixel at raw coordinates.
     * More efficient than drawPixel() as it avoids Vector2i parameter.
     * Use this in hot paths where you have x, y values directly.
     *
     * @param x - X position.
     * @param y - Y position.
     * @param color - Pixel color.
     * @returns Nothing.
     */
    drawPixelXY(x: number, y: number, color: Color32): void {
        this.primitives.drawPixelXY(x, y, color);
    }

    /**
     * Draws a line using optimized quad rendering for axis-aligned lines,
     * falling back to Bresenham's algorithm for diagonal lines.
     *
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Line color.
     */
    drawLine(p0: Vector2i, p1: Vector2i, color: Color32): void {
        this.primitives.drawLine(p0, p1, color);
    }

    /**
     * Draws a rectangle outline using four 1-pixel quads.
     *
     * @param rect - Rectangle bounds.
     * @param color - Outline color.
     */
    drawRect(rect: Rect2i, color: Color32): void {
        this.primitives.drawRect(rect, color);
    }

    /**
     * Fills a rectangular region with a solid color.
     *
     * @param color - Fill color.
     * @param rect - Region to fill.
     */
    clearRect(color: Color32, rect: Rect2i): void {
        this.primitives.clearRect(color, rect);
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

    // #region Camera

    /**
     * Sets the camera offset for scrolling.
     * This amount offsets all drawing operations.
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
}
