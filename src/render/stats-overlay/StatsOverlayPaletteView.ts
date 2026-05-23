/**
 * Live palette swatch grid for the stats overlay bottom band (VV-540 scaffold).
 *
 * {@link computePaletteGrid} is implemented for layout planning; draw is a no-op
 * until the palette view feature lands.
 */

import type { Palette } from '../../assets/Palette';
import type { Rect2i } from '../../utils/Rect2i';
import type { IRenderer } from '../IRenderer';
import { STATS_EDGE_MARGIN_PX } from './constants';
import type { PaletteGridLayout } from './types';

/** Default swatch size in pixels. */
export const DEFAULT_PALETTE_SWATCH_SIZE = 4;

/** Total palette slots shown in the grid. */
export const PALETTE_SWATCH_COUNT = 256;

/** Padding below the swatch grid inside the bottom band. */
export const PALETTE_GRID_PADDING_PX = 0;

/** Divisors of 256 preferred for column count (widest first). */
const PREFERRED_COLUMN_DIVISORS = [32, 16, 8, 4, 2, 1] as const;

/**
 * Picks the widest column count that fits the display width.
 *
 * @param displayWidth - Logical display width in pixels.
 * @param swatchSize - Side length of each swatch.
 * @returns Column count (at least 1).
 */
function pickColumnCount(displayWidth: number, swatchSize: number): number {
    const availableWidth = displayWidth - STATS_EDGE_MARGIN_PX * 2;
    const maxCols = Math.max(1, Math.floor(availableWidth / swatchSize));

    for (const divisor of PREFERRED_COLUMN_DIVISORS) {
        if (fitsColumnDivisor(divisor, maxCols)) {
            return divisor;
        }
    }

    return 1;
}

/**
 * Returns whether a column divisor fits the display and divides 256 evenly.
 *
 * @param divisor - Candidate column count.
 * @param maxCols - Maximum columns that fit horizontally.
 * @returns Whether divisor fits and divides 256 evenly.
 */
function fitsColumnDivisor(divisor: number, maxCols: number): boolean {
    return divisor <= maxCols && PALETTE_SWATCH_COUNT % divisor === 0;
}

/**
 * Computes palette grid layout for the bottom band.
 *
 * @param displayWidth - Logical display width in pixels.
 * @param swatchSize - Side length of each swatch (default 4).
 * @param colorCount - Number of palette slots to show (default 256).
 * @returns Grid dimensions and total bottom band height.
 */
export function computePaletteGrid(
    displayWidth: number,
    swatchSize = DEFAULT_PALETTE_SWATCH_SIZE,
    colorCount = PALETTE_SWATCH_COUNT,
): PaletteGridLayout {
    const cols = pickColumnCount(displayWidth, swatchSize);
    const rows = Math.ceil(colorCount / cols);
    const totalHeight = rows * swatchSize + PALETTE_GRID_PADDING_PX;

    return { cols, rows, swatchSize, totalHeight };
}

/**
 * Live palette swatch renderer (stub until VV-540).
 */
export class StatsOverlayPaletteView {
    readonly #enabled: boolean;

    /**
     * Creates a palette view with the given feature flag.
     *
     * @param enabled - When false, draw is a no-op.
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
     * Draws palette swatches in the bottom band (no-op when disabled).
     *
     * @param _renderer - Active renderer.
     * @param _bottomArea - Bottom band rect from layout plan.
     * @param _palette - Active demo palette.
     * @param _grid - Precomputed grid layout.
     */
    draw(_renderer: IRenderer, _bottomArea: Rect2i, _palette: Palette | null, _grid: PaletteGridLayout): void {
        if (!this.#enabled) {
            return;
        }
    }
}
