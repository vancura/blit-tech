/**
 * Software-mode status ticker overlay.
 *
 * Renders a scrolling "SOFTWARE RENDERER - blit-tech vX.Y.Z" banner at
 * the top of the canvas using palette-indexed draw calls. Designed to be
 * instantiated by BTAPI when the software backend starts and called once
 * per render frame.
 */

import type { BitmapFont } from '../assets/BitmapFont';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';

// #region Constants

/** Height in pixels of the ticker banner strip. */
const TICKER_HEIGHT = 16;

/** System font glyph advance in pixels (matches SYSTEM_FONT_GLYPH_WIDTH = 6). */
const TICKER_CHAR_ADVANCE = 6;

/** Pixels to scroll left per rendered frame. */
const TICKER_SCROLL_SPEED = 1;

/** Palette index for the ticker background fill. */
const TICKER_BG_INDEX = 1;

/**
 * Palette index for the ticker text.
 *
 * The system font stores foreground pixels at palette index 1. Passing
 * `TICKER_TEXT_INDEX - 1` as `paletteOffset` remaps those pixels to this slot.
 */
const TICKER_TEXT_INDEX = 2;

// #endregion

// #region SoftwareTicker

/**
 * Scrolling status banner rendered when the software backend is active.
 *
 * Holds its own scroll state. Each call to {@link render} advances the
 * animation by one frame. The camera is saved and restored so the banner
 * is always viewport-relative regardless of the demo's camera position.
 */
export class SoftwareTicker {
    /** Scrolling text content built from the engine version string. */
    private readonly text: string;

    /** Current horizontal scroll offset; advances left each frame. */
    private scrollX = 0;

    /**
     * Creates a ticker for the given engine version.
     *
     * @param version - Engine version string (e.g. `"0.2.0"`), embedded in the banner text.
     */
    constructor(version: string) {
        this.text = `SOFTWARE RENDERER - blit-tech v${version}  `;
    }

    /**
     * Renders one frame of the ticker onto the given renderer.
     *
     * @param renderer - Active renderer backend.
     * @param displayWidth - Logical display width in pixels.
     * @param font - System bitmap font used to draw the scrolling text.
     */
    render(renderer: IRenderer, displayWidth: number, font: BitmapFont): void {
        const textWidth = this.text.length * TICKER_CHAR_ADVANCE;

        // Advance scroll; wrap with modular arithmetic so tiled copies remain seamless.
        this.scrollX -= TICKER_SCROLL_SPEED;
        if (this.scrollX < -textWidth) {
            this.scrollX += textWidth;
        }

        const savedCamera = renderer.getCameraOffset();
        renderer.resetCamera();

        renderer.drawRectFill(new Rect2i(0, 0, displayWidth, TICKER_HEIGHT), TICKER_BG_INDEX);

        const paletteOffset = TICKER_TEXT_INDEX - 1;
        let x = this.scrollX;
        while (x < displayWidth) {
            renderer.drawBitmapText(font, new Vector2i(x, 1), this.text, paletteOffset);
            x += textWidth;
        }

        renderer.setCameraOffset(savedCamera);
    }
}

// #endregion
