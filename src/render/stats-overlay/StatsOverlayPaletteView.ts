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
 * Builds the screen-space rect reserved for the bottom-right `[~]` hint label.
 *
 * @param bottomTextY - Baseline Y for the hint text.
 * @param displayWidth - Logical display width.
 * @param lineHeight - System font line height.
 * @returns Exclusion rect for swatch placement.
 */
function buildHintExclusionRect(bottomTextY: number, displayWidth: number, lineHeight: number): Rect2i {
    const hintLeft = statsRightAlignedTextX(STATS_BOTTOM_HINT_LABEL, displayWidth);

    return new Rect2i(hintLeft, bottomTextY, Math.max(0, displayWidth - STATS_EDGE_MARGIN_PX - hintLeft), lineHeight);
}

/** Preferred side length for the filled marker drawn inside unused swatches. */
const UNUSED_SWATCH_MARKER_SIZE = 3;

/**
 * Computes the filled marker rect drawn inside an unused swatch.
 *
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @returns Marker rect clamped and centered within the swatch bounds, or a
 * zero-area rect at `(x, y)` when `swatchSize` is not positive.
 */
export function computeUnusedSwatchMarkerRect(x: number, y: number, swatchSize: number): Rect2i {
    if (swatchSize <= 0) {
        return new Rect2i(x, y, 0, 0);
    }

    const markerSize = Math.max(1, Math.min(UNUSED_SWATCH_MARKER_SIZE, swatchSize - 4));
    const offset = Math.floor((swatchSize - markerSize) / 2);

    return new Rect2i(x + offset, y + offset, markerSize, markerSize);
}

/**
 * Draws a centered filled marker inside an unused swatch.
 *
 * @param renderer - Active renderer.
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param markIndex - Palette index for the marker fill.
 */
function drawUnusedSwatch(renderer: IRenderer, x: number, y: number, swatchSize: number, markIndex: number): void {
    if (swatchSize <= 0) {
        return;
    }

    const marker = computeUnusedSwatchMarkerRect(x, y, swatchSize);

    if (marker.width <= 0 || marker.height <= 0) {
        return;
    }

    renderer.drawRectFillOnTop(marker, markIndex);
}

/**
 * Returns whether a palette slot was referenced by demo draw calls this frame.
 *
 * @param usedMask - Per-frame usage mask from BTAPI.
 * @param index - Palette slot to query.
 * @returns `true` when the slot is marked used.
 */
function isPaletteSlotUsed(usedMask: Uint8Array, index: number): boolean {
    // eslint-disable-next-line security/detect-object-injection -- index bounds checked below
    return index > 0 && index < usedMask.length && usedMask[index] === 1;
}

/**
 * Draws one palette swatch or its unused marker.
 *
 * @param renderer - Active renderer.
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param index - Palette slot index for this swatch.
 * @param usedMask - Per-frame usage mask from BTAPI.
 * @param unusedMarkIndex - Palette index for unused swatch marker fills.
 */
function drawPaletteSwatch(
    renderer: IRenderer,
    x: number,
    y: number,
    swatchSize: number,
    index: number,
    usedMask: Uint8Array,
    unusedMarkIndex: number,
): void {
    if (isPaletteSlotUsed(usedMask, index)) {
        renderer.drawRectFillOnTop(new Rect2i(x, y, swatchSize, swatchSize), index);
    } else {
        drawUnusedSwatch(renderer, x, y, swatchSize, unusedMarkIndex);
    }
}

/**
 * Draws the full palette swatch grid inside the bottom band.
 *
 * @param renderer - Active renderer.
 * @param bottomArea - Bottom band rect from layout plan.
 * @param colorCount - Active palette slot count.
 * @param grid - Precomputed grid layout.
 * @param hintExclusion - Region to skip for the `[~]` hint label.
 * @param usedMask - Per-frame usage mask from BTAPI.
 * @param unusedMarkIndex - Palette index for unused swatch marker fills.
 */
function drawPaletteSwatchGrid(
    renderer: IRenderer,
    bottomArea: Rect2i,
    colorCount: number,
    grid: PaletteGridLayout,
    hintExclusion: Rect2i,
    usedMask: Uint8Array,
    unusedMarkIndex: number,
): void {
    const { cols, swatchSize, gap } = grid;
    const originX = bottomArea.x + STATS_EDGE_MARGIN_PX;
    const originY = bottomArea.y + PALETTE_GRID_PADDING_PX;

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

        drawPaletteSwatch(renderer, x, y, swatchSize, index, usedMask, unusedMarkIndex);
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
     * @param enabled - When false, draw is a no-op (default matches public opt-in API).
     */
    constructor(enabled = false) {
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
     * @param usedMask - Per-frame usage mask populated during demo render.
     * @param unusedMarkIndex - Palette index for unused swatch marker fills.
     */
    draw(
        renderer: IRenderer,
        bottomArea: Rect2i,
        palette: Palette | null,
        grid: PaletteGridLayout,
        bottomTextY: number,
        displayWidth: number,
        lineHeight: number,
        usedMask: Uint8Array,
        unusedMarkIndex: number,
    ): void {
        if (!this.#enabled || palette === null || grid.cols <= 0) {
            return;
        }

        const hintExclusion = buildHintExclusionRect(bottomTextY, displayWidth, lineHeight);

        drawPaletteSwatchGrid(renderer, bottomArea, palette.size, grid, hintExclusion, usedMask, unusedMarkIndex);
    }
}
