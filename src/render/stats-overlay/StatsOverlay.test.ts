/**
 * Integration tests for {@link StatsOverlay} draw layout and toggle behavior.
 */

import { describe, expect, it, vi } from 'vitest';

import { Palette } from '../../assets/Palette';
import { markRenderPaletteIndexUsed } from '../../core/RenderPaletteUsage';
import { Vector2i } from '../../utils/Vector2i';
import { STATS_BAR_HEIGHT, STATS_ROW_GAP_PX } from './constants';
import { createStatsOverlayLayout, statsRightAlignedTextX } from './layoutHelpers';
import { StatsOverlay } from './StatsOverlay';
import { computePaletteGrid } from './StatsOverlayPaletteView';
import {
    createMockRenderer,
    customRowBarY,
    getBitmapTextCalls,
    getRectFillCalls,
    mockFont,
    STATS_EDGE_MARGIN_PX,
    STATS_TOP_TEXT_Y,
} from './testFixtures';

/** Default overlay tests use the 13 px hint bar (palette grid opt-in off). */
const STATS_OVERLAY_PALETTE_VIEW_OFF = false;

/** Builds a usage mask from palette slot indices for tests. */
function buildUsageMask(indices: readonly number[], size = 256): Uint8Array {
    const mask = new Uint8Array(size);

    for (const index of indices) {
        markRenderPaletteIndexUsed(mask, index);
    }

    return mask;
}

describe('StatsOverlay', () => {
    it('starts visible and toggles visibility', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Test Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);

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
        const overlay = new StatsOverlay(layout, topLeftLabel, 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
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
            text: expect.stringMatching(/^Present: \d+ FPS \| Target: 60 FPS \| Draw Calls: \d+$/),
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
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'software', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const topRightCall = getBitmapTextCalls(renderer)[1];
        expect(topRightCall?.text).toBe('software | 320x240');
    });

    it('uses provided frame timings and shows update-step suffix when multiple updates ran', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
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
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 1);
        overlay.updateAndRender(renderer, mockFont, null, null, 2);

        expect(renderer.drawRectFillOnTop).not.toHaveBeenCalled();
        expect(renderer.drawBitmapTextOnTop).not.toHaveBeenCalled();
    });

    it('resets camera for overlay draws then restores the saved offset', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();
        const saved = new Vector2i(12, 34);

        renderer.getCameraOffset = vi.fn(() => saved);
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.resetCamera).toHaveBeenCalledOnce();
        expect(renderer.setCameraOffset).toHaveBeenCalledWith(saved);
    });

    it('uses default overlay palette indices when style is omitted', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const calls = getBitmapTextCalls(renderer);

        expect(calls.every((call) => call.paletteOffset === 1)).toBe(true);
        expect(renderer.drawRectFillOnTop).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('uses statsOverlayStyle palette indices when provided', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(
            layout,
            'Demo',
            60,
            'webgpu',
            { barPaletteIndex: 8, textPaletteIndex: 9 },
            STATS_OVERLAY_PALETTE_VIEW_OFF,
        );
        const renderer = createMockRenderer();
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.drawRectFillOnTop).toHaveBeenCalledWith(expect.anything(), 8);

        const calls = getBitmapTextCalls(renderer);

        expect(calls[0]?.paletteOffset).toBe(8);
    });

    it('draws custom rows with per-row palette indices', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(
            layout,
            'Demo',
            60,
            'webgpu',
            { barPaletteIndex: 2, textPaletteIndex: 3 },
            STATS_OVERLAY_PALETTE_VIEW_OFF,
        );
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
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();
        const customRows = [{ leftText: 'Position: 10, 20' }, { leftText: 'Bounces: 3', rightText: 'ok' }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows);

        const fills = getRectFillCalls(renderer);
        const row0BarY = customRowBarY(240, 0);
        const row1BarY = customRowBarY(240, 1);

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
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => []);

        expect(getRectFillCalls(renderer)).toHaveLength(4);
        expect(getBitmapTextCalls(renderer)).toHaveLength(5);
    });

    it('does not invoke getCustomRows while the overlay is hidden', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, STATS_OVERLAY_PALETTE_VIEW_OFF);
        const renderer = createMockRenderer();
        const getCustomRows = vi.fn(() => [{ leftText: 'Hidden row' }] as const);

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 1);
        overlay.updateAndRender(renderer, mockFont, null, null, 0, getCustomRows);

        expect(getCustomRows).not.toHaveBeenCalled();
    });

    it('renders palette grid when statsOverlayPaletteView is enabled', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, true);
        const renderer = createMockRenderer();
        const palette = Palette.vga();
        const usedMask = buildUsageMask([1, 2, 3, 4, 5, 6, 7, 8]);
        const grid = computePaletteGrid(320, undefined, palette.size);

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, undefined, palette, usedMask);

        const fills = getRectFillCalls(renderer);
        expect(fills[3]).toMatchObject({ y: 240 - grid.totalHeight, height: grid.totalHeight, width: 320 });
        expect(renderer.drawRectFillOnTop.mock.calls.length).toBeGreaterThan(4);
    });

    it('preserves default hint bar height when palette view is disabled', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, false);
        const renderer = createMockRenderer();
        const palette = Palette.vga();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, undefined, palette);

        const fills = getRectFillCalls(renderer);
        expect(fills[3]).toMatchObject({ y: 227, height: STATS_BAR_HEIGHT, width: 320 });
        const swatchCalls = renderer.drawRectFillOnTop.mock.calls.filter(
            (call) => (call[0] as { width: number }).width === 1,
        );
        expect(swatchCalls).toHaveLength(0);
    });

    it('stacks custom rows above the palette grid bottom band', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60, 'webgpu', undefined, true);
        const renderer = createMockRenderer();
        const palette = Palette.vga();
        const usedMask = buildUsageMask([1, 2, 3, 4, 5, 6, 7, 8]);
        const grid = computePaletteGrid(320, undefined, palette.size);
        const customRows = [{ leftText: 'Palette row' }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows, undefined, palette, usedMask);

        const fills = getRectFillCalls(renderer);
        const row0BarY = customRowBarY(240, 0, grid.totalHeight);
        const customRowFill = fills.find((rect) => rect.height === STATS_BAR_HEIGHT && rect.y === row0BarY);

        expect(customRowFill).toMatchObject({ y: row0BarY, width: 320, height: STATS_BAR_HEIGHT });
    });
});
