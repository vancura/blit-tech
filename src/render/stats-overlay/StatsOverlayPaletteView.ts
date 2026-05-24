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
import { statsToggleHintTextWidth, statsToggleHintTextX } from './layoutHelpers';
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
 * Returns whether two axis-aligned rects overlap (zero allocation).
 *
 * @param ax - Left edge of rect A.
 * @param ay - Top edge of rect A.
 * @param aw - Width of rect A.
 * @param ah - Height of rect A.
 * @param bx - Left edge of rect B.
 * @param by - Top edge of rect B.
 * @param bw - Width of rect B.
 * @param bh - Height of rect B.
 * @returns `true` when the rects overlap.
 */
function rectsIntersect(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
): boolean {
    return !(bx >= ax + aw || bx + bw <= ax || by >= ay + ah || by + bh <= ay);
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
    return rectsIntersect(x, y, swatchSize, swatchSize, exclusion.x, exclusion.y, exclusion.width, exclusion.height);
}

/** Cached hint exclusion rect; recomputed only when layout inputs change (VV-543). */
const hintExclusionCache = {
    bottomTextY: Number.NaN,
    displayWidth: Number.NaN,
    lineHeight: Number.NaN,
    rect: new Rect2i(),
};

/**
 * Returns the screen-space rect reserved for the bottom-left `[~]` hint label.
 *
 * Reuses {@link hintExclusionCache.rect} when `bottomTextY`, `displayWidth`, and
 * `lineHeight` match the previous call.
 *
 * @param bottomTextY - Baseline Y for the hint text.
 * @param displayWidth - Logical display width.
 * @param lineHeight - System font line height.
 * @returns Exclusion rect for swatch placement.
 */
function resolveHintExclusionRect(bottomTextY: number, displayWidth: number, lineHeight: number): Rect2i {
    if (
        hintExclusionCache.bottomTextY === bottomTextY &&
        hintExclusionCache.displayWidth === displayWidth &&
        hintExclusionCache.lineHeight === lineHeight
    ) {
        return hintExclusionCache.rect;
    }

    const hintLeft = statsToggleHintTextX();

    hintExclusionCache.bottomTextY = bottomTextY;
    hintExclusionCache.displayWidth = displayWidth;
    hintExclusionCache.lineHeight = lineHeight;

    hintExclusionCache.rect.set(hintLeft, bottomTextY, statsToggleHintTextWidth(STATS_BOTTOM_HINT_LABEL), lineHeight);

    return hintExclusionCache.rect;
}

/** Preferred side length for the filled marker drawn inside unused swatches. */
const UNUSED_SWATCH_MARKER_SIZE = 3;

/** Reused draw scratch rects for the palette grid hot loop (one overlay draw at a time). */
const paletteGridDrawScratch = {
    swatch: new Rect2i(),
    marker: new Rect2i(),
};

/**
 * Writes the filled marker rect for an unused swatch into {@link target}.
 *
 * @param target - Reusable rect mutated in place.
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 */
function writeUnusedSwatchMarkerRect(target: Rect2i, x: number, y: number, swatchSize: number): void {
    if (swatchSize <= 0) {
        target.set(x, y, 0, 0);
        return;
    }

    const markerSize = Math.max(1, Math.min(UNUSED_SWATCH_MARKER_SIZE, swatchSize - 4));
    const offset = Math.floor((swatchSize - markerSize) / 2);

    target.set(x + offset, y + offset, markerSize, markerSize);
}

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
    const result = new Rect2i();

    writeUnusedSwatchMarkerRect(result, x, y, swatchSize);

    return result;
}

/**
 * Draws a centered filled marker inside an unused swatch.
 *
 * @param renderer - Active renderer.
 * @param markerScratch - Reusable marker rect mutated in place.
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param markIndex - Palette index for the marker fill.
 */
function drawUnusedSwatch(
    renderer: IRenderer,
    markerScratch: Rect2i,
    x: number,
    y: number,
    swatchSize: number,
    markIndex: number,
): void {
    if (swatchSize <= 0) {
        return;
    }

    writeUnusedSwatchMarkerRect(markerScratch, x, y, swatchSize);

    if (markerScratch.width <= 0 || markerScratch.height <= 0) {
        return;
    }

    renderer.drawRectFillOnTop(markerScratch, markIndex);
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
 * @param swatchScratch - Reusable swatch rect mutated in place.
 * @param markerScratch - Reusable marker rect mutated in place.
 * @param x - Swatch left edge in display pixels.
 * @param y - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param index - Palette slot index for this swatch.
 * @param usedMask - Per-frame usage mask from BTAPI.
 * @param unusedMarkIndex - Palette index for unused swatch marker fills.
 */
function drawPaletteSwatch(
    renderer: IRenderer,
    swatchScratch: Rect2i,
    markerScratch: Rect2i,
    x: number,
    y: number,
    swatchSize: number,
    index: number,
    usedMask: Uint8Array,
    unusedMarkIndex: number,
): void {
    if (isPaletteSlotUsed(usedMask, index)) {
        swatchScratch.set(x, y, swatchSize, swatchSize);
        renderer.drawRectFillOnTop(swatchScratch, index);
    } else {
        drawUnusedSwatch(renderer, markerScratch, x, y, swatchSize, unusedMarkIndex);
    }
}

/**
 * Draws the full palette swatch grid inside the bottom band.
 *
 * @param renderer - Active renderer.
 * @param paletteBand - Palette band rect from layout plan.
 * @param colorCount - Active palette slot count.
 * @param grid - Precomputed grid layout.
 * @param hintExclusion - Region to skip for the `[~]` hint label.
 * @param usedMask - Per-frame usage mask from BTAPI.
 * @param unusedMarkIndex - Palette index for unused swatch marker fills.
 */
function drawPaletteSwatchGrid(
    renderer: IRenderer,
    paletteBand: Rect2i,
    colorCount: number,
    grid: PaletteGridLayout,
    hintExclusion: Rect2i,
    usedMask: Uint8Array,
    unusedMarkIndex: number,
): void {
    const { cols, swatchSize, gap } = grid;
    const originX = paletteBand.x + STATS_EDGE_MARGIN_PX;
    const originY = paletteBand.y + PALETTE_GRID_PADDING_PX;
    const swatchScratch = paletteGridDrawScratch.swatch;
    const markerScratch = paletteGridDrawScratch.marker;

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

        drawPaletteSwatch(renderer, swatchScratch, markerScratch, x, y, swatchSize, index, usedMask, unusedMarkIndex);
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
     * @param paletteBand - Palette band rect from layout plan.
     * @param palette - Active demo palette.
     * @param grid - Precomputed grid layout.
     * @param bottomTextY - Baseline Y for the bottom-left `[~]` hint.
     * @param displayWidth - Logical display width for hint exclusion.
     * @param lineHeight - System font line height for hint exclusion.
     * @param usedMask - Per-frame usage mask populated during demo render.
     * @param unusedMarkIndex - Palette index for unused swatch marker fills.
     */
    draw(
        renderer: IRenderer,
        paletteBand: Rect2i,
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

        const hintExclusion = resolveHintExclusionRect(bottomTextY, displayWidth, lineHeight);

        drawPaletteSwatchGrid(renderer, paletteBand, palette.size, grid, hintExclusion, usedMask, unusedMarkIndex);
    }
}
