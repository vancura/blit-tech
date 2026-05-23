/**
 * Unit tests for {@link computePaletteGrid} and palette swatch drawing.
 */

import { describe, expect, it, vi } from 'vitest';

import { Palette } from '../../assets/Palette';
import { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import { DEFAULT_IDX_TEXT, STATS_EDGE_MARGIN_PX } from './constants';
import { createStatsOverlayLayout } from './layoutHelpers';
import {
    buildUsedPaletteLookup,
    computePaletteGrid,
    computeUnusedSwatchMarkerRect,
    DEFAULT_PALETTE_SWATCH_SIZE,
    PALETTE_GRID_PADDING_PX,
    PALETTE_SWATCH_GAP_PX,
    paletteGridRowStackHeight,
    paletteGridRowWidth,
    pickPaletteGridColumnCount,
    StatsOverlayPaletteView,
} from './StatsOverlayPaletteView';

/** Returns the top-left pixel for one palette index in the bottom-band grid. */
function swatchTopLeft(
    index: number,
    cols: number,
    bottomAreaY: number,
    swatchSize: number,
    gap: number,
): { x: number; y: number } {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
        x: STATS_EDGE_MARGIN_PX + col * (swatchSize + gap),
        y: bottomAreaY + PALETTE_GRID_PADDING_PX + row * (swatchSize + gap),
    };
}

describe('computePaletteGrid', () => {
    it('uses 32 columns and 8 rows at 320 px width for a 256-color palette', () => {
        const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 256, PALETTE_SWATCH_GAP_PX);

        expect(grid.cols).toBe(32);
        expect(grid.rows).toBe(8);
        expect(grid.swatchSize).toBe(DEFAULT_PALETTE_SWATCH_SIZE);
        expect(grid.gap).toBe(PALETTE_SWATCH_GAP_PX);
        expect(grid.totalHeight).toBe(
            paletteGridRowStackHeight(grid.rows, grid.swatchSize, grid.gap) + PALETTE_GRID_PADDING_PX * 2,
        );
        expect(paletteGridRowWidth(grid.cols, grid.swatchSize, grid.gap)).toBeLessThanOrEqual(320 - 6);
    });

    it('keeps small palettes on one row when width allows', () => {
        expect(computePaletteGrid(320, 4, 2).cols).toBe(2);
        expect(computePaletteGrid(320, 4, 4).cols).toBe(4);
        expect(computePaletteGrid(320, 4, 16).cols).toBe(16);
    });

    it('halves column count when a single row no longer fits', () => {
        const narrowWidth = paletteGridRowWidth(16, 4, 1) + STATS_EDGE_MARGIN_PX * 2 - 1;
        const grid = computePaletteGrid(narrowWidth, 4, 16, 1);

        expect(grid.cols).toBe(8);
        expect(grid.rows).toBe(2);
    });

    it('falls back to one column when only one swatch fits horizontally', () => {
        const grid = computePaletteGrid(10, 4, 256, 1);

        expect(grid.cols).toBe(1);
        expect(grid.rows).toBe(256);
        expect(grid.totalHeight).toBe(
            paletteGridRowStackHeight(grid.rows, grid.swatchSize, grid.gap) + PALETTE_GRID_PADDING_PX * 2,
        );
    });

    it('returns an empty grid when color count is zero', () => {
        expect(computePaletteGrid(320, 4, 0, 1)).toEqual({
            cols: 0,
            rows: 0,
            swatchSize: 4,
            gap: 1,
            totalHeight: 0,
        });
    });

    it('matches pickPaletteGridColumnCount helper cases', () => {
        expect(pickPaletteGridColumnCount(320, 4, 1, 256)).toBe(32);
        expect(pickPaletteGridColumnCount(320, 4, 1, 32)).toBe(32);
        expect(pickPaletteGridColumnCount(120, 4, 1, 32)).toBe(16);
    });

    it('caps column count when statsOverlayPaletteColumns is set', () => {
        expect(computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 16, PALETTE_SWATCH_GAP_PX, 8).cols).toBe(8);
        expect(computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 16, PALETTE_SWATCH_GAP_PX, 8).rows).toBe(2);
        expect(pickPaletteGridColumnCount(320, DEFAULT_PALETTE_SWATCH_SIZE, PALETTE_SWATCH_GAP_PX, 256, 8)).toBe(8);
    });
});

describe('StatsOverlayPaletteView.draw', () => {
    it('draws filled swatches for used indices and empty X marks for unused slots', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const palette = Palette.cga();
        const usedIndices = [1, 2];
        const swatchSize = DEFAULT_PALETTE_SWATCH_SIZE;
        const grid = computePaletteGrid(320, swatchSize, palette.size, 1);
        const bottomAreaY = 240 - grid.totalHeight;
        const view = new StatsOverlayPaletteView(true);
        const drawRectFillOnTop = vi.fn();
        const renderer = {
            drawRectFillOnTop,
        } as never;

        view.draw(
            renderer,
            new Rect2i(0, bottomAreaY, 320, grid.totalHeight),
            palette,
            grid,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
            usedIndices,
            DEFAULT_IDX_TEXT,
        );

        expect(drawRectFillOnTop).toHaveBeenCalled();

        const calls = drawRectFillOnTop.mock.calls.map((call) => ({
            rect: call[0] as Rect2i,
            index: call[1] as number,
        }));

        const usedPos = swatchTopLeft(1, grid.cols, bottomAreaY, swatchSize, grid.gap);
        const usedSwatch = calls.find(
            (call) =>
                call.rect.x === usedPos.x &&
                call.rect.y === usedPos.y &&
                call.rect.width === swatchSize &&
                call.rect.height === swatchSize &&
                call.index === 1,
        );
        expect(usedSwatch).toBeDefined();

        const unusedPos = swatchTopLeft(3, grid.cols, bottomAreaY, swatchSize, grid.gap);
        const expectedMarker = computeUnusedSwatchMarkerRect(unusedPos.x, unusedPos.y, swatchSize);
        const unusedSwatchMarker = calls.find(
            (call) =>
                call.rect.x === expectedMarker.x &&
                call.rect.y === expectedMarker.y &&
                call.rect.width === expectedMarker.width &&
                call.rect.height === expectedMarker.height &&
                call.index === DEFAULT_IDX_TEXT,
        );
        expect(unusedSwatchMarker).toBeDefined();

        const unusedSwatchFill = calls.find(
            (call) =>
                call.rect.x === unusedPos.x &&
                call.rect.y === unusedPos.y &&
                call.rect.width === swatchSize &&
                call.index === 3,
        );
        expect(unusedSwatchFill).toBeUndefined();
    });

    it('buildUsedPaletteLookup ignores slot 0 and out-of-range indices', () => {
        expect(buildUsedPaletteLookup([0, 1, 99], 16)).toEqual(
            new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        );
    });

    it('draws swatches with gaps and skips the bottom-right hint region', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const palette = Palette.cga();
        const usedIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const swatchSize = DEFAULT_PALETTE_SWATCH_SIZE;
        const grid = computePaletteGrid(320, swatchSize, palette.size, 1);
        const bottomAreaY = 240 - grid.totalHeight;
        const view = new StatsOverlayPaletteView(true);
        const drawRectFillOnTop = vi.fn();
        const renderer = {
            drawRectFillOnTop,
        } as never;

        view.draw(
            renderer,
            new Rect2i(0, bottomAreaY, 320, grid.totalHeight),
            palette,
            grid,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
            usedIndices,
            DEFAULT_IDX_TEXT,
        );

        expect(drawRectFillOnTop).toHaveBeenCalled();

        const calls = drawRectFillOnTop.mock.calls.map((call) => ({
            rect: call[0] as Rect2i,
            index: call[1] as number,
        }));

        const swatch0 = swatchTopLeft(0, grid.cols, bottomAreaY, swatchSize, grid.gap);
        const swatch1 = swatchTopLeft(1, grid.cols, bottomAreaY, swatchSize, grid.gap);
        const gapX = swatch0.x + swatchSize;

        expect(calls.some((call) => call.rect.x === swatch0.x && call.rect.y === swatch0.y && call.index === 0)).toBe(
            false,
        );

        const gapPixel = calls.find((call) => call.rect.x === gapX && call.rect.y === swatch0.y);
        expect(gapPixel).toBeUndefined();

        const nextSwatchPixel = calls.find(
            (call) =>
                call.rect.x === swatch1.x &&
                call.rect.y === swatch1.y &&
                call.rect.width === swatchSize &&
                call.index === 1,
        );
        expect(nextSwatchPixel).toBeDefined();
    });

    it('draws full column width on rows inside the toggle hit region', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const palette = new Palette(256);
        const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, palette.size, 1, 36);
        const bottomAreaY = 240 - grid.totalHeight;
        const swatchOriginY = bottomAreaY + 3;
        const view = new StatsOverlayPaletteView(true);
        const drawRectFillOnTop = vi.fn();
        const renderer = { drawRectFillOnTop } as never;
        const row = 5;
        const col = 35;
        const index = row * grid.cols + col;
        const expectedX = 3 + col * (grid.swatchSize + grid.gap);
        const expectedY = swatchOriginY + row * (grid.swatchSize + grid.gap);

        view.draw(
            renderer,
            new Rect2i(0, bottomAreaY, 320, grid.totalHeight),
            palette,
            grid,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
            [index],
            DEFAULT_IDX_TEXT,
        );

        const lastColSwatch = drawRectFillOnTop.mock.calls.find(
            (call) => (call[0] as Rect2i).x === expectedX && (call[0] as Rect2i).y === expectedY,
        );
        expect(lastColSwatch).toBeDefined();
        expect(layout.toggleRect.contains(new Vector2i(expectedX, expectedY))).toBe(true);
    });

    it('is a no-op when disabled', () => {
        const view = new StatsOverlayPaletteView(false);
        const drawRectFillOnTop = vi.fn();
        const renderer = { drawRectFillOnTop } as never;

        view.draw(
            renderer,
            new Rect2i(0, 201, 320, 39),
            Palette.cga(),
            computePaletteGrid(320),
            227,
            320,
            14,
            [1, 2, 3],
            DEFAULT_IDX_TEXT,
        );

        expect(drawRectFillOnTop).not.toHaveBeenCalled();
    });
});
