/**
 * Software-mode status ticker overlay.
 *
 * Renders a static "SOFTWARE RENDERER - blit-tech vX.Y.Z" banner centered at
 * the top of the canvas using palette-indexed draw calls. Tapping or clicking
 * the banner dismisses it permanently. Designed to be instantiated by BTAPI
 * when the software backend starts and called once per render frame.
 */

import type { BitmapFont } from '../assets/BitmapFont';
import type { PointerInput } from '../input/PointerInput';
import { POINTER_SLOT_COUNT } from '../input/PointerInput';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';

// #region Constants

/** Height in pixels of the ticker banner strip. */
const TICKER_HEIGHT = 15;

/** System font glyph advance in pixels (matches SYSTEM_FONT_GLYPH_WIDTH = 6). */
const TICKER_CHAR_ADVANCE = 6;

/** Palette index for the ticker background fill. */
const TICKER_BG_INDEX = 1;

/**
 * Palette index for the ticker text.
 *
 * The system font stores foreground pixels at palette index 1. Passing
 * `TICKER_TEXT_INDEX - 1` as `paletteOffset` remaps those pixels to this slot.
 */
const TICKER_TEXT_INDEX = 2;

/**
 * Pointer button code for primary press (mouse left / touch contact).
 *
 * Mirrors the private `BTN_POINTER_A = 20` constant in PointerInput.ts and
 * the `BT.BTN_POINTER_A` bit-flag mapped through `pointerFlagToPointerCode`.
 */
const DISMISS_BUTTON_CODE = 20;

// #endregion

// #region SoftwareTicker

/**
 * Static status banner rendered when the software backend is active.
 *
 * The banner is centered horizontally. Clicking or tapping anywhere on the
 * banner permanently hides it; BTAPI checks {@link isDismissed} after each
 * {@link render} call and nulls out its reference when the banner is gone.
 */
export class SoftwareTicker {
    /** Scrolling text content built from the engine version string. */
    private readonly text: string;

    /** True once the user has dismissed the banner by clicking or tapping it. */
    private dismissed = false;

    /**
     * Creates a ticker for the given engine version.
     *
     * @param version - Engine version string (e.g. `"0.2.0"`), embedded in the banner text.
     */
    constructor(version: string) {
        this.text = `SOFTWARE RENDERER - blit-tech v${version}`;
    }

    /**
     * Whether the banner has been dismissed by the user.
     *
     * BTAPI reads this after each {@link render} call and drops its reference
     * when `true` so subsequent frames skip the ticker entirely.
     *
     * @returns `true` once the user has clicked or tapped the banner; `false` until then.
     */
    get isDismissed(): boolean {
        return this.dismissed;
    }

    /**
     * Renders one frame of the ticker onto the given renderer.
     *
     * Returns immediately when the banner has already been dismissed. When a
     * pointer press is detected within the banner area the banner is marked
     * dismissed and this call returns without drawing.
     *
     * @param renderer - Active renderer backend.
     * @param displayWidth - Logical display width in pixels.
     * @param font - System bitmap font used to draw the label text.
     * @param pointer - Optional pointer subsystem; when supplied, click/tap within the banner dismisses it.
     */
    render(renderer: IRenderer, displayWidth: number, font: BitmapFont, pointer: PointerInput | null = null): void {
        if (this.dismissed) {
            return;
        }

        if (pointer) {
            for (let slot = 0; slot < POINTER_SLOT_COUNT; slot++) {
                if (pointer.isButtonPressed(DISMISS_BUTTON_CODE, slot) && pointer.getPos(slot).y < TICKER_HEIGHT) {
                    this.dismissed = true;
                    return;
                }
            }
        }

        const savedCamera = renderer.getCameraOffset();
        renderer.resetCamera();

        renderer.drawRectFill(new Rect2i(0, 0, displayWidth, TICKER_HEIGHT), TICKER_BG_INDEX);

        const textWidth = this.text.length * TICKER_CHAR_ADVANCE;
        const x = Math.max(0, Math.floor((displayWidth - textWidth) / 2));
        renderer.drawBitmapText(font, new Vector2i(x, 1), this.text, TICKER_TEXT_INDEX - 1);

        renderer.setCameraOffset(savedCamera);
    }
}

// #endregion
