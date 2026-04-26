import type { BitmapFont } from '../assets/BitmapFont';
import type { Palette } from '../assets/Palette';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import { FrameCapture } from '../utils/FrameCapture';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { Effect } from './effects/Effect';
import { PostProcessChain } from './PostProcessChain';
import { PrimitivePipeline } from './PrimitivePipeline';
import { SpritePipeline } from './SpritePipeline';
import type { UpscaleFilter } from './UpscalePass';
import { UpscalePass } from './UpscalePass';

// #region Configuration

/**
 * GPU palette uniform buffer size: 256 entries x 4 floats x 4 bytes = 4096 bytes.
 */
const PALETTE_BUFFER_SIZE = 256 * 4 * 4;

/**
 * Texture usage flags for the offscreen scene framebuffer.
 *
 * `RENDER_ATTACHMENT` so primitive/sprite pipelines can draw into it,
 * `TEXTURE_BINDING` so the pixel chain (or upscale pass) can sample it.
 */
const SCENE_TARGET_USAGE = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

// #endregion

/**
 * High-level renderer that coordinates primitive and sprite pipelines.
 *
 * `Renderer` owns frame begin/end, clear color, camera state, palette buffer,
 * frame capture, and the two-tier post-process pipeline. Actual draw batching
 * is delegated to {@link PrimitivePipeline} and {@link SpritePipeline}.
 *
 * Per-frame stage flow when post-process is active:
 *
 * ```text
 * scene -> sceneTex (logical res)
 *       -> [pixel chain]
 *       -> upscaledTex (output res)
 *       -> [display chain]
 *       -> swap chain
 * ```
 *
 * Stages are skipped when their inputs are inactive. With both chains empty
 * and `canvasDisplaySize` matching `displaySize`, the renderer draws straight
 * to the swap chain (zero offscreen allocations).
 */
export class Renderer {
    // #region State

    /** WebGPU device for GPU operations. */
    private readonly device: GPUDevice;

    /** WebGPU canvas context for presenting frames. */
    private context: GPUCanvasContext;

    /** Logical render target resolution in pixels (`displaySize`). */
    private readonly displaySize: Vector2i;

    /** Output drawing-buffer size in pixels (matches the swap chain). */
    private readonly outputSize: Vector2i;

    /** Magnification filter used between the pixel chain and the display chain. */
    private readonly upscaleFilterMode: UpscaleFilter;

    /** True when the swap chain is larger than the logical framebuffer. */
    private readonly hasUpscale: boolean;

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

    /**
     * True after {@link setPalette} is called, guaranteeing at least one upload
     * even when the palette was never mutated via {@link Palette.set}.
     * Per-frame mutations are detected separately via {@link Palette.dirty}.
     */
    private paletteDirty: boolean = false;

    // #endregion

    // #region Pipelines

    /** Pipeline for palette-indexed geometry (pixels, lines, rectangles). */
    private readonly primitives: PrimitivePipeline;

    /** Pipeline for textured quads (sprites, bitmap text). */
    private readonly sprites: SpritePipeline;

    /** Pixel-tier post-process chain (logical resolution). */
    private pixelChain: PostProcessChain | null = null;

    /** Display-tier post-process chain (output resolution). */
    private displayChain: PostProcessChain | null = null;

    /** Pass that copies the logical framebuffer to the output buffer. */
    private upscalePass: UpscalePass | null = null;

    /** Logical-resolution scene framebuffer; allocated lazily. */
    private sceneTex: GPUTexture | null = null;
    private sceneTexView: GPUTextureView | null = null;

    /** Cached swap-chain format used by lazy texture creation. */
    private swapFormat: GPUTextureFormat | null = null;

    // #endregion

    // #region Constructor

    /**
     * Creates a renderer bound to an initialized device and canvas context.
     *
     * @param device - WebGPU device for GPU operations.
     * @param context - WebGPU canvas context for presenting frames.
     * @param displaySize - Logical render resolution in pixels.
     * @param outputSize - Output drawing-buffer resolution in pixels (matches the
     *   swap chain). Defaults to `displaySize` (no upscaling, no display-tier
     *   effects).
     * @param upscaleFilter - Magnification filter for the upscale pass. Defaults to
     *   `'nearest'`.
     */
    constructor(
        device: GPUDevice,
        context: GPUCanvasContext,
        displaySize: Vector2i,
        outputSize?: Vector2i,
        upscaleFilter: UpscaleFilter = 'nearest',
    ) {
        this.device = device;
        this.context = context;
        this.displaySize = displaySize.clone();
        this.outputSize = (outputSize ?? displaySize).clone();
        this.upscaleFilterMode = upscaleFilter;
        this.hasUpscale = this.outputSize.x !== this.displaySize.x || this.outputSize.y !== this.displaySize.y;
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

            // Mark the palette dirty so the new buffer is populated on the first
            // endFrame(), even if the palette data has not changed since the last
            // initialize() call (e.g. after a WebGPU device-loss recovery).
            this.paletteDirty = true;

            // Primitive and sprite pipelines run at logical resolution. The
            // viewport is automatic since each pass binds a target view; only
            // the camera scaling here cares about logical size.
            await this.primitives.initialize(this.device, this.displaySize, this.paletteBuffer);
            await this.sprites.initialize(this.device, this.displaySize, this.paletteBuffer);

            this.swapFormat = navigator.gpu.getPreferredCanvasFormat();

            // Pixel chain operates at logical resolution (320x240 etc.).
            this.pixelChain = new PostProcessChain(this.device, this.swapFormat, this.displaySize, 'pixel');

            // Display chain operates at output resolution. When there is no
            // upscale (output == logical), display-tier effects still run, but
            // they sample the same-size source. We allocate the chain regardless
            // so the rest of the engine can introspect it.
            this.displayChain = new PostProcessChain(this.device, this.swapFormat, this.outputSize, 'display');

            // Upscale pass between the two tiers; only used when sizes differ.
            this.upscalePass = new UpscalePass();
            this.upscalePass.init(this.device, this.swapFormat, this.upscaleFilterMode);

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
     * Stores a reference to the supplied palette — no clone is made. Subsequent
     * calls to {@link Palette.set} or {@link Palette.copyFrom} on the same object
     * will be detected via {@link Palette.dirty} and uploaded automatically at the
     * start of the next frame. {@link paletteDirty} is set to guarantee the initial
     * upload even when the palette has never been mutated through {@link Palette.set}.
     *
     * @param palette - Palette to use for color lookups and GPU upload.
     */
    setPalette(palette: Palette): void {
        this.palette = palette;
        this.paletteDirty = true;

        // If the new palette is smaller than the current clear index, reset to 0
        // (transparent) so resolveClearColor does not warn on every endFrame().
        if (this.clearPaletteIndex >= this.palette.size) {
            this.clearPaletteIndex = 0;
        }
    }

    /**
     * Returns a snapshot of the active palette, or null if none has been set.
     *
     * Returns a clone to prevent callers from accidentally mutating the active
     * palette through the returned reference in ways that may be surprising.
     * To intentionally update palette colors, mutate the original palette object
     * that was passed to {@link setPalette} — changes will auto-propagate via the
     * dirty flag on the next frame.
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
     *
     * Routing in priority order:
     * 1. Render scene to the appropriate first-stage view.
     * 2. Encode pixel chain (if active) -> destination is upscale input or swap chain.
     * 3. Encode upscale pass (if upscaling and display chain inactive: write to swap;
     *    if display chain active: write to display-chain input).
     * 4. Encode display chain (if active) -> swap chain.
     */
    endFrame(): void {
        const swapTexture = this.acquireSwapTexture();

        if (!swapTexture) {
            return;
        }

        this.flushPaletteIfDirty();

        const swapChainView = swapTexture.createView();
        const commandEncoder = this.device.createCommandEncoder({ label: 'Render Commands' });
        const pixelActive = this.pixelChain?.isActive() ?? false;
        const displayActive = this.displayChain?.isActive() ?? false;
        const sceneView = this.resolveSceneView(swapChainView, pixelActive, displayActive);

        this.encodeScenePass(commandEncoder, sceneView);
        this.encodePostProcess(commandEncoder, swapChainView, pixelActive, displayActive);
        this.submitFrame(commandEncoder, swapTexture);
    }

    /**
     * Tries to acquire the swap-chain texture and validate its dimensions.
     * Returns null and resets pipeline state when the texture is unavailable.
     *
     * @returns Current swap-chain texture, or null when the frame must be skipped.
     */
    private acquireSwapTexture(): GPUTexture | null {
        let swapTexture: GPUTexture;

        try {
            swapTexture = this.context.getCurrentTexture();
        } catch (error) {
            console.error('[Renderer] Failed to get current texture:', error);
            this.primitives.reset();
            this.sprites.reset();
            return null;
        }

        if (swapTexture.width === 0 || swapTexture.height === 0) {
            console.warn('[Renderer] Texture has zero dimensions, skipping frame');
            this.primitives.reset();
            this.sprites.reset();
            return null;
        }

        return swapTexture;
    }

    /**
     * Uploads the palette uniform buffer when the active palette has changed
     * since the last frame.
     */
    private flushPaletteIfDirty(): void {
        if (this.palette && this.paletteBuffer && (this.paletteDirty || this.palette.dirty)) {
            this.palette.toFloat32ArrayInto(this.paletteStaging);
            this.device.queue.writeBuffer(this.paletteBuffer, 0, this.paletteStaging);
            this.paletteDirty = false;
            this.palette.clearDirty();
        }
    }

    /**
     * Encodes the primitive + sprite scene render pass into the supplied target view.
     *
     * @param encoder - Active command encoder.
     * @param sceneView - View to render the scene into.
     */
    private encodeScenePass(encoder: GPUCommandEncoder, sceneView: GPUTextureView): void {
        const clearColor = this.resolveClearColor();
        const renderPass = encoder.beginRenderPass({
            label: 'Render Pass',
            colorAttachments: [
                {
                    view: sceneView,
                    // WebGPU expects linear 0-1 floats; Color32 stores 0-255 integers.
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
    }

    /**
     * Encodes the optional pixel chain, upscale pass, and display chain in the
     * correct order based on which chains are active.
     *
     * @param encoder - Active command encoder.
     * @param swapChainView - Current swap-chain view (final destination).
     * @param pixelActive - Whether the pixel chain has any registered effects.
     * @param displayActive - Whether the display chain has any registered effects.
     */
    private encodePostProcess(
        encoder: GPUCommandEncoder,
        swapChainView: GPUTextureView,
        pixelActive: boolean,
        displayActive: boolean,
    ): void {
        if (pixelActive && this.pixelChain) {
            const dest = this.pixelChainDestView(swapChainView, displayActive);
            this.pixelChain.encode(encoder, 0, dest);
        }

        if (this.hasUpscale && this.upscalePass) {
            const upscaleSrc = this.requireSceneTexView();
            const upscaleDest = displayActive ? this.requireDisplayChainInput() : swapChainView;
            this.upscalePass.encode(encoder, upscaleSrc, upscaleDest);
        }

        if (displayActive && this.displayChain) {
            this.displayChain.encode(encoder, 0, swapChainView);
        }
    }

    /**
     * Adds the optional frame-capture readback, submits the command buffer,
     * and resets per-frame pipeline state.
     *
     * @param encoder - Active command encoder.
     * @param swapTexture - Current swap-chain texture (capture source).
     */
    private submitFrame(encoder: GPUCommandEncoder, swapTexture: GPUTexture): void {
        const capturing = this.frameCapture.hasPendingCapture();

        if (capturing) {
            this.frameCapture.executeCaptureInEncoder(this.device, swapTexture, encoder);
        }

        this.device.queue.submit([encoder.finish()]);

        if (capturing) {
            void this.frameCapture.resolveCapture(this.device);
        }

        // Defensive reset so the pipeline state is clean even if beginFrame() is not
        // called next. beginFrame() also resets; this prevents stale data from
        // persisting across frames.
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
     * Draws a single pixel as a 1x1 filled rectangle.
     *
     * @param pos - Pixel position.
     * @param paletteIndex - Palette color index.
     */
    drawPixel(pos: Vector2i, paletteIndex: number): void {
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
     * Draws a sprite region from an indexed sprite sheet.
     *
     * @param spriteSheet - Source sprite sheet (must have been indexized).
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw at.
     * @param paletteOffset - Palette index offset applied at draw time (default 0).
     */
    drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, paletteOffset: number = 0): void {
        this.sprites.drawSprite(spriteSheet, srcRect, destPos, paletteOffset);
    }

    /**
     * Draws text using a bitmap font through the indexed sprite pipeline.
     * Renders each character as a textured sprite.
     *
     * @param font - Bitmap font with character glyphs (underlying sheet must be indexized).
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param paletteOffset - Palette index offset applied to all glyphs (default 0).
     */
    drawBitmapText(font: BitmapFont, pos: Vector2i, text: string, paletteOffset: number = 0): void {
        this.sprites.drawBitmapText(font, pos, text, paletteOffset);
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

    // #region Post-Process Effects

    /**
     * Appends a fullscreen post-processing effect to the chain matching its
     * declared {@link Effect.tier}.
     *
     * - `tier='pixel'` -> pixel chain (logical resolution).
     * - `tier='display'` -> display chain (output resolution); requires
     *   `canvasDisplaySize` to be set in `queryHardware()`.
     *
     * @param effect - Effect instance to append.
     * @throws If the renderer has not been initialized.
     * @throws If a `'display'` effect is added while the output drawing buffer
     *   matches the logical display size (no canvasDisplaySize was set).
     */
    addEffect(effect: Effect): void {
        if (!this.pixelChain || !this.displayChain) {
            throw new Error('Renderer.addEffect: renderer not initialized.');
        }

        if (effect.tier === 'display' && !this.hasUpscale) {
            throw new Error(
                'Renderer.addEffect: display-tier effects require canvasDisplaySize ' +
                    'in queryHardware() (output drawing buffer must be larger than logical displaySize).',
            );
        }

        const chain = effect.tier === 'pixel' ? this.pixelChain : this.displayChain;
        chain.add(effect);
    }

    /**
     * Removes a previously registered post-processing effect.
     *
     * Searches both tiers and disposes the effect from whichever chain holds
     * it. Removing an effect that was never added is a no-op.
     *
     * @param effect - Effect instance to remove.
     * @throws If the renderer has not been initialized.
     */
    removeEffect(effect: Effect): void {
        if (!this.pixelChain || !this.displayChain) {
            throw new Error('Renderer.removeEffect: renderer not initialized.');
        }

        // Try pixel chain first; if not found, try display chain.
        if (!this.pixelChain.remove(effect)) {
            this.displayChain.remove(effect);
        }
    }

    /**
     * Removes every registered post-processing effect across both tiers.
     *
     * @throws If the renderer has not been initialized.
     */
    clearEffects(): void {
        if (!this.pixelChain || !this.displayChain) {
            throw new Error('Renderer.clearEffects: renderer not initialized.');
        }

        this.pixelChain.clear();
        this.displayChain.clear();
    }

    // #endregion

    // #region Private Helpers

    /**
     * Picks the texture view the scene render pass should target this frame.
     *
     * @param swapChainView - View of the current swap-chain texture.
     * @param pixelActive - Whether the pixel chain has any registered effects.
     * @param displayActive - Whether the display chain has any registered effects.
     * @returns Stable view to render the scene into.
     */
    private resolveSceneView(
        swapChainView: GPUTextureView,
        pixelActive: boolean,
        displayActive: boolean,
    ): GPUTextureView {
        if (pixelActive && this.pixelChain) {
            return this.pixelChain.getInputView();
        }

        if (this.hasUpscale) {
            // Need an offscreen at logical resolution before upscaling.
            return this.requireSceneTexView();
        }

        if (displayActive && this.displayChain) {
            return this.displayChain.getInputView();
        }

        return swapChainView;
    }

    /**
     * Picks the destination view for the pixel chain's last pass.
     *
     * @param swapChainView - View of the current swap-chain texture.
     * @param displayActive - Whether the display chain has any registered effects.
     * @returns Destination view for the final pixel-chain pass.
     */
    private pixelChainDestView(swapChainView: GPUTextureView, displayActive: boolean): GPUTextureView {
        if (this.hasUpscale) {
            return this.requireSceneTexView();
        }

        if (displayActive && this.displayChain) {
            return this.displayChain.getInputView();
        }

        return swapChainView;
    }

    /**
     * Lazily allocates the logical-resolution scene framebuffer and returns its view.
     *
     * @returns Stable view of the scene framebuffer.
     */
    private requireSceneTexView(): GPUTextureView {
        if (!this.sceneTexView) {
            if (!this.swapFormat) {
                throw new Error('Renderer.requireSceneTexView: swap format not initialized.');
            }
            this.sceneTex = this.device.createTexture({
                label: 'Renderer Scene Framebuffer',
                size: { width: this.displaySize.x, height: this.displaySize.y, depthOrArrayLayers: 1 },
                format: this.swapFormat,
                usage: SCENE_TARGET_USAGE,
            });
            this.sceneTexView = this.sceneTex.createView();
        }

        return this.sceneTexView;
    }

    /**
     * Returns the display chain's input view, which becomes the upscale pass's
     * destination when the display chain is active.
     *
     * @returns Stable input view of the display chain.
     */
    private requireDisplayChainInput(): GPUTextureView {
        const chain = this.displayChain;
        if (!chain?.isActive()) {
            throw new Error('Renderer.requireDisplayChainInput: display chain inactive.');
        }
        return chain.getInputView();
    }

    // #endregion

    // #region Private — drawing

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
