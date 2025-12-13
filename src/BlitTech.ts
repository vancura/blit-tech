/**
 * Blit–Tech - WebGPU Retro Game Engine
 *
 * Main static API inspired by RetroBlit's RB namespace.
 * All game code interacts with the engine through this interface.
 */

import { AssetLoader } from './assets/AssetLoader';
import type { TextSize } from './assets/BitmapFont';
import { BitmapFont } from './assets/BitmapFont';
import { SpriteSheet } from './assets/SpriteSheet';
import { BTAPI } from './core/BTAPI';
import type { HardwareSettings, IBlitTechGame } from './core/IBlitTechGame';
import type { BootstrapOptions, GameConstructor } from './utils/Bootstrap';
import { bootstrap, checkWebGPUSupport, displayError, getCanvas } from './utils/Bootstrap';
import { Color32 } from './utils/Color32';
import { Rect2i } from './utils/Rect2i';
import { Vector2i } from './utils/Vector2i';

// #region Module State

/**
 * Tracks which warning messages have been displayed to avoid console spam.
 * Each function name is stored after its first warning is shown.
 */
const _warnedFunctions = new Set<string>();

// #endregion

// #region Helper Functions

/**
 * Displays a warning message once per function to avoid console spam.
 * Further calls with the same function name will be silently ignored.
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

/**
 * Main Blit–Tech API module.
 * All engine features are accessed through BT.* methods.
 */
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
     * Initializes the engine with a game instance and canvas element.
     * This is the entry point for all Blit–Tech games.
     *
     * Setup sequence:
     * 1. Calls game.queryHardware() to get display settings
     * 2. Initializes WebGPU device and context
     * 3. Creates a renderer with a configured display size
     * 4. Calls game.initialize() to load assets
     * 5. Starts the game loop (fixed update, variable render)
     *
     * IMPORTANT: Canvas must be attached to DOM before calling this.
     * In Electron, wait for DOM ready before initializing.
     *
     * @param game - Game implementing IBlitTechGame interface.
     * @param canvas - HTML canvas element to render to.
     * @returns Promise that resolves to true if successful, false on error.
     *
     * @example
     * const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
     * const game = new MyGame();
     * const success = await BT.initialize(game, canvas);
     *
     * if (!success) {
     *   console.error('Failed to initialize Blit–Tech');
     * }
     */
    initialize: async (game: IBlitTechGame, canvas: HTMLCanvasElement): Promise<boolean> => {
        return await BTAPI.instance.initialize(game, canvas);
    },

    // #endregion

    // #region Hardware Information

    /**
     * Gets the current display size in pixels.
     * Returns the internal rendering resolution configured by the game.
     *
     * @returns Display size as Vector2i, or zero vector if not initialized.
     */
    displaySize: (): Vector2i => {
        const settings = BTAPI.instance.getHardwareSettings();

        return settings ? settings.displaySize.clone() : Vector2i.zero();
    },

    /**
     * Gets the target frames per second for update() calls.
     * Update() runs at this fixed rate, while render() runs at a variable rate.
     *
     * @returns Target frames per second, or 60 if not initialized.
     */
    fps: (): number => {
        const settings = BTAPI.instance.getHardwareSettings();

        return settings ? settings.targetFPS : 60;
    },

    /**
     * Gets the current tick count (increments each update).
     * Ticks increment once per fixed update call (e.g., 60 times/second at 60 FPS).
     *
     * @returns Current tick count since initialization or last reset.
     */
    ticks: (): number => {
        return BTAPI.instance.getTicks();
    },

    /**
     * Resets the tick counter to zero.
     * Useful for timing-based game events and animations.
     */
    ticksReset: (): void => {
        BTAPI.instance.resetTicks();
    },

    // #endregion

    // #region Rendering - Clear Operations

    /**
     * Clears the screen with a solid color.
     * Called at the start of each frame to set the background color.
     *
     * @param color - Fill color for the entire screen.
     */
    clear: (color: Color32): void => {
        BTAPI.instance.setClearColor(color);
    },

    /**
     * Clears a rectangular region with a solid color.
     * Useful for erasing specific areas of the screen.
     *
     * @param color - Fill color for the region.
     * @param rect - Region to clear in pixel coordinates.
     */
    clearRect: (color: Color32, rect: Rect2i): void => {
        BTAPI.instance.clearRect(color, rect);
    },

    // #endregion

    // #region Rendering - Primitives

    /**
     * Draws a single pixel at the specified position.
     *
     * @param pos - Pixel coordinates.
     * @param color - Pixel color.
     */
    drawPixel: (pos: Vector2i, color: Color32): void => {
        BTAPI.instance.drawPixel(pos, color);
    },

    /**
     * Draws a line between two points using Bresenham's algorithm.
     * Produces pixel-perfect lines without the antialiasing.
     *
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Line color.
     */
    drawLine: (p0: Vector2i, p1: Vector2i, color: Color32): void => {
        BTAPI.instance.drawLine(p0, p1, color);
    },

    /**
     * Draws a rectangle outline (unfilled).
     *
     * @param rect - Rectangle bounds in pixel coordinates.
     * @param color - Outline color.
     */
    drawRect: (rect: Rect2i, color: Color32): void => {
        BTAPI.instance.drawRect(rect, color);
    },

    /**
     * Draws a filled rectangle.
     *
     * @param rect - Rectangle bounds in pixel coordinates.
     * @param color - Fill color.
     */
    drawRectFill: (rect: Rect2i, color: Color32): void => {
        BTAPI.instance.drawRectFill(rect, color);
    },

    // #endregion

    // #region Camera

    /**
     * Sets the camera offset for scrolling effects.
     * This amount offsets all drawing operations.
     *
     * @param offset - Camera position offset in pixels.
     */
    cameraSet: (offset: Vector2i): void => {
        BTAPI.instance.setCameraOffset(offset);
    },

    /**
     * Gets the current camera offset.
     *
     * @returns Current camera position offset.
     */
    cameraGet: (): Vector2i => {
        return BTAPI.instance.getCameraOffset();
    },

    /**
     * Resets the camera offset to (0, 0).
     */
    cameraReset: (): void => {
        BTAPI.instance.resetCamera();
    },

    // #endregion

    // #region Input - Gamepad Buttons

    /**
     * Checks if a gamepad button is currently held down.
     * Returns true for every frame the button remains pressed.
     *
     * @param _button - Button constant (BTN_*).
     * @param _player - Player index (0-3).
     * @returns True if button is held down, false otherwise.
     */
    buttonDown: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks if a gamepad button was just pressed this frame.
     * Returns true only on the first frame the button is pressed.
     *
     * @param _button - Button constant (BTN_*).
     * @param _player - Player index (0-3).
     * @returns True if button was just pressed, false otherwise.
     */
    buttonPressed: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks if a gamepad button was just released this frame.
     * Returns true only on the first frame the button is released.
     *
     * @param _button - Button constant (BTN_*).
     * @param _player - Player index (0-3).
     * @returns True if button was just released, false otherwise.
     */
    buttonReleased: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement input system.
        return false;
    },

    // #endregion

    // #region Input - Keyboard

    /**
     * Checks if a keyboard key is currently held down.
     * Returns true for every frame the key remains pressed.
     *
     * @param _key - Key code (e.g., "KeyW", "Space", "ArrowUp").
     * @returns True if key is held down, false otherwise.
     */
    keyDown: (_key: string): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks if a keyboard key was just pressed this frame.
     * Returns true only on the first frame the key is pressed.
     *
     * @param _key - Key code (e.g., "KeyW", "Space", "ArrowUp").
     * @returns True if key was just pressed, false otherwise.
     */
    keyPressed: (_key: string): boolean => {
        // TODO: Implement input system.
        return false;
    },

    /**
     * Checks if a keyboard key was just released this frame.
     * Returns true only on the first frame the key is released.
     *
     * @param _key - Key code (e.g., "KeyW", "Space", "ArrowUp").
     * @returns True if key was just released, false otherwise.
     */
    keyReleased: (_key: string): boolean => {
        // TODO: Implement input system.
        return false;
    },

    // #endregion

    // #region Text Rendering

    /**
     * Prints placeholder text at the specified position.
     * Each character is rendered as a simple colored block.
     * For proper text rendering, use printFont() instead.
     *
     * @param pos - Text position (top-left corner).
     * @param color - Text color.
     * @param text - String to display.
     */
    print: (pos: Vector2i, color: Color32, text: string): void => {
        BTAPI.instance.drawText(pos, color, text);
    },

    /**
     * Measures the pixel dimensions of text.
     * Currently, returns zero vector - implementation pending.
     *
     * @param _text - Text string to measure.
     * @returns Size of text in pixels (currently always zero).
     */
    printMeasure: (_text: string): Vector2i => {
        warnOnce('printMeasure', '[BT.printMeasure] Not yet implemented');

        return Vector2i.zero();
    },

    /**
     * Draws text using a bitmap font with variable-width glyphs.
     * Supports Unicode characters and per-glyph rendering offsets.
     *
     * @param font - Bitmap font to use for rendering.
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param color - Optional text color (defaults to white).
     */
    printFont: (font: BitmapFont, pos: Vector2i, text: string, color?: Color32): void => {
        BTAPI.instance.drawBitmapText(font, pos, text, color);
    },

    // #endregion

    // #region Sprite Rendering

    /**
     * Draws a sprite region from a sprite sheet.
     * Supports texture batching for optimal performance.
     *
     * The renderer automatically batches sprites by texture.
     * Drawing sprites from the same SpriteSheet consecutively
     * is more efficient than interleaving different textures.
     *
     * PERFORMANCE TIP: Group draw calls by texture to minimize GPU state changes.
     *
     * @param spriteSheet - Sprite sheet containing the source texture.
     * @param srcRect - Source rectangle in the sprite sheet (pixel coordinates).
     * @param destPos - Destination position on screen (top-left corner).
     * @param tint - Optional tint color multiplied with texture (defaults to white).
     *
     * @example
     * // Efficient: All from the same sprite sheet.
     * BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(10, 10));
     * BT.drawSprite(sheet, new Rect2i(16, 0, 16, 16), new Vector2i(26, 10));
     * BT.drawSprite(sheet, new Rect2i(32, 0, 16, 16), new Vector2i(42, 10));
     *
     * // Less efficient: Interleaving textures causes batch flushes.
     * BT.drawSprite(sheet1, ...);
     * BT.drawSprite(sheet2, ...); // Flush + texture change
     * BT.drawSprite(sheet1, ...); // Flush + texture change
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
    displayError,
    getCanvas,
    Rect2i,
    SpriteSheet,
    Vector2i,
};
export type { BootstrapOptions, GameConstructor, HardwareSettings, IBlitTechGame, TextSize };

// #endregion
