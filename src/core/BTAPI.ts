import type { BitmapFont } from '../assets/BitmapFont';
import type { Palette } from '../assets/Palette';
import {
    CycleEffect,
    FadeEffect,
    FadeRangeEffect,
    FlashEffect,
    PaletteEffectManager,
    paletteSwap,
} from '../assets/PaletteEffect';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { createSystemFont } from '../assets/SystemFont';
import { Renderer } from '../render/Renderer';
import type { Color32 } from '../utils/Color32';
import type { EasingFunction } from '../utils/Easing';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { FrameDropCallback, FrameDropEvent } from './GameLoop';
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

    /** Active engine palette used by palette-first rendering. */
    private palette: Palette | null = null;

    /** Registry of all sprite sheets that have been passed to drawSprite, for spritesRefresh. */
    private readonly spriteSheets: Set<SpriteSheet> = new Set();

    // #endregion

    // #region Module State - Subsystems

    /** Game loop managing fixed-timestep updates and variable-rate rendering. */
    private loop: GameLoop | null = null;

    /** Manages animated palette effects (cycling, fading, flashing). */
    private readonly paletteEffects = new PaletteEffectManager();

    /** Built-in 6x14 system font for BT.systemPrint(). */
    private systemFont: BitmapFont | null = null;

    // TODO: Additional subsystems for future implementation:
    // InputManager, AudioManager, AssetManager

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

        // Create the built-in system font (synchronous, no GPU needed yet).
        this.systemFont = createSystemFont();

        // TODO: Initialize input, audio, etc.

        // Initialize the demo.
        console.log('[BT] Initializing demo');

        if (!(await demo.initialize())) {
            console.error('[BT] Demo initialization failed');

            return false;
        }

        // Start the loop. The GameLoop's double-RAF delay ensures the canvas is
        // fully ready before the first tick.
        const onFrameDrop: FrameDropCallback | undefined =
            this.hwSettings.detectDroppedFrames === true ? (event) => this.handleFrameDrop(event) : undefined;

        this.loop = new GameLoop(
            updateInterval,
            () => this.demo?.update(),
            () => {
                if (this.renderer) {
                    this.renderer.beginFrame();
                    this.demo?.render();

                    // Palette effects run after demo render (so user's explicit palette
                    // changes in render() are respected) but before endFrame (so effects
                    // are visible this frame via the dirty-flag GPU upload).
                    if (this.palette && this.paletteEffects.activeCount > 0) {
                        this.paletteEffects.update(this.palette);
                    }

                    this.renderer.endFrame();
                }
            },
            onFrameDrop,
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
     * Ticks increment once per fixed update step (target rate set by `targetFPS`).
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

    /**
     * Gets the active engine palette.
     *
     * @returns Active palette, or null if none has been set.
     */
    public getPalette(): Palette | null {
        return this.palette;
    }

    /**
     * Sets the active engine palette and propagates it to the renderer.
     *
     * If sprite sheets have already been indexized, emits a warning: the indexed
     * pixel data will be stale until `spritesRefresh()` is called.
     *
     * @param palette - Palette to store as the active engine palette.
     */
    public setPalette(palette: Palette): void {
        if (this.spriteSheets.size > 0) {
            console.warn('[BT] Active palette structure changed. Call BT.spritesRefresh() to update loaded sprites.');
        }

        // In-flight effects hold snapshots of the old palette. Drop them so they
        // don't apply stale colors to the new palette.
        this.paletteEffects.clear();

        this.palette = palette;
        this.renderer?.setPalette(palette);
    }

    // #endregion

    // #region Rendering API - Clear Operations

    /**
     * Sets the background clear color for each frame using a palette index.
     *
     * @param paletteIndex - Palette index for the clear color.
     */
    public setClearColor(paletteIndex: number): void {
        this.assertPaletteIndex(paletteIndex);
        this.renderer?.setClearColor(paletteIndex);
    }

    /**
     * Fills a rectangular region with a palette-indexed color.
     *
     * @param rect - Region to fill in pixel coordinates.
     * @param paletteIndex - Palette color index.
     */
    public clearRect(rect: Rect2i, paletteIndex: number): void {
        this.assertPaletteIndex(paletteIndex);
        this.renderer?.clearRect(rect, paletteIndex);
    }

    // #endregion

    // #region Rendering API - Primitives

    /**
     * Draws a single pixel at the specified position.
     *
     * @param pos - Pixel coordinates.
     * @param paletteIndex - Palette color index.
     */
    public drawPixel(pos: Vector2i, paletteIndex: number): void {
        this.assertPaletteIndex(paletteIndex);
        this.renderer?.drawPixel(pos, paletteIndex);
    }

    /**
     * Draws a line between two points using Bresenham's algorithm.
     * Produces pixel-perfect lines without antialiasing.
     *
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param paletteIndex - Palette color index.
     */
    public drawLine(p0: Vector2i, p1: Vector2i, paletteIndex: number): void {
        this.assertPaletteIndex(paletteIndex);
        this.renderer?.drawLine(p0, p1, paletteIndex);
    }

    /**
     * Draws a rectangle outline (unfilled).
     *
     * @param rect - Rectangle bounds.
     * @param paletteIndex - Palette color index.
     */
    public drawRect(rect: Rect2i, paletteIndex: number): void {
        this.assertPaletteIndex(paletteIndex);
        this.renderer?.drawRect(rect, paletteIndex);
    }

    /**
     * Draws a filled rectangle.
     *
     * @param rect - Rectangle bounds.
     * @param paletteIndex - Palette color index.
     */
    public drawRectFill(rect: Rect2i, paletteIndex: number): void {
        this.assertPaletteIndex(paletteIndex);
        this.renderer?.drawRectFill(rect, paletteIndex);
    }

    /**
     * Draws text using the built-in 6x14 system font.
     *
     * The system font stores foreground pixels as palette index 1. The
     * `paletteIndex` parameter is converted to a sprite pipeline palette
     * offset so that each foreground pixel maps to `palette[paletteIndex]`.
     *
     * @param pos - Text position (top-left corner).
     * @param paletteIndex - Palette color index for the text.
     * @param text - String to display.
     */
    public drawSystemText(pos: Vector2i, paletteIndex: number, text: string): void {
        this.assertPaletteIndex(paletteIndex);

        // Palette index 0 is transparent -- nothing to draw.
        if (paletteIndex === 0) {
            return;
        }

        if (this.systemFont) {
            // Offset math: font stores foreground as index 1.
            // Shader computes 1 + (paletteIndex - 1) = paletteIndex.
            this.renderer?.drawBitmapText(this.systemFont, pos, text, paletteIndex - 1);
        }
    }

    /**
     * Returns the built-in system font, or null if not yet initialized.
     *
     * @returns The system BitmapFont instance.
     */
    public getSystemFont(): BitmapFont | null {
        return this.systemFont;
    }

    // #endregion

    // #region Rendering API - Sprites

    /**
     * Draws a sprite region from an indexed sprite sheet.
     * The renderer batches compatible sprite draws internally.
     *
     * @param spriteSheet - Source sprite sheet (must have been indexized via spriteSheet.indexize()).
     * @param srcRect - Region to copy from the sprite sheet.
     * @param destPos - Screen position to draw in (the top-left corner).
     * @param paletteOffset - Palette index offset applied at draw time (default 0).
     * @throws If the sprite sheet has not been indexized.
     */
    public drawSprite(spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, paletteOffset: number = 0): void {
        this.assertPaletteIndex(paletteOffset);
        this.requireIndexizedSheet(spriteSheet, 'drawSprite');
        this.renderer?.drawSprite(spriteSheet, srcRect, destPos, paletteOffset);
    }

    /**
     * Draws text using a bitmap font with variable-width glyphs.
     * Supports Unicode characters and per-glyph render offsets.
     *
     * @param font - Bitmap font containing character glyphs (underlying sheet must be indexized).
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param paletteOffset - Palette index offset applied to all glyphs (default 0).
     * @throws If the font's sprite sheet has not been indexized.
     */
    public drawBitmapText(font: BitmapFont, pos: Vector2i, text: string, paletteOffset: number = 0): void {
        this.assertPaletteIndex(paletteOffset);
        this.requireIndexizedSheet(font.getSpriteSheet(), 'drawBitmapText', 'font sprite sheet');
        this.renderer?.drawBitmapText(font, pos, text, paletteOffset);
    }

    /**
     * Re-indexizes all tracked sprite sheets against the current active palette.
     *
     * Call this after swapping or modifying the active palette to keep all loaded
     * sprite sheets in sync with the new color-to-index mapping.
     *
     * @throws If no active palette has been set.
     */
    public spritesRefresh(): void {
        if (!this.palette) {
            throw new Error('[BT] spritesRefresh: no active palette. Call BT.paletteSet() first.');
        }

        let refreshed = 0;

        for (const sheet of this.spriteSheets) {
            if (!sheet.isIndexized()) {
                this.spriteSheets.delete(sheet);
                continue;
            }

            try {
                sheet.reindexize(this.palette);
                refreshed++;
            } catch (e) {
                console.error('[BT] spritesRefresh: failed to reindexize sheet, removing from registry:', e);
                this.spriteSheets.delete(sheet);
            }
        }

        console.log(`[BT] Refreshed ${refreshed} sprite sheet(s) against current palette`);
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

    // #region Palette Effects API

    /**
     * Validates that a duration is a finite, non-negative number.
     *
     * @param method - Calling method name for the error message.
     * @param durationMs - Duration to validate.
     * @throws Error if the duration is not finite or is negative.
     */
    private assertFiniteDuration(method: string, durationMs: number): void {
        if (!Number.isFinite(durationMs) || durationMs < 0) {
            throw new Error(`[BT] ${method}: durationMs must be a finite non-negative number, got ${durationMs}.`);
        }
    }

    /**
     * Starts rotating a range of palette entries at a constant speed.
     *
     * Classic water/fire/plasma animation. Runs indefinitely until cancelled
     * via {@link paletteClearEffects}.
     *
     * @param start - First palette index in the cycling range (inclusive).
     * @param end - Last palette index in the cycling range (inclusive).
     * @param speed - Steps per second. Positive = forward, negative = backward.
     */
    public paletteCycle(start: number, end: number, speed: number): void {
        if (!Number.isFinite(speed)) {
            throw new Error(`[BT] paletteCycle: speed must be finite, got ${speed}.`);
        }

        if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) {
            throw new Error(`[BT] paletteCycle: start must be an integer less than end, got [${start}, ${end}].`);
        }

        this.paletteEffects.add(new CycleEffect(start, end, speed));
    }

    /**
     * Smoothly interpolates all palette entries toward a target over time.
     *
     * Snapshots the current palette at start. Auto-removes when complete.
     *
     * @param target - Target palette to fade toward.
     * @param durationMs - Fade duration in milliseconds.
     * @param easing - Easing curve. Defaults to `'linear'`.
     */
    public paletteFade(target: Palette, durationMs: number, easing?: EasingFunction): void {
        if (!this.palette) {
            throw new Error('[BT] Cannot fade palette: no active palette set.');
        }

        this.assertFiniteDuration('paletteFade', durationMs);
        this.paletteEffects.add(new FadeEffect(this.palette, target, durationMs, easing));
    }

    /**
     * Fades only a subset of palette indices toward a target over time.
     *
     * @param start - First palette index to fade (inclusive).
     * @param end - Last palette index to fade (inclusive).
     * @param target - Target palette to fade toward.
     * @param durationMs - Fade duration in milliseconds.
     * @param easing - Easing curve. Defaults to `'linear'`.
     */
    public paletteFadeRange(
        start: number,
        end: number,
        target: Palette,
        durationMs: number,
        easing?: EasingFunction,
    ): void {
        if (!this.palette) {
            throw new Error('[BT] Cannot fade palette range: no active palette set.');
        }

        this.assertFiniteDuration('paletteFadeRange', durationMs);
        this.paletteEffects.add(new FadeRangeEffect(start, end, this.palette, target, durationMs, easing));
    }

    /**
     * Temporarily sets all non-zero palette entries to a single color, then restores.
     *
     * Index 0 (transparent) is preserved. Auto-removes after duration.
     *
     * @param color - Flash color applied to all non-zero entries.
     * @param durationMs - How long the flash lasts in milliseconds.
     */
    public paletteFlash(color: Color32, durationMs: number): void {
        if (!this.palette) {
            throw new Error('[BT] Cannot flash palette: no active palette set.');
        }

        this.assertFiniteDuration('paletteFlash', durationMs);
        this.paletteEffects.add(new FlashEffect(color, durationMs));
    }

    /**
     * Instantly exchanges two palette entries.
     *
     * This is an immediate operation, not an animated effect.
     *
     * @param indexA - First palette index.
     * @param indexB - Second palette index.
     */
    public paletteSwap(indexA: number, indexB: number): void {
        if (!this.palette) {
            throw new Error('[BT] Cannot swap palette entries: no active palette set.');
        }

        paletteSwap(this.palette, indexA, indexB);
    }

    /**
     * Cancels all running palette effects immediately.
     *
     * The palette stays at whatever state it was in when cancelled.
     */
    public paletteClearEffects(): void {
        this.paletteEffects.clear();
    }

    // #endregion

    // #region Private Helpers

    /**
     * Logs a dropped-frame event from the {@link GameLoop} as a console warning.
     *
     * One line per event. The {@link GameLoop} auto-calibrates its baseline
     * to the actual rAF cadence, so sustained slowness re-baselines instead
     * of generating sustained log spam, leaving only genuine missed-vsync
     * events to be reported here.
     *
     * @param event - Dropped-frame event.
     */
    private handleFrameDrop(event: FrameDropEvent): void {
        console.warn(
            `[BT] Dropped ${event.droppedFrames} frame(s) ` +
                `(frame time ${event.deltaTime.toFixed(1)}ms, expected ${event.expectedInterval.toFixed(1)}ms)`,
        );
    }

    /**
     * Validates that a sprite sheet has been indexized and registers it for refresh tracking.
     *
     * @param sheet - Sprite sheet to validate.
     * @param method - Calling method name for the error message.
     * @param label - Human-readable name for the sheet used in the error message (default `'sprite sheet'`).
     * @throws If the sprite sheet has not been indexized.
     */
    private requireIndexizedSheet(sheet: SpriteSheet, method: string, label: string = 'sprite sheet'): void {
        if (!sheet.isIndexized()) {
            throw new Error(
                `[BT] ${method}: ${label} has not been indexized.` +
                    ' Call spriteSheet.indexize(palette) after setting a palette.',
            );
        }

        this.spriteSheets.add(sheet);
    }

    /**
     * Validates that a palette index is a non-negative integer and, when a palette
     * is active, that the index is within its range.
     *
     * The non-integer/negative check always runs regardless of palette state.
     * The range check only runs when a palette has been set.
     *
     * @param index - Palette index to validate.
     * @throws Error if the index is not a non-negative integer.
     * @throws Error if a palette is active and the index is out of its range.
     */
    private assertPaletteIndex(index: number): void {
        if (!Number.isInteger(index) || index < 0) {
            throw new Error(`Palette index ${index} is not a valid non-negative integer.`);
        }

        if (this.palette && index >= this.palette.size) {
            throw new Error(`Palette index ${index} out of range for palette of size ${this.palette.size}.`);
        }
    }

    // #endregion
}
