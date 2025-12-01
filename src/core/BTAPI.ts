import type { BitmapFont } from '../assets/BitmapFont';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Renderer } from '../render/Renderer';
import type { Color32 } from '../utils/Color32';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { HardwareSettings, IBlitTechGame } from './IBlitTechGame';

/**
 * Internal API coordinator for all Blit-Tech subsystems.
 * This is similar to RetroBlit's RBAPI class.
 *
 * Manages the lifecycle of all engine subsystems and coordinates
 * the game loop. This is a singleton - use BTAPI.instance to access.
 */
export class BTAPI {
    // Version info
    public static readonly VERSION_MAJOR = 0;
    public static readonly VERSION_MINOR = 1;
    public static readonly VERSION_PATCH = 0;

    // Singleton instance
    private static _instance: BTAPI | null = null;

    // Game instance
    private game: IBlitTechGame | null = null;

    // Hardware settings
    private hwSettings: HardwareSettings | null = null;

    // WebGPU context
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private canvas: HTMLCanvasElement | null = null;

    // Subsystems
    private renderer: Renderer | null = null;
    // private inputManager: InputManager | null = null;
    // private audioManager: AudioManager | null = null;
    // private effectsManager: EffectsManager | null = null;
    // private fontRenderer: FontRenderer | null = null;
    // private assetManager: AssetManager | null = null;

    // Game loop state
    private isRunning: boolean = false;
    private ticks: number = 0;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000 / 60; // 60 FPS default
    private accumulator: number = 0;

    /**
     * Private constructor to enforce singleton pattern.
     * Use BTAPI.instance to access the singleton.
     */
    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Gets the singleton BTAPI instance.
     * Creates the instance on first access.
     * @returns The global BTAPI instance.
     */
    public static get instance(): BTAPI {
        if (!BTAPI._instance) {
            BTAPI._instance = new BTAPI();
        }
        return BTAPI._instance;
    }

    /**
     * Initializes the engine with a game instance and canvas.
     * Sets up WebGPU, creates renderer, and starts the game loop.
     * @param game - Game implementing the IBlitTechGame interface.
     * @param canvas - HTML canvas element for WebGPU rendering.
     * @returns Promise resolving to true if initialization succeeded.
     */
    public async initialize(game: IBlitTechGame, canvas: HTMLCanvasElement): Promise<boolean> {
        console.log(
            `[BlitTech] Initializing engine v${BTAPI.VERSION_MAJOR}.${BTAPI.VERSION_MINOR}.${BTAPI.VERSION_PATCH}`,
        );

        this.game = game;
        this.canvas = canvas;

        // Query hardware settings from game
        console.log('[BlitTech] Querying hardware settings...');
        this.hwSettings = game.queryHardware();
        this.updateInterval = 1000 / this.hwSettings.targetFPS;

        console.log('[BlitTech] Hardware settings:', {
            displaySize: `${this.hwSettings.displaySize.x}x${this.hwSettings.displaySize.y}`,
            targetFPS: this.hwSettings.targetFPS,
        });

        // Initialize WebGPU
        if (!(await this.initializeWebGPU())) {
            console.error('[BlitTech] Failed to initialize WebGPU');
            return false;
        }

        // Initialize subsystems
        console.log('[BlitTech] Initializing renderer...');
        // Safe assertion: initializeWebGPU sets device and context before this point
        this.renderer = new Renderer(
            this.device as GPUDevice,
            this.context as GPUCanvasContext,
            this.hwSettings.displaySize,
        );
        if (!(await this.renderer.initialize())) {
            console.error('[BlitTech] Failed to initialize renderer');
            return false;
        }
        console.log('[BlitTech] Renderer initialized');

        // TODO: Initialize input, audio, etc.

        // Initialize game
        console.log('[BlitTech] Initializing game...');
        if (!(await game.initialize())) {
            console.error('[BlitTech] Game initialization failed');
            return false;
        }

        // Start game loop
        this.startGameLoop();

        console.log('[BlitTech] Initialization complete!');
        return true;
    }

    /**
     * Initializes the WebGPU adapter, device, and canvas context.
     * Configures the canvas for the game's display resolution.
     * @returns Promise resolving to true if WebGPU setup succeeded.
     */
    private async initializeWebGPU(): Promise<boolean> {
        if (!navigator.gpu) {
            console.error('[BlitTech] WebGPU is not supported in this browser.');
            console.error('[BlitTech] Please use Chrome/Edge 113+ or Firefox Nightly with WebGPU enabled.');
            console.error('[BlitTech] See: https://caniuse.com/webgpu');
            return false;
        }

        // Request adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error('[BlitTech] Failed to get WebGPU adapter.');
            console.error('[BlitTech] This could mean:');
            console.error('[BlitTech]   1. Your GPU/drivers are too old');
            console.error('[BlitTech]   2. WebGPU is disabled in browser settings');
            console.error('[BlitTech]   3. Running in incompatible environment (VM, remote desktop, etc.)');
            console.error('[BlitTech] Browser:', navigator.userAgent);
            return false;
        }

        // Request device
        this.device = await adapter.requestDevice();
        if (!this.device) {
            console.error('[BlitTech] Failed to get WebGPU device');
            return false;
        }

        // Configure canvas
        // Guard: canvas is set in initialize() before this method is called
        if (!this.canvas || !this.hwSettings) {
            console.error('[BlitTech] Canvas or hardware settings not initialized');
            return false;
        }

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        if (!this.context) {
            console.error('[BlitTech] Failed to get WebGPU context');
            return false;
        }

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: canvasFormat,
            alphaMode: 'premultiplied',
        });

        // Set canvas resolution to match display size from game
        // Note: This sets the internal pixel resolution, NOT the CSS display size
        this.canvas.width = this.hwSettings.displaySize.x;
        this.canvas.height = this.hwSettings.displaySize.y;

        // Set CSS display size if specified (for upscaling)
        if (this.hwSettings.canvasDisplaySize) {
            this.canvas.style.width = `${this.hwSettings.canvasDisplaySize.x}px`;
            this.canvas.style.height = `${this.hwSettings.canvasDisplaySize.y}px`;
            console.log(
                `[BlitTech] Canvas display size: ${this.hwSettings.canvasDisplaySize.x}x${this.hwSettings.canvasDisplaySize.y}`,
            );
        }

        console.log('[BlitTech] WebGPU initialized successfully');
        return true;
    }

    /**
     * Starts the main game loop using requestAnimationFrame.
     * Implements a fixed timestep for update() and variable rate for render().
     */
    private startGameLoop(): void {
        this.isRunning = true;
        this.lastUpdateTime = performance.now();

        const loop = (currentTime: number) => {
            if (!this.isRunning) return;

            // Calculate delta time
            const deltaTime = currentTime - this.lastUpdateTime;
            this.lastUpdateTime = currentTime;

            // Accumulator for fixed timestep
            this.accumulator += deltaTime;

            // Fixed update loop (run at target FPS)
            while (this.accumulator >= this.updateInterval) {
                if (this.game) {
                    this.game.update();
                }
                this.ticks++;
                this.accumulator -= this.updateInterval;
            }

            // Variable render loop
            if (this.game && this.renderer) {
                this.renderer.beginFrame();
                this.game.render();
                this.renderer.endFrame();
            }

            // Continue loop
            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    /**
     * Stops the game loop.
     * The loop will exit after the current frame completes.
     */
    public stop(): void {
        this.isRunning = false;
    }

    /**
     * Gets the current tick count.
     * Ticks increment once per fixed update (e.g., 60 times/second at 60 FPS).
     * @returns Number of update ticks since initialization or last reset.
     */
    public getTicks(): number {
        return this.ticks;
    }

    /**
     * Resets the tick counter to zero.
     * Useful for timing-based game events.
     */
    public resetTicks(): void {
        this.ticks = 0;
    }

    /**
     * Gets the current hardware settings.
     * @returns Hardware configuration, or null if not initialized.
     */
    public getHardwareSettings(): HardwareSettings | null {
        return this.hwSettings;
    }

    /**
     * Gets the WebGPU device for advanced rendering operations.
     * @returns GPU device, or null if not initialized.
     */
    public getDevice(): GPUDevice | null {
        return this.device;
    }

    /**
     * Gets the WebGPU canvas context.
     * @returns Canvas context, or null if not initialized.
     */
    public getContext(): GPUCanvasContext | null {
        return this.context;
    }

    /**
     * Gets the canvas element.
     * @returns HTML canvas element, or null if not initialized.
     */
    public getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    /**
     * Gets the renderer instance for advanced rendering operations.
     * @returns Renderer instance, or null if not initialized.
     */
    public getRenderer(): Renderer | null {
        return this.renderer;
    }

    // ========================================================================
    // RENDERING API
    // ========================================================================

    /**
     * Sets the background clear color for each frame.
     * @param color - Color to clear the screen with.
     */
    public setClearColor(color: Color32): void {
        this.renderer?.setClearColor(color);
    }

    /**
     * Fills a rectangular region with a solid color.
     * @param color - Fill color.
     * @param rect - Region to fill in pixel coordinates.
     */
    public clearRect(color: Color32, rect: Rect2i): void {
        this.renderer?.clearRect(color, rect);
    }

    /**
     * Draws a single pixel at the specified position.
     * @param pos - Pixel coordinates.
     * @param color - Pixel color.
     */
    public drawPixel(pos: Vector2i, color: Color32): void {
        this.renderer?.drawPixel(pos, color);
    }

    /**
     * Draws a line between two points using Bresenham's algorithm.
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Line color.
     */
    public drawLine(p0: Vector2i, p1: Vector2i, color: Color32): void {
        this.renderer?.drawLine(p0, p1, color);
    }

    /**
     * Draws a rectangle outline (unfilled).
     * @param rect - Rectangle bounds.
     * @param color - Outline color.
     */
    public drawRect(rect: Rect2i, color: Color32): void {
        this.renderer?.drawRect(rect, color);
    }

    /**
     * Draws a filled rectangle.
     * @param rect - Rectangle bounds.
     * @param color - Fill color.
     */
    public drawRectFill(rect: Rect2i, color: Color32): void {
        this.renderer?.drawRectFill(rect, color);
    }

    /**
     * Draws placeholder text (simple rectangle blocks).
     * For proper text, use drawBitmapText() instead.
     * @param pos - Text position (top-left corner).
     * @param color - Text color.
     * @param text - String to display.
     */
    public drawText(pos: Vector2i, color: Color32, text: string): void {
        this.renderer?.drawText(pos, color, text);
    }

    // ========================================================================
    // SPRITE API
    // ========================================================================

    /**
     * Draws a sprite region from a sprite sheet.
     * @param spriteSheet - Source sprite sheet texture.
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw at (top-left corner).
     * @param tint - Optional tint color (defaults to white = no tint).
     */
    public drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint?: Color32): void {
        this.renderer?.drawSprite(spriteSheet, srcRect, destPos, tint);
    }

    /**
     * Draws text using a bitmap font.
     * @param font - Bitmap font containing character glyphs.
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param color - Optional text color (defaults to white).
     */
    public drawBitmapText(font: BitmapFont, pos: Vector2i, text: string, color?: Color32): void {
        this.renderer?.drawBitmapText(font, pos, text, color);
    }

    // ========================================================================
    // CAMERA API
    // ========================================================================

    /**
     * Sets the camera offset for scrolling effects.
     * All drawing operations are offset by this amount.
     * @param offset - Camera position offset in pixels.
     */
    public setCameraOffset(offset: Vector2i): void {
        this.renderer?.setCameraOffset(offset);
    }

    /**
     * Gets the current camera offset.
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
}
