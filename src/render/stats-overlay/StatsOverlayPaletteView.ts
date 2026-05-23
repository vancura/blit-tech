/**
 * Live palette swatch grid for the stats overlay bottom band (VV-540).
 *
 * {@link computePaletteGrid} picks adaptive column counts from the active palette
 * size; {@link StatsOverlayPaletteView.draw} renders indexed swatches with gaps and
 * transparent corner pixels.
 */

import type { Palette } from '../../assets/Palette';
import { Rect2i } from '../../utils/Rect2i';
import type { IRenderer } from '../IRenderer';
import { STATS_BOTTOM_HINT_LABEL, STATS_EDGE_MARGIN_PX } from './constants';
import { statsRightAlignedTextX } from './layoutHelpers';
import type { PaletteGridLayout } from './types';

/** Default swatch size in pixels. */
export const DEFAULT_PALETTE_SWATCH_SIZE = 7;

/** Horizontal and vertical gap between swatches in pixels. */
export const PALETTE_SWATCH_GAP_PX = 1;

/** Padding below the swatch grid inside the bottom band. */
export const PALETTE_GRID_PADDING_PX = 3;

/** Empty grid placeholder when the palette view is disabled. */
export const DEFAULT_PALETTE_GRID: PaletteGridLayout = {
    cols: 0,
    rows: 0,
    swatchSize: 0,
    gap: 0,
    totalHeight: 0,
};

/**
 * Computes the horizontal span of one grid row.
 *
 * @param cols - Column count.
 * @param swatchSize - Side length of each swatch.
 * @param gap - Gap between swatches.
 * @returns Row width in pixels.
 */
export function paletteGridRowWidth(cols: number, swatchSize: number, gap: number): number {
    if (cols <= 0) {
        return 0;
    }

    return cols * swatchSize + (cols - 1) * gap;
}

/**
 * Computes the vertical span of the full grid.
 *
 * @param rows - Row count.
 * @param swatchSize - Side length of each swatch.
 * @param gap - Gap between swatches.
 * @returns Grid height in pixels.
 */
export function paletteGridRowStackHeight(rows: number, swatchSize: number, gap: number): number {
    if (rows <= 0) {
        return 0;
    }

    return rows * swatchSize + (rows - 1) * gap;
}

/**
 * Picks the widest column count that fits the display while halving from the palette size.
 *
 * @param displayWidth - Logical display width in pixels.
 * @param swatchSize - Side length of each swatch.
 * @param gap - Gap between swatches.
 * @param colorCount - Active palette slot count.
 * @param maxColumns - Optional cap from {@link HardwareSettings.statsOverlayPaletteColumns}.
 * @returns Column count (at least 1).
 */
export function pickPaletteGridColumnCount(
    displayWidth: number,
    swatchSize: number,
    gap: number,
    colorCount: number,
    maxColumns?: number,
): number {
    const availableWidth = displayWidth - STATS_EDGE_MARGIN_PX * 2;
    let candidate = Math.max(1, colorCount);

    if (maxColumns !== undefined && maxColumns > 0) {
        candidate = Math.min(candidate, maxColumns);
    }

    while (candidate > 1) {
        if (paletteGridRowWidth(candidate, swatchSize, gap) <= availableWidth) {
            return candidate;
        }

        candidate = Math.floor(candidate / 2);
    }

    return 1;
}

/**
 * Computes palette grid layout for the bottom band.
 *
 * @param displayWidth - Logical display width in pixels.
 * @param swatchSize - Side length of each swatch (default {@link DEFAULT_PALETTE_SWATCH_SIZE}).
 * @param colorCount - Number of palette slots to show (default 256).
 * @param gap - Gap between swatches (default 1).
 * @param maxColumns - Optional cap from {@link HardwareSettings.statsOverlayPaletteColumns}.
 * @returns Grid dimensions and total bottom band height.
 */
export function computePaletteGrid(
    displayWidth: number,
    swatchSize = DEFAULT_PALETTE_SWATCH_SIZE,
    colorCount = 256,
    gap = PALETTE_SWATCH_GAP_PX,
    maxColumns?: number,
): PaletteGridLayout {
    if (colorCount <= 0) {
        return { cols: 0, rows: 0, swatchSize, gap, totalHeight: 0 };
    }

    const cols = pickPaletteGridColumnCount(displayWidth, swatchSize, gap, colorCount, maxColumns);
    const rows = Math.ceil(colorCount / cols);
    const totalHeight = paletteGridRowStackHeight(rows, swatchSize, gap) + PALETTE_GRID_PADDING_PX * 2;

    return { cols, rows, swatchSize, gap, totalHeight };
}

/**
 * Returns whether a swatch rect intersects an exclusion region.
 *
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param exclusion - Region to avoid (for example the `[~]` hint).
 * @returns `true` when any part of the swatch overlaps the exclusion rect.
 */
function swatchIntersectsRect(x: number, y: number, swatchSize: number, exclusion: Rect2i): boolean {
    const swatchRect = new Rect2i(x, y, swatchSize, swatchSize);

    return swatchRect.intersects(exclusion);
}

/**
 * Builds a lookup table of palette indices used this frame.
 *
 * @param usedIndices - Sorted palette slots referenced by demo draw calls.
 * @param paletteSize - Active palette size upper bound.
 * @returns Usage mask indexed by palette slot.
 */
export function buildUsedPaletteLookup(usedIndices: readonly number[], paletteSize: number): Uint8Array {
    const lookup = new Uint8Array(paletteSize);

    for (const index of usedIndices) {
        if (index > 0 && index < paletteSize) {
            // eslint-disable-next-line security/detect-object-injection -- index bounds checked above
            lookup[index] = 1;
        }
    }

    return lookup;
}

/**
 * Draws an empty unused swatch outline with a small corner-to-corner X.
 *
 * @param renderer - Active renderer.
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param markIndex - Palette index for the outline and X mark.
 */
function drawUnusedSwatch(renderer: IRenderer, x: number, y: number, swatchSize: number, markIndex: number): void {
    const last = swatchSize - 1;
    const span = last;

    for (let step = 2; step <= span - 2; step++) {
        renderer.drawRectFillOnTop(new Rect2i(x + step, y + last - step, 1, 1), markIndex);
    }
}

/**
 * Live palette swatch renderer for the stats overlay bottom band.
 */
export class StatsOverlayPaletteView {
    readonly #enabled: boolean;

    /**
     * Creates a palette view with the given feature flag.
     *
     * @param enabled - When false, draw is a no-op.
     */
    constructor(enabled = true) {
        this.#enabled = enabled;
    }

    /**
     * Whether the palette grid is active.
     *
     * @returns Feature flag state.
     */
    get enabled(): boolean {
        return this.#enabled;
    }

    /**
     * Draws palette swatches in the bottom band.
     *
     * @param renderer - Active renderer.
     * @param bottomArea - Bottom band rect from layout plan.
     * @param palette - Active demo palette.
     * @param grid - Precomputed grid layout.
     * @param bottomTextY - Baseline Y for the bottom-right `[~]` hint.
     * @param displayWidth - Logical display width for hint exclusion.
     * @param lineHeight - System font line height for hint exclusion.
     * @param usedIndices - Palette slots referenced by demo draw calls this frame.
     * @param unusedMarkIndex - Palette index for unused swatch outlines and X marks.
     */
    draw(
        renderer: IRenderer,
        bottomArea: Rect2i,
        palette: Palette | null,
        grid: PaletteGridLayout,
        bottomTextY: number,
        displayWidth: number,
        lineHeight: number,
        usedIndices: readonly number[],
        unusedMarkIndex: number,
    ): void {
        if (!this.#enabled || palette === null || grid.cols <= 0) {
            return;
        }

        const { cols, swatchSize, gap } = grid;
        const originX = bottomArea.x + STATS_EDGE_MARGIN_PX;
        const originY = bottomArea.y + PALETTE_GRID_PADDING_PX;
        const hintLeft = statsRightAlignedTextX(STATS_BOTTOM_HINT_LABEL, displayWidth);
        const hintExclusion = new Rect2i(
            hintLeft,
            bottomTextY,
            Math.max(0, displayWidth - STATS_EDGE_MARGIN_PX - hintLeft),
            lineHeight,
        );
        const colorCount = palette.size;
        const usedLookup = buildUsedPaletteLookup(usedIndices, colorCount);

        for (let index = 0; index < colorCount; index++) {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = originX + col * (swatchSize + gap);
            const y = originY + row * (swatchSize + gap);

            // Reserve only the `[~]` text band; do not clip against the 48x48 toggle hit rect
            // (it overlaps many grid rows and would truncate every row below it).
            if (swatchIntersectsRect(x, y, swatchSize, hintExclusion)) {
                continue;
            }

            // eslint-disable-next-line security/detect-object-injection -- index bounded by palette.size
            if (usedLookup[index] === 1) {
                renderer.drawRectFillOnTop(new Rect2i(x, y, swatchSize, swatchSize), index);
            } else {
                drawUnusedSwatch(renderer, x, y, swatchSize, unusedMarkIndex);
            }
        }
    }
}
