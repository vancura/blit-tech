/**
 * Timing chart band for the stats overlay (VV-539 scaffold).
 *
 * Ring buffer and vertical bar drawing land in a follow-up; this stub wires
 * sample/draw hooks into the layout planner with no visible output when disabled.
 */

import type { Rect2i } from '../../utils/Rect2i';
import type { IRenderer } from '../IRenderer';
import type { StatsOverlayTimingSnapshot } from './types';

/** Palette indices for chart drawing (stub defaults). */
export interface StatsOverlayTimingChartStyle {
    readonly updateBarIndex: number;
    readonly renderBarIndex: number;
}

/**
 * Scrolling update/render timing chart (stub until VV-539).
 */
export class StatsOverlayTimingChart {
    readonly #enabled: boolean;

    /**
     * Creates a timing chart with the given feature flag.
     *
     * @param enabled - When false, sample/draw are no-ops.
     */
    constructor(enabled = false) {
        this.#enabled = enabled;
    }

    /**
     * Whether the chart band is active.
     *
     * @returns Feature flag state.
     */
    get enabled(): boolean {
        return this.#enabled;
    }

    /**
     * Records one frame timing sample (no-op when disabled).
     *
     * @param _timing - Per-frame snapshot from BTAPI.
     */
    sample(_timing: StatsOverlayTimingSnapshot): void {
        if (!this.#enabled) {
            return;
        }
    }

    /**
     * Draws the timing chart band (no-op when disabled).
     *
     * @param _renderer - Active renderer.
     * @param _chartRect - Screen-space chart band from layout plan.
     * @param _style - Chart palette indices.
     */
    draw(_renderer: IRenderer, _chartRect: Rect2i, _style: StatsOverlayTimingChartStyle): void {
        if (!this.#enabled) {
            return;
        }
    }
}
