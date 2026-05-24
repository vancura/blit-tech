/**
 * Scrolling update/render timing chart band for the stats overlay (VV-539).
 */

import { Rect2i } from '../../utils/Rect2i';
import type { IRenderer } from '../IRenderer';
import { TIMING_CHART_FULL_SCALE_MS } from './constants';
import { computeTimingChartBarHeight, type ResolvedStatsOverlayTimingChartStyle } from './timingChartStyle';
import type { StatsOverlayTimingSnapshot } from './types';

/** Palette indices for chart drawing. */
export type StatsOverlayTimingChartDrawStyle = ResolvedStatsOverlayTimingChartStyle;

/**
 * Scrolling update/render timing chart with a fixed-capacity ring buffer.
 */
export class StatsOverlayTimingChart {
    readonly #enabled: boolean;

    #bufferWidth = 0;

    #writeIndex = 0;

    #sampleCount = 0;

    #updateMsBuffer = new Float32Array(0);

    #renderMsBuffer = new Float32Array(0);

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
     * Clears ring-buffer state when the chart width changes.
     *
     * @param width - New chart width in pixels.
     */
    reset(width: number): void {
        if (width <= 0) {
            this.#bufferWidth = 0;
            this.#writeIndex = 0;
            this.#sampleCount = 0;
            return;
        }

        if (width === this.#bufferWidth) {
            return;
        }

        this.#bufferWidth = width;
        this.#writeIndex = 0;
        this.#sampleCount = 0;
        this.#updateMsBuffer = new Float32Array(width);
        this.#renderMsBuffer = new Float32Array(width);
    }

    /**
     * Records one frame timing sample into the ring buffer.
     *
     * @param timing - Per-frame snapshot from BTAPI.
     */
    sample(timing: StatsOverlayTimingSnapshot): void {
        if (!this.#enabled || this.#bufferWidth <= 0) {
            return;
        }

        const index = this.#writeIndex;

        /* eslint-disable security/detect-object-injection -- index is ring-buffer write cursor bounded by bufferWidth */
        this.#updateMsBuffer[index] = Math.max(0, timing.updateMs);
        this.#renderMsBuffer[index] = Math.max(0, timing.renderMs);
        /* eslint-enable security/detect-object-injection */

        this.#writeIndex = (this.#writeIndex + 1) % this.#bufferWidth;
        this.#sampleCount = Math.min(this.#sampleCount + 1, this.#bufferWidth);
    }

    /**
     * Draws one-pixel timing dots for each populated ring-buffer column.
     *
     * Uses {@link IRenderer.drawRectFillOnTop} with 1x1 rects so update and render samples stay
     * visible without alpha blending (palette-indexed engine).
     *
     * @param renderer - Active renderer.
     * @param chartRect - Screen-space chart band from layout plan.
     * @param style - Resolved chart palette indices.
     */
    draw(renderer: IRenderer, chartRect: Rect2i, style: StatsOverlayTimingChartDrawStyle): void {
        if (!this.#enabled || chartRect.width <= 0 || chartRect.height <= 0) {
            return;
        }

        this.reset(chartRect.width);

        if (this.#sampleCount <= 0) {
            return;
        }

        const baselineY = chartRect.y + chartRect.height - 1;

        for (let column = 0; column < this.#sampleCount; column++) {
            const bufferIndex =
                this.#sampleCount < this.#bufferWidth ? column : (this.#writeIndex + column) % this.#bufferWidth;

            /* eslint-disable security/detect-object-injection -- bufferIndex derived from bounded ring cursor */
            const updateMs = this.#updateMsBuffer[bufferIndex] ?? 0;
            const renderMs = this.#renderMsBuffer[bufferIndex] ?? 0;

            /* eslint-enable security/detect-object-injection */
            const x = chartRect.x + column;

            this.#drawDot(renderer, x, baselineY, renderMs, chartRect, style.renderBarIndex);
            this.#drawDot(renderer, x, baselineY, updateMs, chartRect, style.updateBarIndex);
        }
    }

    /**
     * Draws one timing sample as a single pixel above the chart baseline.
     *
     * @param renderer - Active renderer.
     * @param x - Column X in screen space.
     * @param baselineY - Bottom row of the chart band.
     * @param ms - Timing sample in milliseconds.
     * @param chartRect - Chart band bounds for clamping.
     * @param paletteIndex - Palette index for the dot.
     */
    #drawDot(
        renderer: IRenderer,
        x: number,
        baselineY: number,
        ms: number,
        chartRect: Rect2i,
        paletteIndex: number,
    ): void {
        const offset = computeTimingChartBarHeight(ms, chartRect.height, TIMING_CHART_FULL_SCALE_MS);

        if (offset <= 0) {
            return;
        }

        const y = Math.max(chartRect.y, baselineY - offset + 1);

        renderer.drawRectFillOnTop(new Rect2i(x, y, 1, 1), paletteIndex);
    }
}
