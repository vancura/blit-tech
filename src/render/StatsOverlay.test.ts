/**
 * Unit tests for {@link StatsOverlay} layout helpers, label parsing, and draw layout.
 *
 * Layout contract (see {@link StatsOverlay} and docs/api-core.md Stats overlay):
 * - Top row 1: demo title (left), `backend | WxH` (right)
 * - Top row 2: `Present FPS | Target FPS | Draw Calls`
 * - Top row 3: `Frame | update() | render()`
 * - Bottom row: `[~]` hint (right)
 * - Custom rows: demo-supplied bars stacked above the bottom bar (1 px gaps)
 */

import { describe, expect, it, vi } from 'vitest';

import type { BitmapFont } from '../assets/BitmapFont';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';
import {
    createStatsOverlayLayout,
    isPointerInStatsToggleCorner,
    resolveStatsTopLeftLabel,
    StatsOverlay,
    statsRightAlignedTextX,
} from './StatsOverlay';

// #region Test Helpers

const STATS_EDGE_MARGIN_PX = 3;
const STATS_TOP_TEXT_Y = 0;
const STATS_BAR_HEIGHT = 13;
const STATS_ROW_GAP_PX = 1;
const SYSTEM_CHAR_ADVANCE = 6;

type BitmapTextCall = {
    pos: Vector2i;
    text: string;
    paletteOffset: number;
};

/**
 * Minimal renderer stub for {@link StatsOverlay.updateAndRender}.
 *
 * @returns Renderer with spied camera, bar fills, and bitmap text draws.
 */
function createMockRenderer(): IRenderer & {
    drawBitmapText: ReturnType<typeof vi.fn>;
    drawBitmapTextOnTop: ReturnType<typeof vi.fn>;
    drawRectFill: ReturnType<typeof vi.fn>;
    drawRectFillOnTop: ReturnType<typeof vi.fn>;
} {
    const drawRectFillOnTop = vi.fn();
    const drawBitmapTextOnTop = vi.fn();

    return {
        getCameraOffset: vi.fn(() => Vector2i.zero()),
        resetCamera: vi.fn(),
        setCameraOffset: vi.fn(),
        drawRectFill: vi.fn(),
        drawRectFillOnTop,
        drawBitmapText: vi.fn(),
        drawBitmapTextOnTop,
    } as never;
}

/**
 * Collects {@link IRenderer.drawBitmapText} calls from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Parsed draw calls in invocation order.
 */
function getBitmapTextCalls(renderer: ReturnType<typeof createMockRenderer>): BitmapTextCall[] {
    return renderer.drawBitmapTextOnTop.mock.calls.map((call) => ({
        pos: call[1] as Vector2i,
        text: call[2] as string,
        paletteOffset: call[3] as number,
    }));
}

/**
 * Collects {@link IRenderer.drawRectFill} rects from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Filled rectangles in invocation order.
 */
function getRectFillCalls(renderer: ReturnType<typeof createMockRenderer>): Rect2i[] {
    return renderer.drawRectFillOnTop.mock.calls.map((call) => call[0] as Rect2i);
}

/** Y of custom row bar top stacked above the bottom `[~]` bar. */
function customBarY(displayHeight: number, rowIndex: number): number {
    const bottomBarY = displayHeight - STATS_BAR_HEIGHT;

    return bottomBarY - (rowIndex + 1) * (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);
}

const mockFont = {} as BitmapFont;

// #endregion

// #region resolveStatsTopLeftLabel

describe('resolveStatsTopLeftLabel', () => {
    it('formats registry-style page titles without a Blit-Tech prefix', () => {
        expect(resolveStatsTopLeftLabel('Blit-Tech Demo 006 - Patterns')).toBe('Patterns Demo');
        expect(resolveStatsTopLeftLabel('Blit-Tech Demo 002 - Primitives')).toBe('Primitives Demo');
    });

    it('falls back when title is empty', () => {
        expect(resolveStatsTopLeftLabel('')).toBe('Demo');
        expect(resolveStatsTopLeftLabel(undefined)).toBe('Demo');
    });

    it('passes through non-registry titles unchanged', () => {
        expect(resolveStatsTopLeftLabel('Custom Page')).toBe('Custom Page');
    });
});

// #endregion

// #region createStatsOverlayLayout

describe('createStatsOverlayLayout', () => {
    it('places bottom text at the configured bottom gap offset', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(layout.displayWidth).toBe(320);
        expect(layout.displayHeight).toBe(240);
        expect(layout.bottomTextY).toBe(240 - 14 + 1);
        expect(layout.topTextY).toBe(STATS_TOP_TEXT_Y);
        expect(layout.toggleRect.x).toBe(320 - 48);
        expect(layout.toggleRect.y).toBe(240 - 48);
        expect(layout.toggleRect.width).toBe(48);
        expect(layout.toggleRect.height).toBe(48);
    });
});

// #endregion

// #region statsRightAlignedTextX

describe('statsRightAlignedTextX', () => {
    it('places text flush right with edge margin (+1 px inset)', () => {
        const label = 'webgpu | 320x240';
        const width = label.length * SYSTEM_CHAR_ADVANCE;
        expect(statsRightAlignedTextX(label, 320)).toBe(320 - width - STATS_EDGE_MARGIN_PX + 1);
    });

    it('never places text left of the edge margin', () => {
        expect(statsRightAlignedTextX('a very long label that exceeds the display', 32)).toBe(STATS_EDGE_MARGIN_PX);
    });
});

// #endregion

// #region isPointerInStatsToggleCorner

describe('isPointerInStatsToggleCorner', () => {
    it('returns true inside the bottom-right 48x48 region', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(isPointerInStatsToggleCorner(new Vector2i(300, 220), layout.toggleRect)).toBe(true);
        expect(isPointerInStatsToggleCorner(new Vector2i(272, 192), layout.toggleRect)).toBe(true);
    });

    it('returns false outside the toggle region', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(isPointerInStatsToggleCorner(new Vector2i(0, 0), layout.toggleRect)).toBe(false);
        expect(isPointerInStatsToggleCorner(new Vector2i(271, 191), layout.toggleRect)).toBe(false);
    });
});

// #endregion

// #region StatsOverlay

describe('StatsOverlay', () => {
    it('starts visible and toggles visibility', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Test Demo', 60, 'webgpu');

        expect(overlay.visible).toBe(true);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            1,
        );

        expect(overlay.visible).toBe(false);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            2,
        );

        expect(overlay.visible).toBe(true);
    });

    it('draws top and bottom overlay labels', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const topLeftLabel = 'Patterns Demo';
        const overlay = new StatsOverlay(layout, topLeftLabel, 60, 'webgpu');
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const calls = getBitmapTextCalls(renderer);
        const topRightLabel = 'webgpu | 320x240';
        const topRightX = statsRightAlignedTextX(topRightLabel, 320);
        const bottomRightLabel = '[~]';
        const bottomRightX = statsRightAlignedTextX(bottomRightLabel, 320);

        expect(calls).toHaveLength(5);
        expect(calls[0]).toEqual({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, STATS_TOP_TEXT_Y),
            text: topLeftLabel,
            paletteOffset: 1,
        });
        expect(calls[1]).toEqual({
            pos: new Vector2i(topRightX, STATS_TOP_TEXT_Y),
            text: topRightLabel,
            paletteOffset: 1,
        });
        expect(calls[2]).toMatchObject({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, STATS_BAR_HEIGHT + STATS_ROW_GAP_PX + STATS_TOP_TEXT_Y),
            text: expect.stringMatching(/^Present FPS: \d+ \| Target FPS: 60 \| Draw Calls: \d+$/),
            paletteOffset: 1,
        });
        expect(calls[3]).toMatchObject({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX) * 2 + STATS_TOP_TEXT_Y),
            text: expect.any(String),
            paletteOffset: 1,
        });
        expect(calls[3]?.text).toContain('Frame: ');
        expect(calls[3]?.text).toContain(' | update(): ');
        expect(calls[3]?.text).toContain(' | render(): ');
        expect(calls[4]).toEqual({
            pos: new Vector2i(bottomRightX, layout.bottomTextY),
            text: bottomRightLabel,
            paletteOffset: 1,
        });
    });

    it('uses activeBackend for the top-right label', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'software');
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const topRightCall = getBitmapTextCalls(renderer)[1];
        expect(topRightCall?.text).toBe('software | 320x240');
    });

    it('uses provided frame timings and shows update-step suffix when multiple updates ran', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, {
            frameMs: 8.25,
            updateMs: 1.5,
            renderMs: 3.75,
            updateSteps: 3,
            drawCalls: 42,
        });

        const calls = getBitmapTextCalls(renderer);
        expect(calls[2]?.text).toContain('Draw Calls: 42');
        expect(calls[3]?.text).toContain('Frame: 8.3ms');
        expect(calls[3]?.text).toContain('update(): 1.5msx3');
        expect(calls[3]?.text).toContain('render(): 3.8ms');
    });

    it('skips draw calls when hidden', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 1);
        overlay.updateAndRender(renderer, mockFont, null, null, 2);

        expect(renderer.drawRectFillOnTop).not.toHaveBeenCalled();
        expect(renderer.drawBitmapTextOnTop).not.toHaveBeenCalled();
    });

    it('resets camera for overlay draws then restores the saved offset', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();
        const saved = new Vector2i(12, 34);

        renderer.getCameraOffset = vi.fn(() => saved);
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.resetCamera).toHaveBeenCalledOnce();
        expect(renderer.setCameraOffset).toHaveBeenCalledWith(saved);
    });

    it('uses default overlay palette indices when style is omitted', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const calls = getBitmapTextCalls(renderer);

        expect(calls.every((call) => call.paletteOffset === 1)).toBe(true);
        expect(renderer.drawRectFillOnTop).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('uses statsOverlayStyle palette indices when provided', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', { barPaletteIndex: 8, textPaletteIndex: 9 });
        const renderer = createMockRenderer();
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.drawRectFillOnTop).toHaveBeenCalledWith(expect.anything(), 8);

        const calls = getBitmapTextCalls(renderer);

        expect(calls[0]?.paletteOffset).toBe(8);
    });

    it('draws custom rows with per-row palette indices', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', { barPaletteIndex: 2, textPaletteIndex: 3 });
        const renderer = createMockRenderer();
        const customRows = [{ leftText: 'Left', barPaletteIndex: 5, textPaletteIndex: 6 }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows);

        const fills = getRectFillCalls(renderer);

        expect(renderer.drawRectFillOnTop).toHaveBeenCalledWith(fills[4], 5);

        const calls = getBitmapTextCalls(renderer);

        expect(calls[0]?.paletteOffset).toBe(5);
    });

    it('draws custom rows stacked above the bottom bar with 1px gaps', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();
        const customRows = [{ leftText: 'Position: 10, 20' }, { leftText: 'Bounces: 3', rightText: 'ok' }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows);

        const fills = getRectFillCalls(renderer);
        const row0BarY = customBarY(240, 0);
        const row1BarY = customBarY(240, 1);

        expect(fills).toHaveLength(6);
        expect(fills[4]).toMatchObject({ y: row0BarY, width: 320, height: STATS_BAR_HEIGHT });
        expect(fills[5]).toMatchObject({ y: row1BarY, width: 320, height: STATS_BAR_HEIGHT });
        expect(row0BarY - row1BarY).toBe(STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);

        const calls = getBitmapTextCalls(renderer);
        const rightX = statsRightAlignedTextX('ok', 320);

        expect(calls).toHaveLength(8);
        expect(calls[0]).toEqual({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, row0BarY + STATS_TOP_TEXT_Y),
            text: 'Position: 10, 20',
            paletteOffset: 1,
        });
        expect(calls[1]).toEqual({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, row1BarY + STATS_TOP_TEXT_Y),
            text: 'Bounces: 3',
            paletteOffset: 1,
        });
        expect(calls[2]).toEqual({
            pos: new Vector2i(rightX, row1BarY + STATS_TOP_TEXT_Y),
            text: 'ok',
            paletteOffset: 1,
        });
    });

    it('skips extra custom row draws when customRows is empty', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => []);

        expect(getRectFillCalls(renderer)).toHaveLength(4);
        expect(getBitmapTextCalls(renderer)).toHaveLength(5);
    });

    it('does not invoke getCustomRows while the overlay is hidden', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu');
        const renderer = createMockRenderer();
        const getCustomRows = vi.fn(() => [{ leftText: 'Hidden row' }] as const);

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 1);
        overlay.updateAndRender(renderer, mockFont, null, null, 0, getCustomRows);

        expect(getCustomRows).not.toHaveBeenCalled();
    });
});

// #endregion
