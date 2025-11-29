/**
 * Blit-Tech - WebGPU Retro Game Engine
 *
 * Main static API inspired by RetroBlit's RB namespace.
 * All game code interacts with the engine through this interface.
 */

import { AssetLoader } from './assets/AssetLoader';
import { BitmapFont } from './assets/BitmapFont';
import { SpriteSheet } from './assets/SpriteSheet';
import { BTAPI } from './core/BTAPI';
import type { HardwareSettings, IBlitTechGame } from './core/IBlitTechGame';
import { Color32 } from './utils/Color32';
import { Rect2i } from './utils/Rect2i';
import { Vector2i } from './utils/Vector2i';

// Re-export types for convenience (type-only exports for interfaces)
export type { HardwareSettings, IBlitTechGame };
export { Color32, Rect2i, Vector2i };

// Re-export asset classes
export { AssetLoader, BitmapFont, SpriteSheet };

// Track which warnings have been shown to avoid console spam
const _warnedFunctions = new Set<string>();

/**
 * Show a warning once per function.
 * @param funcName - Function name for tracking.
 * @param message - Warning message to display.
 */
function warnOnce(funcName: string, message: string): void {
    if (!_warnedFunctions.has(funcName)) {
        console.warn(message);
        _warnedFunctions.add(funcName);
    }
}

/**
 * Post-processing effect types.
 */
export enum Effect {
    Scanlines,
    Noise,
    Shake,
    Pixelate,
    Negative,
    Saturation,
    ChromaticAberration,
    Curvature,
    Zoom,
    Rotation,
    ColorFade,
    ColorTint,
    Slide,
    Wipe,
    Pinhole,
    Fizzle,
}

/**
 * Main Blit-Tech API module.
 * All engine functionality is accessed through BT.* methods.
 */
export const BT = {
    // ========================================================================
    // CONSTANTS - SPRITE FLAGS
    // ========================================================================

    /** Horizontal flip flag. */
    FLIP_H: 1 << 0,
    /** Vertical flip flag. */
    FLIP_V: 1 << 1,
    /** Rotate 90° clockwise flag. */
    ROT_90_CW: 1 << 2,
    /** Rotate 180° flag. */
    ROT_180_CW: 1 << 3,
    /** Rotate 270° clockwise flag. */
    ROT_270_CW: 1 << 4,

    // ========================================================================
    // CONSTANTS - BUTTONS
    // ========================================================================

    /** Up button. */
    BTN_UP: 0,
    /** Down button. */
    BTN_DOWN: 1,
    /** Left button. */
    BTN_LEFT: 2,
    /** Right button. */
    BTN_RIGHT: 3,
    /** A button. */
    BTN_A: 4,
    /** B button. */
    BTN_B: 5,
    /** X button. */
    BTN_X: 6,
    /** Y button. */
    BTN_Y: 7,
    /** Left shoulder button. */
    BTN_L: 8,
    /** Right shoulder button. */
    BTN_R: 9,
    /** Start button. */
    BTN_START: 10,
    /** Select button. */
    BTN_SELECT: 11,

    /** Left mouse / primary pointer. */
    BTN_POINTER_A: 20,
    /** Right mouse / secondary pointer. */
    BTN_POINTER_B: 21,
    /** Middle mouse / tertiary pointer. */
    BTN_POINTER_C: 22,

    // ========================================================================
    // EFFECTS ENUM REFERENCE
    // ========================================================================

    /** Effect enum reference for convenience. */
    Effect,

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the engine with a game instance.
     * @param game - Game implementing IBlitTechGame interface.
     * @param canvas - HTML canvas element to render to.
     * @returns Promise that resolves to true if successful.
     */
    initialize: async (game: IBlitTechGame, canvas: HTMLCanvasElement): Promise<boolean> => {
        return await BTAPI.instance.initialize(game, canvas);
    },

    /**
     * Get current display size in pixels.
     * @returns Display size as Vector2i.
     */
    displaySize: (): Vector2i => {
        const settings = BTAPI.instance.getHardwareSettings();
        return settings ? settings.displaySize.clone() : Vector2i.zero();
    },

    /**
     * Get target FPS.
     * @returns Target frames per second.
     */
    fps: (): number => {
        const settings = BTAPI.instance.getHardwareSettings();
        return settings ? settings.targetFPS : 60;
    },

    /**
     * Get current tick count (increments each update).
     * @returns Current tick count.
     */
    ticks: (): number => {
        return BTAPI.instance.getTicks();
    },

    /**
     * Reset tick counter to 0.
     */
    ticksReset: (): void => {
        BTAPI.instance.resetTicks();
    },

    // ========================================================================
    // RENDERING - SPRITES
    // ========================================================================

    /**
     * Clear screen with solid color.
     * @param color - Fill color.
     */
    clear: (color: Color32): void => {
        BTAPI.instance.setClearColor(color);
    },

    /**
     * Clear a rectangular region with solid color.
     * @param color - Fill color.
     * @param rect - Region to clear.
     */
    clearRect: (color: Color32, rect: Rect2i): void => {
        BTAPI.instance.clearRect(color, rect);
    },

    // ========================================================================
    // RENDERING - PRIMITIVES
    // ========================================================================

    /**
     * Draw a single pixel.
     * @param pos - Position.
     * @param color - Color.
     */
    drawPixel: (pos: Vector2i, color: Color32): void => {
        BTAPI.instance.drawPixel(pos, color);
    },

    /**
     * Draw a line.
     * @param p0 - Start point.
     * @param p1 - End point.
     * @param color - Color.
     */
    drawLine: (p0: Vector2i, p1: Vector2i, color: Color32): void => {
        BTAPI.instance.drawLine(p0, p1, color);
    },

    /**
     * Draw a rectangle outline.
     * @param rect - Rectangle bounds.
     * @param color - Color.
     */
    drawRect: (rect: Rect2i, color: Color32): void => {
        BTAPI.instance.drawRect(rect, color);
    },

    /**
     * Draw a filled rectangle.
     * @param rect - Rectangle bounds.
     * @param color - Color.
     */
    drawRectFill: (rect: Rect2i, color: Color32): void => {
        BTAPI.instance.drawRectFill(rect, color);
    },

    // ========================================================================
    // RENDERING - CAMERA
    // ========================================================================

    /**
     * Set camera offset for scrolling.
     * @param offset - Camera position offset.
     */
    cameraSet: (offset: Vector2i): void => {
        BTAPI.instance.setCameraOffset(offset);
    },

    /**
     * Get current camera offset.
     * @returns Current camera offset.
     */
    cameraGet: (): Vector2i => {
        return BTAPI.instance.getCameraOffset();
    },

    /**
     * Reset camera to (0, 0).
     */
    cameraReset: (): void => {
        BTAPI.instance.resetCamera();
    },

    // ========================================================================
    // INPUT - BUTTONS
    // ========================================================================

    /**
     * Check if button is currently held down.
     * @param _button - Button constant (BTN_*).
     * @param _player - Player index (0-3).
     * @returns True if button is held down.
     */
    buttonDown: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement
        return false;
    },

    /**
     * Check if button was just pressed this frame.
     * @param _button - Button constant (BTN_*).
     * @param _player - Player index (0-3).
     * @returns True if button was just pressed.
     */
    buttonPressed: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement
        return false;
    },

    /**
     * Check if button was just released this frame.
     * @param _button - Button constant (BTN_*).
     * @param _player - Player index (0-3).
     * @returns True if button was just released.
     */
    buttonReleased: (_button: number, _player: number = 0): boolean => {
        // TODO: Implement
        return false;
    },

    // ========================================================================
    // INPUT - KEYBOARD
    // ========================================================================

    /**
     * Check if key is currently held down.
     * @param _key - Key code (e.g., "KeyW", "Space", "ArrowUp").
     * @returns True if key is held down.
     */
    keyDown: (_key: string): boolean => {
        // TODO: Implement
        return false;
    },

    /**
     * Check if key was just pressed this frame.
     * @param _key - Key code.
     * @returns True if key was just pressed.
     */
    keyPressed: (_key: string): boolean => {
        // TODO: Implement
        return false;
    },

    /**
     * Check if key was just released this frame.
     * @param _key - Key code.
     * @returns True if key was just released.
     */
    keyReleased: (_key: string): boolean => {
        // TODO: Implement
        return false;
    },

    // ========================================================================
    // TEXT RENDERING
    // ========================================================================

    /**
     * Print text at position (placeholder - use printFont for proper fonts).
     * @param pos - Position.
     * @param color - Text color.
     * @param text - Text to print.
     */
    print: (pos: Vector2i, color: Color32, text: string): void => {
        BTAPI.instance.drawText(pos, color, text);
    },

    /**
     * Measure text bounds.
     * @param _text - Text to measure.
     * @returns Size of text in pixels.
     */
    printMeasure: (_text: string): Vector2i => {
        // TODO: Implement
        warnOnce('printMeasure', '[BT.printMeasure] Not yet implemented');
        return Vector2i.zero();
    },

    // ========================================================================
    // SPRITES
    // ========================================================================

    /**
     * Draw a sprite from a sprite sheet.
     * @param spriteSheet - Sprite sheet to draw from.
     * @param srcRect - Source rectangle in the sprite sheet.
     * @param destPos - Destination position on screen.
     * @param tint - Optional tint color (default: white).
     */
    drawSprite: (spriteSheet: SpriteSheet, srcRect: Rect2i, destPos: Vector2i, tint?: Color32): void => {
        BTAPI.instance.drawSprite(spriteSheet, srcRect, destPos, tint);
    },

    /**
     * Draw text using a bitmap font.
     * @param font - Bitmap font to use.
     * @param pos - Position to draw text.
     * @param text - Text to draw.
     * @param color - Optional text color (default: white).
     */
    printFont: (font: BitmapFont, pos: Vector2i, text: string, color?: Color32): void => {
        BTAPI.instance.drawBitmapText(font, pos, text, color);
    },

    // ========================================================================
    // EFFECTS
    // ========================================================================

    /**
     * Set post-processing effect.
     * @param _effect - Effect type.
     * @param _intensity - Effect intensity (0-1 typically).
     */
    effectSet: (_effect: Effect, _intensity: number): void => {
        // TODO: Implement
        warnOnce('effectSet', '[BT.effectSet] Not yet implemented');
    },

    /**
     * Reset all effects.
     */
    effectReset: (): void => {
        // TODO: Implement
        warnOnce('effectReset', '[BT.effectReset] Not yet implemented');
    },
};
