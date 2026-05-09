/**
 * Unit tests for {@link SoftwareTicker}.
 *
 * Verifies static banner rendering, camera save/restore, click-to-dismiss
 * behavior across pointer slots, and no-op behavior after dismissal.
 * Does not run the full BTAPI engine.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BitmapFont } from '../assets/BitmapFont';
import type { PointerInput } from '../input/PointerInput';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';
import { SoftwareTicker } from './SoftwareTicker';

// #region Helpers

function makeMockRenderer(): IRenderer {
    return {
        init: vi.fn().mockResolvedValue(true),
        beginFrame: vi.fn(),
        endFrame: vi.fn(),
        setPalette: vi.fn(),
        getPalette: vi.fn().mockReturnValue(null),
        setClearColor: vi.fn(),
        drawRectFill: vi.fn(),
        drawPixel: vi.fn(),
        drawLine: vi.fn(),
        drawRect: vi.fn(),
        clearRect: vi.fn(),
        drawSprite: vi.fn(),
        drawBitmapText: vi.fn(),
        captureFrame: vi.fn().mockResolvedValue(new Blob()),
        setCameraOffset: vi.fn(),
        getCameraOffset: vi.fn().mockReturnValue(new Vector2i(0, 0)),
        resetCamera: vi.fn(),
        addEffect: vi.fn(),
        removeEffect: vi.fn(),
        clearEffects: vi.fn(),
    } as unknown as IRenderer;
}

function makeMockFont(): BitmapFont {
    return {} as unknown as BitmapFont;
}

/**
 * Builds a minimal PointerInput stand-in.
 *
 * @param pressedSlot - Slot index that has a button-A press this frame, or -1 for no press.
 * @param pressY - Y coordinate of the press (display pixels).
 */
function makeMockPointer(pressedSlot: number, pressY: number): PointerInput {
    return {
        isButtonPressed: vi.fn().mockImplementation((button: number, slot: number) => {
            return button === 20 && slot === pressedSlot;
        }),
        getPos: vi.fn().mockReturnValue(new Vector2i(100, pressY)),
    } as unknown as PointerInput;
}

// #endregion

describe('SoftwareTicker', () => {
    let renderer: IRenderer;
    let font: BitmapFont;

    beforeEach(() => {
        renderer = makeMockRenderer();
        font = makeMockFont();
    });

    // #region Construction

    describe('constructor', () => {
        it('embeds the version string in the rendered text', () => {
            const ticker = new SoftwareTicker('1.2.3');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            expect(drawBitmapText.mock.calls[0]?.[2]).toContain('1.2.3');
        });

        it('includes SOFTWARE RENDERER prefix in the rendered text', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            expect(drawBitmapText.mock.calls[0]?.[2]).toContain('SOFTWARE RENDERER');
        });
    });

    // #endregion

    // #region Background rect

    describe('background rect', () => {
        it('draws a rect that starts at (0, 0)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawRectFill = vi.spyOn(renderer, 'drawRectFill');

            ticker.render(renderer, 320, font);

            const [rect] = drawRectFill.mock.calls[0] ?? [];
            expect(rect).toBeInstanceOf(Rect2i);
            if (rect instanceof Rect2i) {
                expect(rect.x).toBe(0);
                expect(rect.y).toBe(0);
            }
        });

        it('draws a rect spanning the full display width', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawRectFill = vi.spyOn(renderer, 'drawRectFill');

            ticker.render(renderer, 480, font);

            const [rect] = drawRectFill.mock.calls[0] ?? [];
            if (rect instanceof Rect2i) {
                expect(rect.width).toBe(480);
            }
        });

        it('draws the background rect with palette index 1', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawRectFill = vi.spyOn(renderer, 'drawRectFill');

            ticker.render(renderer, 320, font);

            const [, paletteIndex] = drawRectFill.mock.calls[0] ?? [];
            expect(paletteIndex).toBe(1);
        });
    });

    // #endregion

    // #region Text rendering

    describe('text rendering', () => {
        it('draws exactly one text call per render (no tiling)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            expect(drawBitmapText).toHaveBeenCalledOnce();
        });

        it('draws text with palette offset 1 (foreground pixel index 1 -> palette index 2)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            const [, , , paletteOffset] = drawBitmapText.mock.calls[0] ?? [];
            expect(paletteOffset).toBe(1);
        });

        it('centers text within the display width', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');
            const text = 'SOFTWARE RENDERER - blit-tech v0.2.0';
            const textWidth = text.length * 6;
            const expectedX = Math.floor((320 - textWidth) / 2);

            ticker.render(renderer, 320, font);

            const pos = drawBitmapText.mock.calls[0]?.[1] as Vector2i | undefined;
            expect(pos?.x).toBe(expectedX);
        });

        it('clamps text x to 0 when display is narrower than the text', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 10, font);

            const pos = drawBitmapText.mock.calls[0]?.[1] as Vector2i | undefined;
            expect(pos?.x).toBe(0);
        });
    });

    // #endregion

    // #region Camera save/restore

    describe('camera save/restore', () => {
        it('saves the camera, resets it, then restores it after drawing', () => {
            const savedOffset = new Vector2i(50, 30);
            vi.spyOn(renderer, 'getCameraOffset').mockReturnValue(savedOffset);
            const resetCamera = vi.spyOn(renderer, 'resetCamera');
            const setCameraOffset = vi.spyOn(renderer, 'setCameraOffset');

            const ticker = new SoftwareTicker('0.2.0');
            ticker.render(renderer, 320, font);

            expect(resetCamera).toHaveBeenCalledOnce();
            expect(setCameraOffset).toHaveBeenCalledWith(savedOffset);
        });
    });

    // #endregion

    // #region Dismiss on click/tap

    describe('dismiss on click/tap', () => {
        it('is not dismissed before any render', () => {
            const ticker = new SoftwareTicker('0.2.0');
            expect(ticker.isDismissed).toBe(false);
        });

        it('dismisses when primary button pressed within banner area on slot 0 (mouse)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const pointer = makeMockPointer(0, 7); // y=7 < TICKER_HEIGHT=15

            ticker.render(renderer, 320, font, pointer);

            expect(ticker.isDismissed).toBe(true);
        });

        it('dismisses when primary button pressed within banner area on touch slot 1', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const pointer = makeMockPointer(1, 7);

            ticker.render(renderer, 320, font, pointer);

            expect(ticker.isDismissed).toBe(true);
        });

        it('does not dismiss when press is below the banner area', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const pointer = makeMockPointer(0, 50); // y=50 > TICKER_HEIGHT=15

            ticker.render(renderer, 320, font, pointer);

            expect(ticker.isDismissed).toBe(false);
        });

        it('does not dismiss when no pointer is supplied', () => {
            const ticker = new SoftwareTicker('0.2.0');

            ticker.render(renderer, 320, font);
            ticker.render(renderer, 320, font, null);

            expect(ticker.isDismissed).toBe(false);
        });

        it('skips drawing on the dismissal frame (returns before drawRectFill)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawRectFill = vi.spyOn(renderer, 'drawRectFill');
            const pointer = makeMockPointer(0, 7);

            ticker.render(renderer, 320, font, pointer);

            expect(drawRectFill).not.toHaveBeenCalled();
        });

        it('does not render at all after being dismissed', () => {
            const ticker = new SoftwareTicker('0.2.0');

            // Dismiss via a click.
            ticker.render(renderer, 320, font, makeMockPointer(0, 7));
            expect(ticker.isDismissed).toBe(true);

            // Subsequent renders should be no-ops.
            const drawRectFill = vi.spyOn(renderer, 'drawRectFill');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');
            ticker.render(renderer, 320, font);

            expect(drawRectFill).not.toHaveBeenCalled();
            expect(drawBitmapText).not.toHaveBeenCalled();
        });
    });

    // #endregion
});
