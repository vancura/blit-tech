/**
 * Public Blit-Tech entrypoint.
 *
 * This module re-exports the main runtime types and exposes the `BT` facade
 * used by demos for rendering, timing, bootstrap, and future input helpers.
 */

import { AssetLoader } from './assets/AssetLoader';
import type { TextSize } from './assets/BitmapFont';
import { BitmapFont } from './assets/BitmapFont';
import { SpriteSheet } from './assets/SpriteSheet';
import { BTAPI } from './core/BTAPI';
import type { HardwareSettings, IBlitTechDemo } from './core/IBlitTechDemo';
import { defaultHardwareSettings } from './core/IBlitTechDemo';
import type { BootstrapOptions } from './utils/Bootstrap';
import { bootstrap } from './utils/Bootstrap';
import { checkWebGPUSupport, displayError, getCanvas } from './utils/BootstrapHelpers';
import { Color32 } from './utils/Color32';
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

    // #endregion

    // #region Rendering - Clear Operations

    /**
     * Sets the frame clear color.
     *
     * The renderer uses this color when clearing the full display at the start
     * of the next frame.
     *
     * @param color - Color used for the full-screen clear pass.
     */
    clear: (color: Color32): void => {
        BTAPI.instance.setClearColor(color);
    },

    /**
     * Fills a rectangular display region with a solid color.
     *
     * @param color - Fill color applied to the region.
     * @param rect - Rectangle in display pixel coordinates.
     */
    clearRect: (color: Color32, rect: Rect2i): void => {
        BTAPI.instance.clearRect(color, rect);
    },

    // #endregion

    // #region Rendering - Primitives

    /**
     * Draws a single pixel.
     *
     * @param pos - Target pixel in display coordinates.
     * @param color - Pixel color.
     */
    drawPixel: (pos: Vector2i, color: Color32): void => {
        BTAPI.instance.drawPixel(pos, color);
    },

    /**
     * Draws a pixel-perfect line between two points.
     *
     * Uses rasterized line drawing without antialiasing.
     *
     * @param p0 - Start position in display coordinates.
     * @param p1 - End position in display coordinates.
     * @param color - Line color.
     */
    drawLine: (p0: Vector2i, p1: Vector2i, color: Color32): void => {
        BTAPI.instance.drawLine(p0, p1, color);
    },

    /**
     * Draws an unfilled rectangle outline.
     *
     * @param rect - Rectangle bounds in display coordinates.
     * @param color - Outline color.
     */
    drawRect: (rect: Rect2i, color: Color32): void => {
        BTAPI.instance.drawRect(rect, color);
    },

    /**
     * Draws a filled rectangle.
     *
     * @param rect - Rectangle bounds in display coordinates.
     * @param color - Fill color.
     */
    drawRectFill: (rect: Rect2i, color: Color32): void => {
        BTAPI.instance.drawRectFill(rect, color);
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
     * @param color - Text color.
     * @param text - String to render.
     */
    print: (pos: Vector2i, color: Color32, text: string): void => {
        BTAPI.instance.drawText(pos, color, text);
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
     * Draws text with a bitmap font.
     *
     * Supports proportional glyph widths and glyph-level offsets defined by the
     * supplied {@link BitmapFont}.
     *
     * @param font - Font asset used for rendering.
     * @param pos - Text origin in display coordinates.
     * @param text - String to render.
     * @param color - Optional tint color. Defaults to white when omitted.
     */
    printFont: (font: BitmapFont, pos: Vector2i, text: string, color?: Color32): void => {
        BTAPI.instance.drawBitmapText(font, pos, text, color);
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
     * Draws a sprite region from a sprite sheet.
     *
     * Textures internally batch sprite draws. Grouping draws from the
     * same {@link SpriteSheet} minimizes batch flushes and reduces GPU state
     * changes.
     *
     * @param spriteSheet - Sprite sheet that owns the source texture.
     * @param srcRect - Source rectangle within the sprite sheet, in pixels.
     * @param destPos - Destination top-left position in display coordinates.
     * @param tint - Optional multiplicative tint. Defaults to white.
     *
     * @example
     * BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(10, 10));
     * BT.drawSprite(sheet, new Rect2i(16, 0, 16, 16), new Vector2i(26, 10));
     * BT.drawSprite(sheet, new Rect2i(32, 0, 16, 16), new Vector2i(42, 10));
     */
    drawSprite: (spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint?: Color32): void => {
        BTAPI.instance.drawSprite(spriteSheet, srcRect, destPos, tint);
    },

    // #endregion
};

// #endregion

// #region Exports

export {
    AssetLoader,
    BitmapFont,
    bootstrap,
    checkWebGPUSupport,
    Color32,
    defaultHardwareSettings,
    displayError,
    getCanvas,
    Rect2i,
    SpriteSheet,
    Vector2i,
};
export type { BootstrapOptions, HardwareSettings, IBlitTechDemo, TextSize };

// #endregion
