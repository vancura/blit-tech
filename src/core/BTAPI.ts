import type { BitmapFont } from '../assets/BitmapFont';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Renderer } from '../render/Renderer';
import type { Color32 } from '../utils/Color32';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { GameLoop } from './GameLoop';
import type { HardwareSettings, IBlitTechDemo } from './IBlitTechDemo';
import { initializeWebGPU } from './WebGPUContext';

/**
 * Central runtime facade for Blit-Tech engine services.
 *
 * `BTAPI` owns engine initialization, keeps references to the active WebGPU
 * objects and renderer, and exposes the drawing/camera methods used by demos.
 * It is a singleton; access it through `BTAPI.instance`.
 */
export class BTAPI {
    // #region Version Constants

    /**
     * Major semantic-version component.
     */
    public static readonly VERSION_MAJOR = 0;

    /** Minor version number. */
    public static readonly VERSION_MINOR = 2;

    /** Patch version number. */
    public static readonly VERSION_PATCH = 0;

    // #endregion

    // #region Module State - Demo Instance

    /** Current demo instance implementing IBlitTechDemo. */
    private demo: IBlitTechDemo | null = null;

    // #endregion

    // #region Module State - Hardware Settings

    /** Hardware configuration settings from the demo. */
    private hwSettings: HardwareSettings | null = null;

    /** WebGPU device for GPU operations. */
    private device: GPUDevice | null = null;

    // #endregion

    // #region Module State - WebGPU Resources

    /** WebGPU canvas context for presenting frames. */
    private context: GPUCanvasContext | null = null;

    /** HTML canvas element used for rendering. */
    private canvas: HTMLCanvasElement | null = null;

    /** Renderer subsystem for all drawing operations. */
    private renderer: Renderer | null = null;

    // #endregion

    // #region Module State - Subsystems

    /** Game loop managing fixed-timestep updates and variable-rate rendering. */
    private loop: GameLoop | null = null;

    // TODO: Additional subsystems for future implementation:
    // InputManager, AudioManager, EffectsManager, AssetManager

    // #endregion

    // #region Singleton / Constructor

    /** Singleton instance of BTAPI. */
    private static _instance: BTAPI | null = null;

    /**
     * Private constructor to enforce singleton access via `BTAPI.instance`.
     */
    private constructor() {}

    // #endregion

    // #region Singleton Access

    /**
     * Gets the lazily created singleton instance.
     *
     * @returns The global BTAPI instance.
     */
    public static get instance(): BTAPI {
        if (!BTAPI._instance) {
            BTAPI._instance = new BTAPI();
        }

        return BTAPI._instance;
    }

    // #endregion

    // #region Initialization

    /**
     * Initializes the engine for a demo and starts the main loop on success.
     *
     * The initialization sequence is:
     * - query hardware settings from the demo
     * - initialize WebGPU and create the renderer
     * - run the demo's async `initialize()`
     * - start the fixed-timestep game loop
     *
     * @param demo - Demo implementing the IBlitTechDemo interface.
     * @param canvas - HTML canvas element for WebGPU rendering.
     * @returns `true` when initialization succeeds; otherwise `false`.
     */
    public async initialize(demo: IBlitTechDemo, canvas: HTMLCanvasElement): Promise<boolean> {
        console.log(`[BT] Initializing engine v${BTAPI.VERSION_MAJOR}.${BTAPI.VERSION_MINOR}.${BTAPI.VERSION_PATCH}`);

        this.demo = demo;
        this.canvas = canvas;

        // Query hardware settings from the demo.
        console.log('[BT] Querying hardware settings');

        this.hwSettings = demo.queryHardware();

        const { targetFPS } = this.hwSettings;

        if (!Number.isFinite(targetFPS) || targetFPS <= 0) {
            console.error(`[BT] Invalid targetFPS: ${targetFPS}. Must be a finite number > 0.`);

            return false;
        }

        const updateInterval = 1000 / targetFPS;

        console.log('[BT] Hardware settings:', {
            displaySize: `${this.hwSettings.displaySize.x}x${this.hwSettings.displaySize.y}`,
            targetFPS: this.hwSettings.targetFPS,
        });

        // Initialize WebGPU.
        const webGPUResult = await initializeWebGPU(
            canvas,
            this.hwSettings.displaySize,
            this.hwSettings.canvasDisplaySize,
        );

        if (!webGPUResult) {
            console.error('[BT] Failed to initialize WebGPU');

            return false;
        }

        this.device = webGPUResult.device;
        this.context = webGPUResult.context;

        // Initialize subsystems.
        console.log('[BT] Initializing renderer');

        this.renderer = new Renderer(this.device, this.context, this.hwSettings.displaySize);

        if (!(await this.renderer.initialize())) {
            console.error('[BT] Failed to initialize renderer');

            return false;
        }

        console.log('[BT] Renderer initialized');

        // TODO: Initialize input, audio, etc.

        // Initialize the demo.
        console.log('[BT] Initializing demo');

        if (!(await demo.initialize())) {
            console.error('[BT] Demo initialization failed');

            return false;
        }

        // Start the loop. The GameLoop's double-RAF delay ensures the canvas is
        // fully ready before the first tick.
        this.loop = new GameLoop(
            updateInterval,
            () => this.demo?.update(),
            () => {
                if (this.renderer) {
                    this.renderer.beginFrame();
                    this.demo?.render();
                    this.renderer.endFrame();
                }
            },
        );

        this.loop.start();

        console.log('[BT] Initialization complete');

        return true;
    }

    /**
     * Stops the active game loop if one exists.
     */
    public stop(): void {
        this.loop?.stop();
    }

    // #endregion

    // #region Demo State Accessors

    /**
     * Gets the current tick count.
     * Ticks increment once per the fixed update (e.g., 60 times/second at 60 FPS).
     *
     * @returns Number of update ticks since initialization or last reset.
     */
    public getTicks(): number {
        return this.loop?.getTicks() ?? 0;
    }

    /**
     * Resets the tick counter to zero.
     * Useful for timing-based demo events and animations.
     */
    public resetTicks(): void {
        this.loop?.resetTicks();
    }

    /**
     * Gets the hardware settings returned by the active demo.
     *
     * @returns Hardware configuration, or null if not initialized.
     */
    public getHardwareSettings(): HardwareSettings | null {
        return this.hwSettings;
    }

    // #endregion

    // #region WebGPU Resource Accessors

    /**
     * Gets the initialized WebGPU device.
     *
     * @returns GPU device, or null if not initialized.
     */
    public getDevice(): GPUDevice | null {
        return this.device;
    }

    /**
     * Gets the configured WebGPU canvas context.
     *
     * @returns Canvas context, or null if not initialized.
     */
    public getContext(): GPUCanvasContext | null {
        return this.context;
    }

    /**
     * Gets the canvas bound during initialization.
     *
     * @returns HTML canvas element, or null if not initialized.
     */
    public getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    /**
     * Gets the renderer created during initialization.
     *
     * @returns Renderer instance, or null if not initialized.
     */
    public getRenderer(): Renderer | null {
        return this.renderer;
    }

    // #endregion

    // #region Rendering API - Clear Operations

    /**
     * Sets the background clear color for each frame.
     *
     * @param color - Color to clear the screen with.
     */
    public setClearColor(color: Color32): void {
        this.renderer?.setClearColor(color);
    }

    /**
     * Fills a rectangular region with a solid color.
     *
     * @param color - Fill color.
     * @param rect - Region to fill in pixel coordinates.
     */
    public clearRect(color: Color32, rect: Rect2i): void {
        this.renderer?.clearRect(color, rect);
    }

    // #endregion

    // #region Rendering API - Primitives

    /**
     * Draws a single pixel at the specified position.
     *
     * @param pos - Pixel coordinates.
     * @param color - Pixel color.
     */
    public drawPixel(pos: Vector2i, color: Color32): void {
        this.renderer?.drawPixel(pos, color);
    }

    /**
     * Draws a line between two points using Bresenham's algorithm.
     * Produces pixel-perfect lines without antialiasing.
     *
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Line color.
     */
    public drawLine(p0: Vector2i, p1: Vector2i, color: Color32): void {
        this.renderer?.drawLine(p0, p1, color);
    }

    /**
     * Draws a rectangle outline (unfilled).
     *
     * @param rect - Rectangle bounds.
     * @param color - Outline color.
     */
    public drawRect(rect: Rect2i, color: Color32): void {
        this.renderer?.drawRect(rect, color);
    }

    /**
     * Draws a filled rectangle.
     *
     * @param rect - Rectangle bounds.
     * @param color - Fill color.
     */
    public drawRectFill(rect: Rect2i, color: Color32): void {
        this.renderer?.drawRectFill(rect, color);
    }

    /**
     * Draws placeholder text (simple rectangle blocks).
     * For proper text rendering, use drawBitmapText() instead.
     *
     * @param pos - Text position (top-left corner).
     * @param color - Text color.
     * @param text - String to display.
     */
    public drawText(pos: Vector2i, color: Color32, text: string): void {
        this.renderer?.drawText(pos, color, text);
    }

    // #endregion

    // #region Rendering API - Sprites

    /**
     * Draws a sprite region from a sprite sheet.
     * The renderer may batch compatible sprite draws internally.
     *
     * @param spriteSheet - Source sprite sheet texture.
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw in (the top-left corner).
     * @param tint - Optional tint color (defaults to white = no tint).
     */
    public drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint?: Color32): void {
        this.renderer?.drawSprite(spriteSheet, srcRect, destPos, tint);
    }

    /**
     * Draws text using a bitmap font with variable-width glyphs.
     * Supports Unicode characters and per-glyph render offsets.
     *
     * @param font - Bitmap font containing character glyphs.
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param color - Optional text color (defaults to white).
     */
    public drawBitmapText(font: BitmapFont, pos: Vector2i, text: string, color?: Color32): void {
        this.renderer?.drawBitmapText(font, pos, text, color);
    }

    // #endregion

    // #region Frame Capture API

    /**
     * Captures the next rendered frame as a PNG blob.
     * The capture occurs on the next completed render cycle.
     *
     * @returns Promise resolving to a PNG Blob.
     * @throws Error if the renderer is not initialized.
     */
    public captureFrame(): Promise<Blob> {
        if (!this.renderer) {
            return Promise.reject(new Error("[BT] Can't capture frame: renderer not initialized"));
        }

        return this.renderer.captureFrame();
    }

    // #endregion

    // #region Camera API

    /**
     * Sets the camera offset for scrolling effects.
     * The offset is applied to subsequent renderer draw calls.
     *
     * @param offset - Camera position offset in pixels.
     */
    public setCameraOffset(offset: Vector2i): void {
        this.renderer?.setCameraOffset(offset);
    }

    /**
     * Gets the current camera offset.
     *
     * @returns Current camera position offset.
     */
    public getCameraOffset(): Vector2i {
        return this.renderer?.getCameraOffset() ?? Vector2i.zero();
    }

    /**
     * Resets the camera offset to (0, 0).
     */
    public resetCamera(): void {
        this.renderer?.resetCamera();
    }

    // #endregion
}
