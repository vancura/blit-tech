/**
 * Unit tests for {@link SoftwareTicker}.
 *
 * Verifies scroll state, banner dimensions, camera save/restore, and text
 * tiling — all without running the full BTAPI engine.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BitmapFont } from '../assets/BitmapFont';
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

// #endregion

describe('SoftwareTicker', () => {
    let renderer: IRenderer;
    let font: BitmapFont;

    beforeEach(() => {
        renderer = makeMockRenderer();
        font = makeMockFont();
    });

    // #region Constructor

    describe('constructor', () => {
        it('embeds the version string in the ticker text', () => {
            const ticker = new SoftwareTicker('1.2.3');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            expect(drawBitmapText.mock.calls[0]?.[2]).toContain('1.2.3');
        });

        it('includes SOFTWARE RENDERER prefix in the ticker text', () => {
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
        it('draws at least one text tile per render call', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            expect(drawBitmapText).toHaveBeenCalled();
        });

        it('draws text with palette offset 1 (foreground pixel index 1 -> palette index 2)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);

            const [, , , paletteOffset] = drawBitmapText.mock.calls[0] ?? [];
            expect(paletteOffset).toBe(1);
        });

        it('tiles text to fill a wide display (multiple drawBitmapText calls)', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            // With a display much wider than the text, multiple tiles are needed.
            ticker.render(renderer, 9999, font);

            expect(drawBitmapText.mock.calls.length).toBeGreaterThan(1);
        });
    });

    // #endregion

    // #region Scroll state

    describe('scroll state', () => {
        it('advances the scroll position each render call', () => {
            const ticker = new SoftwareTicker('0.2.0');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            ticker.render(renderer, 320, font);
            const xAfterFirstFrame = (drawBitmapText.mock.calls[0]?.[1] as Vector2i | undefined)?.x ?? 0;

            drawBitmapText.mockClear();
            ticker.render(renderer, 320, font);
            const xAfterSecondFrame = (drawBitmapText.mock.calls[0]?.[1] as Vector2i | undefined)?.x ?? 0;

            // Ticker scrolls left (x decreases by 1 each frame).
            expect(xAfterSecondFrame).toBe(xAfterFirstFrame - 1);
        });

        it('wraps scroll back to within text-width bounds after many frames', () => {
            const ticker = new SoftwareTicker('X');
            const drawBitmapText = vi.spyOn(renderer, 'drawBitmapText');

            // Drive many frames to force multiple wraps.
            for (let i = 0; i < 5000; i++) {
                ticker.render(renderer, 320, font);
            }

            // Inspect only the first tile of a fresh frame so we read scrollX directly.
            drawBitmapText.mockClear();
            ticker.render(renderer, 320, font);

            const firstX = (drawBitmapText.mock.calls[0]?.[1] as Vector2i | undefined)?.x ?? 0;
            const textWidth = 'SOFTWARE RENDERER - blit-tech vX  '.length * 6;
            expect(firstX).toBeGreaterThan(-textWidth);
            expect(firstX).toBeLessThanOrEqual(0);
        });
    });

    // #endregion

    // #region Camera save/restore

    describe('camera save/restore', () => {
        it('saves camera, resets it, then restores after render', () => {
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
});
