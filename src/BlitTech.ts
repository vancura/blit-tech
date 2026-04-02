/**
 * Public Blit-Tech entrypoint.
 *
 * This module re-exports the main runtime types and exposes the `BT` facade
 * used by demos for rendering, timing, bootstrap, and future input helpers.
 *
 * Rendering is palette-first: every color on screen is identified by a numeric
 * palette index rather than a direct RGBA value. Set an active palette with
 * `BT.paletteSet()` before drawing anything, and call `spriteSheet.indexize(palette)`
 * after loading each sprite sheet to convert its RGBA pixels to palette indices.
 */

import { AssetLoader } from './assets/AssetLoader';
import type { TextSize } from './assets/BitmapFont';
import { BitmapFont } from './assets/BitmapFont';
import { Palette } from './assets/Palette';
import { SpriteSheet } from './assets/SpriteSheet';
import { BTAPI } from './core/BTAPI';
import type { HardwareSettings, IBlitTechDemo } from './core/IBlitTechDemo';
import { defaultHardwareSettings } from './core/IBlitTechDemo';
import type { BootstrapOptions } from './utils/Bootstrap';
import { bootstrap } from './utils/Bootstrap';
import { checkWebGPUSupport, displayError, getCanvas } from './utils/BootstrapHelpers';
import { Color32 } from './utils/Color32';
import type { EasingFunction } from './utils/Easing';
import { applyEasing } from './utils/Easing';
import { Rect2i } from './utils/Rect2i';
import { Vector2i } from './utils/Vector2i';

// #region Module State

/** Tracks one-time facade warnings to avoid repeated console noise. */
const _warnedFunctions = new Set<string>();

// #endregion

// #region Helper Functions

/**
 * Emits a warning message only once for a named facade function.
 *
 * @param funcName - Unique identifier for the function (used for deduplication).
 * @param message - Warning message to display in the console.
 */
function warnOnce(funcName: string, message: string): void {
    if (!_warnedFunctions.has(funcName)) {
        console.warn(message);

        _warnedFunctions.add(funcName);
    }
}

// #endregion

// #region Public API

/** Main Blit-Tech API namespace used by runtime demos. */
export const BT = {
    // #region Constants - Sprite Transform Flags

    /** Horizontal flip flag for sprite rendering. */
    FLIP_H: 1,

    /** Vertical flip flag for sprite rendering. */
    FLIP_V: 1 << 1,

    /** Rotate 90° clockwise flag for sprite rendering. */
    ROT_90_CW: 1 << 2,

    /** Rotate 180° flag for sprite rendering. */
    ROT_180_CW: 1 << 3,

    /** Rotate 270° clockwise flag for sprite rendering. */
    ROT_270_CW: 1 << 4,

    // #endregion

    // #region Constants - Button Codes

    /** Up button code. */
    BTN_UP: 0,

    /** Down button code. */
    BTN_DOWN: 1,

    /** Left button code. */
    BTN_LEFT: 2,

    /** Right button code. */
    BTN_RIGHT: 3,

    /** A button code. */
    BTN_A: 4,

    /** B button code. */
    BTN_B: 5,

    /** X button code. */
    BTN_X: 6,

    /** Y button code. */
    BTN_Y: 7,

    /** Left shoulder button code. */
    BTN_L: 8,

    /** Right shoulder button code. */
    BTN_R: 9,

    /** Start button code. */
    BTN_START: 10,

    /** Select button code. */
    BTN_SELECT: 11,

    /** Left mouse / primary pointer button code. */
    BTN_POINTER_A: 20,

    /** Right mouse / secondary pointer button code. */
    BTN_POINTER_B: 21,

    /** Middle mouse / tertiary pointer button code. */
    BTN_POINTER_C: 22,

    // #endregion

    // #region Initialization

    /**
     * Initializes the engine against a demo instance and target canvas.
     *
     * The canvas element must be attached to the DOM before this call.
     * In Electron environments, wait for DOM-ready first.
     *
     * @param demo - Demo implementation that provides lifecycle hooks.
     * @param canvas - Canvas used as the engine render target.
     * @returns `true` when initialization succeeds; otherwise `false`.
     */
    initialize: async (demo: IBlitTechDemo, canvas: HTMLCanvasElement): Promise<boolean> => {
        return await BTAPI.instance.initialize(demo, canvas);
    },

    // #endregion

    // #region Hardware Information

    /**
     * Returns the active internal display resolution in pixels.
     *
     * This is the logical render size configured by the demo, not the canvas
     * element's CSS size.
     *
     * @returns Configured display size, or `Vector2i.zero()` before initialization.
     */
    displaySize: (): Vector2i => {
        const settings = BTAPI.instance.getHardwareSettings();

        return settings ? settings.displaySize.clone() : Vector2i.zero();
    },

    /**
     * Returns the fixed update rate.
     *
     * `update()` runs at this target frequency, while rendering may occur at a
     * different cadence.
     *
     * @returns Target updates per second, or `60` before initialization.
     */
    fps: (): number => {
        const settings = BTAPI.instance.getHardwareSettings();

        return settings ? settings.targetFPS : 60;
    },

    /**
     * Returns the current fixed-update tick counter.
     *
     * The counter increments once per engine update and is typically used for
     * frame-based timing.
     *
     * @returns Tick count since initialization or the last {@link BT.ticksReset}.
     */
    ticks: (): number => {
        return BTAPI.instance.getTicks();
    },

    /**
     * Resets the fixed-update tick counter back to zero.
     */
    ticksReset: (): void => {
        BTAPI.instance.resetTicks();
    },

    /**
     * Creates a standalone palette instance.
     *
     * @param size - Palette size. Defaults to 256 colors.
     * @returns New mutable palette.
     */
    paletteCreate: (size: number = 256): Palette => {
        return new Palette(size);
    },

    /**
     * Stores the active engine palette.
     *
     * Use this to swap the **entire palette** (e.g. switch between a day and night
     * theme). After this call the renderer uploads the new palette uniform on the
     * next frame.
     *
     * **Palette-value swap (change what a slot looks like):** mutate the current
     * palette with `palette.set(slot, newColor)` and then call `paletteSet()`. The
     * sprite sheets' stored indices are unchanged — no {@link BT.spritesRefresh}
     * needed.
     *
     * **Palette-layout swap (same colors, different slot positions):** build a new
     * palette with the same colors at new indices, call `paletteSet()`, then call
     * {@link BT.spritesRefresh} so every sprite sheet re-maps its original RGBA
     * pixels against the new slot layout.
     *
     * @param palette - Palette to make active.
     */
    paletteSet: (palette: Palette): void => {
        BTAPI.instance.setPalette(palette);
    },

    /**
     * Gets the active engine palette.
     *
     * @returns Active palette.
     * @throws Error if no palette has been set.
     */
    paletteGet: (): Palette => {
        const palette = BTAPI.instance.getPalette();

        if (!palette) {
            throw new Error('No active palette. Call BT.paletteSet() first.');
        }

        return palette;
    },

    // #endregion

    // #region Palette Effects

    /**
     * Starts rotating a range of palette entries at a constant speed.
     *
     * Classic water/fire/plasma animation technique. Runs indefinitely until
     * cancelled via {@link BT.paletteClearEffects}. Uses a fractional accumulator
     * for sub-frame precision.
     *
     * @param start - First palette index in the cycling range (inclusive).
     * @param end - Last palette index in the cycling range (inclusive).
     * @param speed - Steps per second. Positive = forward, negative = backward.
     */
    paletteCycle: (start: number, end: number, speed: number): void => {
        BTAPI.instance.paletteCycle(start, end, speed);
    },

    /**
     * Smoothly interpolates all palette entries toward a target over time.
     *
     * Snapshots the current palette at the moment this is called. Each frame the
     * entries are lerped between the snapshot and target using the easing curve.
     * Auto-removes when the fade completes.
     *
     * Common patterns:
     * - Fade to black: `BT.paletteFade(blackPalette, 1000)`
     * - Fade to white: `BT.paletteFade(whitePalette, 500)`
     * - Cross-fade: `BT.paletteFade(nightPalette, 2000, 'ease-in-out')`
     *
     * @param target - Target palette to fade toward.
     * @param durationMs - Fade duration in milliseconds.
     * @param easing - Easing curve. Defaults to `'linear'`.
     */
    paletteFade: (target: Palette, durationMs: number, easing?: EasingFunction): void => {
        BTAPI.instance.paletteFade(target, durationMs, easing);
    },

    /**
     * Fades only a subset of palette indices toward a target over time.
     *
     * Same as {@link BT.paletteFade} but restricted to the range `[start, end]`.
     * Indices outside the range are left untouched.
     *
     * @param start - First palette index to fade (inclusive).
     * @param end - Last palette index to fade (inclusive).
     * @param target - Target palette to fade toward.
     * @param durationMs - Fade duration in milliseconds.
     * @param easing - Easing curve. Defaults to `'linear'`.
     */
    paletteFadeRange: (
        start: number,
        end: number,
        target: Palette,
        durationMs: number,
        easing?: EasingFunction,
    ): void => {
        BTAPI.instance.paletteFadeRange(start, end, target, durationMs, easing);
    },

    /**
     * Temporarily sets all non-zero palette entries to a single color, then restores.
     *
     * Index 0 (transparent) is preserved. The original palette is saved internally
     * and restored after the duration elapses. Auto-removes when complete.
     *
     * @param color - Flash color applied to all non-zero entries.
     * @param durationMs - How long the flash lasts in milliseconds.
     */
    paletteFlash: (color: Color32, durationMs: number): void => {
        BTAPI.instance.paletteFlash(color, durationMs);
    },

    /**
     * Instantly exchanges two palette entries.
     *
     * This is an immediate operation, not an animated effect. The visual change
     * takes effect on the next frame.
     *
     * @param indexA - First palette index.
     * @param indexB - Second palette index.
     */
    paletteSwap: (indexA: number, indexB: number): void => {
        BTAPI.instance.paletteSwap(indexA, indexB);
    },

    /**
     * Cancels all running palette effects immediately.
     *
     * The palette stays at whatever state it was in when cancelled.
     */
    paletteClearEffects: (): void => {
        BTAPI.instance.paletteClearEffects();
    },

    // #endregion

    // #region Rendering - Clear Operations

    /**
     * Sets the frame clear color using a palette index.
     *
     * The renderer uses this color when clearing the full display at the start
     * of the next frame.
     *
     * @param paletteIndex - Palette index for the full-screen clear pass.
     */
    clear: (paletteIndex: number): void => {
        BTAPI.instance.setClearColor(paletteIndex);
    },

    /**
     * Fills a rectangular display region with a palette-indexed color.
     *
     * @param rect - Rectangle in display pixel coordinates.
     * @param paletteIndex - Palette color index.
     */
    clearRect: (rect: Rect2i, paletteIndex: number): void => {
        BTAPI.instance.clearRect(rect, paletteIndex);
    },

    // #endregion

    // #region Rendering - Primitives

    /**
     * Draws a single pixel.
     *
     * @param pos - Target pixel in display coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawPixel: (pos: Vector2i, paletteIndex: number): void => {
        BTAPI.instance.drawPixel(pos, paletteIndex);
    },

    /**
     * Draws a pixel-perfect line between two points.
     *
     * Uses rasterized line drawing without antialiasing.
     *
     * @param p0 - Start position in display coordinates.
     * @param p1 - End position in display coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawLine: (p0: Vector2i, p1: Vector2i, paletteIndex: number): void => {
        BTAPI.instance.drawLine(p0, p1, paletteIndex);
    },

    /**
     * Draws an unfilled rectangle outline.
     *
     * @param rect - Rectangle bounds in display coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawRect: (rect: Rect2i, paletteIndex: number): void => {
        BTAPI.instance.drawRect(rect, paletteIndex);
    },

    /**
     * Draws a filled rectangle.
     *
     * @param rect - Rectangle bounds in display coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawRectFill: (rect: Rect2i, paletteIndex: number): void => {
        BTAPI.instance.drawRectFill(rect, paletteIndex);
    },

    // #endregion

    // #region Camera

    /**
     * Sets the global camera offset applied to subsequent draw calls.
     *
     * @param offset - Camera translation in display pixels.
     */
    cameraSet: (offset: Vector2i): void => {
        BTAPI.instance.setCameraOffset(offset);
    },

    /**
     * Returns the current global camera offset.
     *
     * @returns Camera translation in display pixels.
     */
    cameraGet: (): Vector2i => {
        return BTAPI.instance.getCameraOffset();
    },

    /**
     * Resets the global camera offset to `(0, 0)`.
     */
    cameraReset: (): void => {
        BTAPI.instance.resetCamera();
    },

    // #endregion

    // #region Input - Gamepad Buttons

    /**
     * Checks whether a gamepad button is currently held.
     *
     * This API is currently a stub and always returns `false`.
     *
     * @param _button - Button constant from the `BTN_*` set.
     * @param _player - Zero-based player index.
     * @returns `true` while the button remains pressed. Returns `false` until the input system is implemented.
     */
    buttonDown: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks whether a gamepad button was pressed on the current frame.
     *
     * This API is currently a stub and always returns `false`.
     *
     * @param _button - Button constant from the `BTN_*` set.
     * @param _player - Zero-based player index.
     * @returns `true` on the transition frame. Returns `false` until the input system is implemented.
     */
    buttonPressed: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks whether a gamepad button was released on the current frame.
     *
     * This API is currently a stub and always returns `false`.
     *
     * @param _button - Button constant from the `BTN_*` set.
     * @param _player - Zero-based player index.
     * @returns `true` on the release frame. Returns `false` until the input system is implemented.
     */
    buttonReleased: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement input system.
        return false;
    },

    // #endregion

    // #region Input - Keyboard

    /**
     * Checks whether a keyboard key is currently held.
     *
     * This API is currently a stub and always returns `false`.
     *
     * @param _key - DOM keyboard code such as `"KeyW"` or `"Space"`.
     * @returns `true` while the key remains pressed. Returns `false` until the input system is implemented.
     */
    keyDown: (_key: string): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks whether a keyboard key was pressed on the current frame.
     *
     * This API is currently a stub and always returns `false`.
     *
     * @param _key - DOM keyboard code such as `"KeyW"` or `"Space"`.
     * @returns `true` on the transition frame. Returns `false` until the input system is implemented.
     */
    keyPressed: (_key: string): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks whether a keyboard key was released on the current frame.
     *
     * This API is currently a stub and always returns `false`.
     *
     * @param _key - DOM keyboard code such as `"KeyW"` or `"Space"`.
     * @returns `true` on the release frame. Returns `false` until the input system is implemented.
     */
    keyReleased: (_key: string): boolean => {
        // TODO: Implement input system.
        return false;
    },

    // #endregion

    // #region Text Rendering

    /**
     * Draws basic placeholder text.
     *
     * This uses the engine's fallback text rendering. For authored bitmap fonts,
     * prefer {@link BT.printFont}.
     *
     * @param pos - Text origin in display coordinates.
     * @param paletteIndex - Palette color index.
     * @param text - String to render.
     */
    print: (pos: Vector2i, paletteIndex: number, text: string): void => {
        BTAPI.instance.drawText(pos, paletteIndex, text);
    },

    /**
     * Measures fallback text dimensions.
     *
     * This API is not implemented yet and currently returns `Vector2i.zero()`.
     *
     * @param _text - Text string to measure.
     * @returns Text size in pixels. Returns `Vector2i.zero()` until measurement support is implemented.
     */
    printMeasure: (_text: string): Vector2i => {
        warnOnce('printMeasure', '[BT.printMeasure] Not yet implemented');

        return Vector2i.zero();
    },

    /**
     * Draws text with a bitmap font through the indexed sprite pipeline.
     *
     * Supports proportional glyph widths and glyph-level offsets defined by the
     * supplied {@link BitmapFont}. The font's underlying sprite sheet must have
     * been indexized before calling this.
     *
     * **Palette offset semantics:** Glyph pixels are stored as palette indices starting at 1.
     * Index 0 is always transparent and is discarded by the fragment shader. The final palette
     * lookup is `storedIndex + paletteOffset`, so:
     *
     * - `paletteOffset = 0` (default): a white glyph stored at index 1 renders as `palette[1]`.
     *   `palette[0]` is never reachable because stored indices start at 1.
     * - `paletteOffset = N`: shifts the entire glyph color range up by N slots. A glyph stored
     *   at index 1 renders as `palette[1 + N]`.
     *
     * **Out-of-range behavior:** No CPU-side validation is performed. `paletteOffset` is passed to
     * the GPU as a `u32`. If `storedIndex + paletteOffset` exceeds the last palette index, WebGPU's
     * robust buffer access returns 0 for every component; because the fragment shader forces alpha
     * to 1.0, the affected pixels render as opaque black. Negative values are forbidden — a negative
     * JS number written into a `u32` vertex attribute wraps to a large unsigned integer, which also
     * produces out-of-bounds black pixels.
     *
     * @param font - Font asset used for rendering.
     * @param pos - Text origin in display coordinates.
     * @param text - String to render.
     * @param paletteOffset - Shift added to every stored glyph index before palette lookup (default 0).
     */
    printFont: (font: BitmapFont, pos: Vector2i, text: string, paletteOffset?: number): void => {
        BTAPI.instance.drawBitmapText(font, pos, text, paletteOffset);
    },

    // #endregion

    // #region Frame Capture

    /**
     * Captures the next rendered frame as a PNG blob.
     *
     * The returned promise resolves after the next render pass has completed.
     *
     * @returns PNG image data for the captured frame.
     *
     * @example
     * const blob = await BT.captureFrame();
     * const url = URL.createObjectURL(blob);
     * console.log('Captured frame:', url);
     */
    captureFrame: async (): Promise<Blob> => {
        return await BTAPI.instance.captureFrame();
    },

    /**
     * Captures the next rendered frame and downloads it from the browser.
     *
     * Convenience wrapper around {@link BT.captureFrame} that creates a temporary
     * object URL and clicks a synthetic anchor element.
     *
     * @param filename - Target download filename.
     *
     * @example
     * await BT.downloadFrame();
     * await BT.downloadFrame('screenshot-001.png');
     */
    downloadFrame: async (filename: string = 'blit-tech-capture.png'): Promise<void> => {
        const blob = await BTAPI.instance.captureFrame();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    },

    // #endregion

    // #region Sprite Rendering

    /**
     * Draws a sprite region from an indexed sprite sheet.
     *
     * Sprite draws are batched internally. Grouping draws from the same
     * {@link SpriteSheet} minimizes batch flushes and reduces GPU state changes.
     *
     * The sprite sheet must have been converted to palette indices via
     * `spriteSheet.indexize(palette)` before the first draw call.
     *
     * **Palette offset semantics:** Sprite pixels are stored as palette indices starting at 1.
     * Index 0 is always transparent and is discarded by the fragment shader. The final palette
     * lookup is `storedIndex + paletteOffset`, so:
     *
     * - `paletteOffset = 0` (default): a sprite pixel stored at index 1 renders as `palette[1]`.
     *   `palette[0]` is never reachable because stored indices start at 1.
     * - `paletteOffset = N`: shifts the entire sprite's color range up by N slots. A pixel stored
     *   at index 1 renders as `palette[1 + N]`, a pixel at index 2 renders as `palette[2 + N]`,
     *   and so on. Use this for palette-swap effects such as team colors or damage flashes.
     *
     * **Out-of-range behavior:** No CPU-side validation is performed. `paletteOffset` is passed to
     * the GPU as a `u32`. If `storedIndex + paletteOffset` exceeds the last palette index, WebGPU's
     * robust buffer access returns 0 for every component; because the fragment shader forces alpha
     * to 1.0, the affected pixels render as opaque black. Negative values are forbidden — a negative
     * JS number written into a `u32` vertex attribute wraps to a large unsigned integer, which also
     * produces out-of-bounds black pixels.
     *
     * @param spriteSheet - Indexed sprite sheet.
     * @param srcRect - Source rectangle within the sprite sheet, in pixels.
     * @param destPos - Destination top-left position in display coordinates.
     * @param paletteOffset - Shift added to every stored pixel index before palette lookup (default 0).
     *
     * @example
     * BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(10, 10));
     * BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(10, 10), 16); // blue team
     */
    drawSprite: (spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, paletteOffset?: number): void => {
        BTAPI.instance.drawSprite(spriteSheet, srcRect, destPos, paletteOffset);
    },

    /**
     * Re-indexizes all tracked sprite sheets against the current active palette.
     *
     * Only call this after a **palette-layout swap** — when the same colors have
     * moved to different slot positions and existing sprite indices now point to
     * the wrong slots. Each sheet re-runs exact RGBA-to-index matching against the
     * active palette via `SpriteSheet.reindexize()`. If any opaque pixel's original
     * color is missing from the new palette, `reindexize()` throws, and
     * `spritesRefresh()` catches that error and removes the affected sheet from the
     * registry (it will no longer render).
     *
     * **Do not call this after a palette-value swap.** If you changed what color a
     * slot holds (e.g. palette animation, theme tinting), the stored indices are
     * still correct — the fragment shader picks up the new color automatically.
     * Calling `spritesRefresh()` in that case is wasteful at best; at worst, if the
     * original RGBA values are gone from the palette, sheets with missing colors
     * will fail reindexing and be removed from the registry.
     *
     * Typical usage after a layout swap:
     * ```ts
     * BT.paletteSet(newLayoutPalette);
     * BT.spritesRefresh(); // re-map all sheets to the new slot positions
     * ```
     *
     * @throws If no active palette has been set.
     */
    spritesRefresh: (): void => {
        BTAPI.instance.spritesRefresh();
    },

    // #endregion
};

// #endregion

// #region Exports

export {
    applyEasing,
    AssetLoader,
    BitmapFont,
    bootstrap,
    checkWebGPUSupport,
    Color32,
    defaultHardwareSettings,
    displayError,
    getCanvas,
    Palette,
    Rect2i,
    SpriteSheet,
    Vector2i,
};
export type { BootstrapOptions, EasingFunction, HardwareSettings, IBlitTechDemo, TextSize };

// #endregion
