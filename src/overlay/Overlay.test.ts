/**
 * Integration tests for {@link Overlay} draw layout and toggle behavior.
 */

import { describe, expect, it, vi } from 'vitest';

import { Palette } from '../assets/Palette';
import { markRenderPaletteIndexUsed } from '../core/RenderPaletteUsage';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { OVERLAY_BAR_HEIGHT, OVERLAY_ROW_GAP_PX } from './layout/constants';
import { createOverlayLayout, overlayRightAlignedTextX, overlayToggleHintTextX } from './layout/layoutHelpers';
import { hintBarY, paletteBandY } from './layout/layoutPlan';
import { Overlay } from './Overlay';
import { computePaletteGrid, writePaletteSwatchTopLeft } from './palette/PaletteView';
import {
    createMockRenderer,
    customRowBarY,
    getBitmapTextCalls,
    getRectFillCalls,
    mockFont,
    OVERLAY_EDGE_MARGIN_PX,
    OVERLAY_TOP_TEXT_Y,
} from './testFixtures';

/** Default overlay tests use the 13 px hint bar (palette grid opt-in off). */
const OVERLAY_PALETTE_VIEW_OFF = false;

interface OverlayTestOptions {
    style?: { barPaletteIndex?: number; textPaletteIndex?: number };
    paletteView?: boolean;
    paletteColumns?: number;
    timingChart?: boolean;
    timingChartStyle?: { updateBarPaletteIndex?: number; renderBarPaletteIndex?: number };
    timingChartHeight?: number;
    visibleAtStart?: boolean;
    toggleHintVisible?: boolean;
    toggleEnabled?: boolean;
    backend?: 'webgpu' | 'software';
}

/** Builds a {@link Overlay} with explicit VV-546 visibility defaults for tests. */
function createOverlay(
    layout: ReturnType<typeof createOverlayLayout>,
    label: string,
    options: OverlayTestOptions = {},
): Overlay {
    return new Overlay(
        layout,
        label,
        60,
        options.backend ?? 'webgpu',
        options.style,
        options.paletteView ?? OVERLAY_PALETTE_VIEW_OFF,
        options.paletteColumns,
        options.timingChart ?? false,
        options.timingChartStyle,
        options.timingChartHeight,
        options.visibleAtStart ?? false,
        options.toggleHintVisible ?? true,
        options.toggleEnabled ?? true,
    );
}

/** Builds a usage mask from palette slot indices for tests. */
function buildUsageMask(indices: readonly number[], size = 256): Uint8Array {
    const mask = new Uint8Array(size);

    for (const index of indices) {
        markRenderPaletteIndexUsed(mask, index);
    }

    return mask;
}

describe('Overlay', () => {
    it('tracksPaletteUsage is false when palette grid is disabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Test Demo');

        expect(overlay.tracksPaletteUsage).toBe(false);
    });

    it('tracksPaletteUsage follows palette grid opt-in and visibility toggle', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Test Demo', { paletteView: true, visibleAtStart: true });

        expect(overlay.tracksPaletteUsage).toBe(true);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            1,
        );

        expect(overlay.tracksPaletteUsage).toBe(false);
    });

    it('swatch press in the toggle corner does not toggle overlay body (VV-549)', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Test Demo', { paletteView: true, visibleAtStart: true });
        const grid = computePaletteGrid(320);
        const paletteBandTop = paletteBandY(240, grid.totalHeight);
        const paletteBand = new Rect2i(0, paletteBandTop, 320, grid.totalHeight);
        const swatch = new Rect2i();
        const index = grid.cols * (grid.rows - 1);

        writePaletteSwatchTopLeft(swatch, index, paletteBand, grid);

        overlay.handleFrameInput(
            {
                isButtonPressed: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            null,
            1,
        );

        expect(overlay.bodyVisible).toBe(true);
    });

    it('starts hidden by default and toggles body visibility', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Test Demo');

        expect(overlay.bodyVisible).toBe(false);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            1,
        );

        expect(overlay.bodyVisible).toBe(true);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            2,
        );

        expect(overlay.bodyVisible).toBe(false);
    });

    it('draws top and bottom overlay labels when body is visible', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const topLeftLabel = 'Patterns Demo';
        const overlay = createOverlay(layout, topLeftLabel, { visibleAtStart: true });
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const calls = getBitmapTextCalls(renderer);
        const topRightLabel = 'webgpu | 320x240';
        const topRightX = overlayRightAlignedTextX(topRightLabel, 320);
        const bottomHintLabel = '[~]';
        const bottomHintX = overlayToggleHintTextX();

        expect(calls).toHaveLength(5);
        expect(calls[0]).toEqual({
            pos: new Vector2i(OVERLAY_EDGE_MARGIN_PX, OVERLAY_TOP_TEXT_Y),
            text: topLeftLabel,
            paletteOffset: 1,
        });
        expect(calls[1]).toEqual({
            pos: new Vector2i(topRightX, OVERLAY_TOP_TEXT_Y),
            text: topRightLabel,
            paletteOffset: 1,
        });
        expect(calls[2]).toMatchObject({
            pos: new Vector2i(OVERLAY_EDGE_MARGIN_PX, OVERLAY_BAR_HEIGHT + OVERLAY_ROW_GAP_PX + OVERLAY_TOP_TEXT_Y),
            text: expect.stringMatching(/^Present: \d+ FPS \| Target: 60 FPS \| Draw Calls: \d+$/),
            paletteOffset: 1,
        });
        expect(calls[3]).toMatchObject({
            pos: new Vector2i(
                OVERLAY_EDGE_MARGIN_PX,
                (OVERLAY_BAR_HEIGHT + OVERLAY_ROW_GAP_PX) * 2 + OVERLAY_TOP_TEXT_Y,
            ),
            text: expect.any(String),
            paletteOffset: 1,
        });
        expect(calls[3]?.text).toContain('Frame: ');
        expect(calls[3]?.text).toContain(' | update(): ');
        expect(calls[3]?.text).toContain(' | render(): ');
        expect(calls[4]).toEqual({
            pos: new Vector2i(bottomHintX, layout.bottomTextY),
            text: bottomHintLabel,
            paletteOffset: 1,
        });
    });

    it('uses activeBackend for the top-right label', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { backend: 'software', visibleAtStart: true });
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const topRightCall = getBitmapTextCalls(renderer)[1];
        expect(topRightCall?.text).toBe('software | 320x240');
    });

    it('uses provided frame timings and shows update-step suffix when multiple updates ran', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
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

    it('skips draw calls when body is hidden and the toggle hint is disabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { toggleHintVisible: false });
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.drawBarFill).not.toHaveBeenCalled();
        expect(renderer.drawLabel).not.toHaveBeenCalled();
    });

    it('draws hint-only path while body is hidden and toggle hint is visible', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo');
        const renderer = createMockRenderer();
        const bottomHintLabel = '[~]';
        const bottomHintX = overlayToggleHintTextX();

        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(getRectFillCalls(renderer)).toHaveLength(1);
        expect(getRectFillCalls(renderer)[0]).toMatchObject({
            y: hintBarY(240),
            height: OVERLAY_BAR_HEIGHT,
            width: 320,
        });
        expect(getBitmapTextCalls(renderer)).toEqual([
            {
                pos: new Vector2i(bottomHintX, layout.bottomTextY),
                text: bottomHintLabel,
                paletteOffset: 1,
            },
        ]);
    });

    it('does not draw the palette band while body is hidden even when palette view is enabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { paletteView: true });
        const renderer = createMockRenderer();
        const grid = computePaletteGrid(320, undefined, 256);

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, undefined, Palette.vga());

        const fills = getRectFillCalls(renderer);

        expect(fills).toHaveLength(1);
        expect(fills[0]).toMatchObject({ y: hintBarY(240), height: OVERLAY_BAR_HEIGHT, width: 320 });
        expect(fills.some((rect) => rect.y === paletteBandY(240, grid.totalHeight))).toBe(false);
    });

    it('resets camera for overlay draws then restores the saved offset', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
        const renderer = createMockRenderer();
        const saved = new Vector2i(12, 34);

        renderer.getCameraOffset = vi.fn(() => saved);
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.resetCamera).toHaveBeenCalledOnce();
        expect(renderer.setCameraOffset).toHaveBeenCalledWith(saved);
    });

    it('uses default overlay palette indices when style is omitted', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
        const renderer = createMockRenderer();
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        const calls = getBitmapTextCalls(renderer);

        expect(calls.every((call) => call.paletteOffset === 1)).toBe(true);
        expect(renderer.drawBarFill).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('uses overlayStyle palette indices when provided', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', {
            style: { barPaletteIndex: 8, textPaletteIndex: 9 },
            visibleAtStart: true,
        });
        const renderer = createMockRenderer();
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.drawBarFill).toHaveBeenCalledWith(expect.anything(), 8);

        const calls = getBitmapTextCalls(renderer);

        expect(calls[0]?.paletteOffset).toBe(8);
    });

    it('draws custom rows with per-row palette indices', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', {
            style: { barPaletteIndex: 2, textPaletteIndex: 3 },
            visibleAtStart: true,
        });
        const renderer = createMockRenderer();
        const customRows = [{ leftText: 'Left', barPaletteIndex: 5, textPaletteIndex: 6 }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows);

        const fills = getRectFillCalls(renderer);

        expect(renderer.drawBarFill).toHaveBeenCalledWith(fills[3], 5);

        const calls = getBitmapTextCalls(renderer);

        expect(calls[0]?.paletteOffset).toBe(5);
    });

    it('draws custom rows stacked above the bottom bar with 1px gaps', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
        const renderer = createMockRenderer();
        const customRows = [{ leftText: 'Position: 10, 20' }, { leftText: 'Bounces: 3', rightText: 'ok' }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows);

        const fills = getRectFillCalls(renderer);
        const row0BarY = customRowBarY(240, 0);
        const row1BarY = customRowBarY(240, 1);

        expect(fills).toHaveLength(6);
        expect(fills[3]).toMatchObject({ y: row0BarY, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(fills[4]).toMatchObject({ y: row1BarY, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(fills[5]).toMatchObject({ y: hintBarY(240), width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(row0BarY - row1BarY).toBe(OVERLAY_BAR_HEIGHT + OVERLAY_ROW_GAP_PX);

        const calls = getBitmapTextCalls(renderer);
        const rightX = overlayRightAlignedTextX('ok', 320);

        expect(calls).toHaveLength(8);
        expect(calls[0]).toEqual({
            pos: new Vector2i(OVERLAY_EDGE_MARGIN_PX, row0BarY + OVERLAY_TOP_TEXT_Y),
            text: 'Position: 10, 20',
            paletteOffset: 1,
        });
        expect(calls[1]).toEqual({
            pos: new Vector2i(OVERLAY_EDGE_MARGIN_PX, row1BarY + OVERLAY_TOP_TEXT_Y),
            text: 'Bounces: 3',
            paletteOffset: 1,
        });
        expect(calls[2]).toEqual({
            pos: new Vector2i(rightX, row1BarY + OVERLAY_TOP_TEXT_Y),
            text: 'ok',
            paletteOffset: 1,
        });
    });

    it('skips extra custom row draws when customRows is empty', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => []);

        expect(getRectFillCalls(renderer)).toHaveLength(4);
        expect(getBitmapTextCalls(renderer)).toHaveLength(5);
    });

    it('does not invoke getCustomRows while the overlay is hidden', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo');
        const renderer = createMockRenderer();
        const getCustomRows = vi.fn(() => [{ leftText: 'Hidden row' }] as const);

        overlay.updateAndRender(renderer, mockFont, null, null, 0, getCustomRows);

        expect(getCustomRows).not.toHaveBeenCalled();
    });

    it('renders palette grid when overlayPaletteView is enabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { paletteView: true, visibleAtStart: true });
        const renderer = createMockRenderer();
        const palette = Palette.vga();
        const usedMask = buildUsageMask([1, 2, 3, 4, 5, 6, 7, 8]);
        const grid = computePaletteGrid(320, undefined, palette.size);

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, undefined, palette, usedMask);

        const fills = getRectFillCalls(renderer);
        const paletteBandFill = fills.find(
            (rect) =>
                rect.y === paletteBandY(240, grid.totalHeight) &&
                rect.height === grid.totalHeight &&
                rect.width === 320,
        );

        expect(paletteBandFill).toBeDefined();
        expect(
            fills.some((rect) => rect.y === hintBarY(240) && rect.height === OVERLAY_BAR_HEIGHT && rect.width === 320),
        ).toBe(true);
        expect(renderer.drawBarFill.mock.calls.length).toBeGreaterThan(4);
    });

    it('preserves default hint bar height when palette view is disabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
        const renderer = createMockRenderer();
        const palette = Palette.vga();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, undefined, palette);

        const fills = getRectFillCalls(renderer);
        expect(fills[3]).toMatchObject({ y: hintBarY(240), height: OVERLAY_BAR_HEIGHT, width: 320 });
        const swatchCalls = renderer.drawBarFill.mock.calls.filter(
            (call) => (call[0] as { width: number }).width === 1,
        );
        expect(swatchCalls).toHaveLength(0);
    });

    it('stacks custom rows above the palette grid bottom band', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { paletteView: true, visibleAtStart: true });
        const renderer = createMockRenderer();
        const palette = Palette.vga();
        const usedMask = buildUsageMask([1, 2, 3, 4, 5, 6, 7, 8]);
        const grid = computePaletteGrid(320, undefined, palette.size);
        const customRows = [{ leftText: 'Palette row' }];

        overlay.updateAndRender(renderer, mockFont, null, null, 0, () => customRows, undefined, palette, usedMask);

        const fills = getRectFillCalls(renderer);
        const row0BarY = customRowBarY(240, 0, grid.totalHeight + OVERLAY_ROW_GAP_PX + OVERLAY_BAR_HEIGHT);
        const customRowFill = fills.find((rect) => rect.height === OVERLAY_BAR_HEIGHT && rect.y === row0BarY);

        expect(customRowFill).toMatchObject({ y: row0BarY, width: 320, height: OVERLAY_BAR_HEIGHT });
    });

    it('draws timing chart dots when overlayTimingChart is enabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', {
            style: { barPaletteIndex: 8, textPaletteIndex: 9 },
            timingChart: true,
            timingChartStyle: { updateBarPaletteIndex: 10, renderBarPaletteIndex: 11 },
            timingChartHeight: 36,
            visibleAtStart: true,
        });
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, {
            frameMs: 8,
            updateMs: 200,
            renderMs: 100,
            updateSteps: 1,
            drawCalls: 4,
        });

        const dotCalls = renderer.drawBarFill.mock.calls.filter(
            (call) => (call[0] as { width: number }).width === 1 && (call[0] as { height: number }).height === 1,
        );
        const paletteIndices = dotCalls.map((call) => call[1] as number);

        expect(paletteIndices).toContain(10);
        expect(paletteIndices).toContain(11);
    });

    it('does not draw overlay while hidden but keeps timing chart samples for re-show', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', {
            timingChart: true,
            timingChartStyle: { updateBarPaletteIndex: 10, renderBarPaletteIndex: 11 },
            visibleAtStart: true,
            toggleHintVisible: false,
        });
        const renderer = createMockRenderer();

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 1);
        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, {
            frameMs: 8,
            updateMs: 12,
            renderMs: 8,
            updateSteps: 1,
            drawCalls: 4,
        });

        expect(renderer.drawBarFill).not.toHaveBeenCalled();

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 2);
        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, {
            frameMs: 8,
            updateMs: 12,
            renderMs: 8,
            updateSteps: 1,
            drawCalls: 4,
        });

        expect(renderer.drawBarFill.mock.calls.some((call) => call[1] === 10)).toBe(true);
    });

    it('does not draw timing chart dots when overlayTimingChart is disabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { visibleAtStart: true });
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, 0, undefined, {
            frameMs: 8,
            updateMs: 200,
            renderMs: 100,
            updateSteps: 1,
            drawCalls: 4,
        });

        expect(renderer.drawBarFill.mock.calls.some((call) => call[1] === 10)).toBe(false);
    });

    it('ignores toggle input when overlayToggleEnabled is false', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo', { toggleEnabled: false });

        expect(overlay.bodyVisible).toBe(false);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: () => true,
            } as never,
            1,
        );

        expect(overlay.bodyVisible).toBe(false);
    });

    it('resets camera for hint-only draws then restores the saved offset', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const overlay = createOverlay(layout, 'Demo');
        const renderer = createMockRenderer();
        const saved = new Vector2i(12, 34);

        renderer.getCameraOffset = vi.fn(() => saved);
        overlay.updateAndRender(renderer, mockFont, null, null, 0);

        expect(renderer.resetCamera).toHaveBeenCalledOnce();
        expect(renderer.setCameraOffset).toHaveBeenCalledWith(saved);
    });
});
