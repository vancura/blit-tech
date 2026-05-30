/**
 * Scrolling update/render timing chart band for the overlay (VV-539, VV-545 severity, VV-7 grid).
 */

import { Rect2i } from '../../utils/Rect2i';
import type { OverlayDrawTarget } from '../OverlayDrawTarget';
import type { OverlayTimingSnapshot } from '../types';
import { TIMING_CHART_FULL_SCALE_MS } from './constants';
import {
    classifyTimingChartSeverity,
    TIMING_CHART_SEVERITY_ERROR,
    TIMING_CHART_SEVERITY_NONE,
    TIMING_CHART_SEVERITY_WARNING,
} from './severity';
import {
    computeTimingChartBarHeight,
    computeTimingChartDotY,
    computeTimingChartGridLineY,
    type ResolvedOverlayTimingChartStyle,
    shouldDrawTimingChartGridLineY,
    timingChartBaselineY,
    writeTimingChartGridMarkers,
} from './style';

/** Palette indices for chart drawing. */
export type OverlayTimingChartDrawStyle = ResolvedOverlayTimingChartStyle;

/**
 * Scrolling update/render timing chart with a fixed-capacity ring buffer.
 */
export class TimingChart {
    readonly #enabled: boolean;

    readonly #targetFps: number;

    #bufferWidth = 0;

    #writeIndex = 0;

    #sampleCount = 0;

    #updateMsBuffer = new Float32Array(0);

    #renderMsBuffer = new Float32Array(0);

    #severityBuffer = new Uint8Array(0);

    readonly #dotScratch = new Rect2i(0, 0, 1, 1);

    readonly #lineScratch = new Rect2i(0, 0, 1, 1);

    /** Reusable marker list: fixed thresholds plus one frame-budget slot. */
    readonly #gridMarkerMs = new Float32Array(8);

    /**
     * Creates a timing chart with the given feature flag.
     *
     * @param enabled - When false, sample/draw are no-ops.
     * @param targetFps - Configured fixed-step rate for frame-budget classification.
     */
    constructor(enabled = false, targetFps = 60) {
        this.#enabled = enabled;
        this.#targetFps = targetFps;
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
        this.#severityBuffer = new Uint8Array(width);
    }

    /**
     * Records one frame timing sample into the ring buffer.
     *
     * @param timing - Per-frame snapshot from BTAPI.
     */
    sample(timing: OverlayTimingSnapshot): void {
        if (!this.#enabled || this.#bufferWidth <= 0) {
            return;
        }

        const index = this.#writeIndex;
        const droppedFrames = timing.droppedFrames ?? 0;

        /* eslint-disable security/detect-object-injection -- index is ring-buffer write cursor bounded by bufferWidth */
        this.#updateMsBuffer[index] = Math.max(0, timing.updateMs);
        this.#renderMsBuffer[index] = Math.max(0, timing.renderMs);
        this.#severityBuffer[index] = classifyTimingChartSeverity(timing.frameMs, this.#targetFps, droppedFrames);
        /* eslint-enable security/detect-object-injection */

        this.#writeIndex = (this.#writeIndex + 1) % this.#bufferWidth;
        this.#sampleCount = Math.min(this.#sampleCount + 1, this.#bufferWidth);
    }

    /**
     * Draws horizontal grid reference lines, then one-pixel timing dots for each populated ring-buffer column.
     *
     * Uses {@link OverlayDrawTarget.drawBarFill} with 1x1 rects so update and render samples stay
     * visible without alpha blending (palette-indexed engine).
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band from layout plan.
     * @param style - Resolved chart palette indices.
     */
    draw(target: OverlayDrawTarget, chartRect: Rect2i, style: OverlayTimingChartDrawStyle): void {
        if (!this.#enabled || chartRect.width <= 0 || chartRect.height <= 0) {
            return;
        }

        this.reset(chartRect.width);

        this.#drawGridLines(target, chartRect, style);

        if (this.#sampleCount <= 0) {
            return;
        }

        const baselineY = timingChartBaselineY(chartRect);

        for (let column = 0; column < this.#sampleCount; column++) {
            const bufferIndex =
                this.#sampleCount < this.#bufferWidth ? column : (this.#writeIndex + column) % this.#bufferWidth;

            /* eslint-disable security/detect-object-injection -- bufferIndex derived from bounded ring cursor */
            const updateMs = this.#updateMsBuffer[bufferIndex] ?? 0;
            const renderMs = this.#renderMsBuffer[bufferIndex] ?? 0;
            const severity = this.#severityBuffer[bufferIndex] ?? TIMING_CHART_SEVERITY_NONE;
            /* eslint-enable security/detect-object-injection */

            const x = chartRect.x + column;
            const tintIndex = this.#severityPaletteIndex(severity, style);

            if (tintIndex !== null) {
                const renderOffset = computeTimingChartBarHeight(
                    renderMs,
                    chartRect.height,
                    TIMING_CHART_FULL_SCALE_MS,
                );
                const updateOffset = computeTimingChartBarHeight(
                    updateMs,
                    chartRect.height,
                    TIMING_CHART_FULL_SCALE_MS,
                );

                this.#drawDot(target, x, renderMs, chartRect, tintIndex);
                this.#drawDot(target, x, updateMs, chartRect, tintIndex);

                if (renderOffset <= 0 && updateOffset <= 0) {
                    this.#drawBaselineMarker(target, x, baselineY, tintIndex);
                }

                continue;
            }

            this.#drawDot(target, x, renderMs, chartRect, style.renderBarIndex);
            this.#drawDot(target, x, updateMs, chartRect, style.updateBarIndex);
        }
    }

    /**
     * Draws faint horizontal grid lines behind timing dots (VV-7).
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band from layout plan.
     * @param style - Resolved chart palette indices.
     */
    #drawGridLines(target: OverlayDrawTarget, chartRect: Rect2i, style: OverlayTimingChartDrawStyle): void {
        const markerCount = writeTimingChartGridMarkers(this.#targetFps, this.#gridMarkerMs);
        let lastY = -1;

        for (let index = 0; index < markerCount; index++) {
            /* eslint-disable security/detect-object-injection -- index bounded by markerCount */
            const ms = this.#gridMarkerMs[index] ?? 0;
            /* eslint-enable security/detect-object-injection */

            const y = computeTimingChartGridLineY(ms, chartRect, TIMING_CHART_FULL_SCALE_MS);

            if (y === null || !shouldDrawTimingChartGridLineY(y, chartRect) || y === lastY) {
                continue;
            }

            lastY = y;
            this.#lineScratch.set(chartRect.x, y, chartRect.width, 1);
            target.drawBarFill(this.#lineScratch, style.gridBarIndex);
        }
    }

    /**
     * Resolves semantic tint palette index for a severity level.
     *
     * @param severity - {@link TIMING_CHART_SEVERITY_NONE} | WARNING | ERROR.
     * @param style - Resolved chart palette indices.
     * @returns Palette index, or `null` to use per-bar update/render colors.
     */
    #severityPaletteIndex(severity: number, style: OverlayTimingChartDrawStyle): number | null {
        if (severity === TIMING_CHART_SEVERITY_ERROR) {
            return style.errorBarIndex;
        }

        if (severity === TIMING_CHART_SEVERITY_WARNING) {
            return style.warningBarIndex;
        }

        return null;
    }

    /**
     * Draws a one-pixel severity marker on the chart baseline.
     *
     * @param target - Overlay draw target.
     * @param x - Column X in screen space.
     * @param baselineY - Bottom row of the chart band.
     * @param paletteIndex - Palette index for the marker.
     */
    #drawBaselineMarker(target: OverlayDrawTarget, x: number, baselineY: number, paletteIndex: number): void {
        this.#dotScratch.set(x, baselineY, 1, 1);
        target.drawBarFill(this.#dotScratch, paletteIndex);
    }

    /**
     * Draws one timing sample as a single pixel anchored from the chart bottom row.
     *
     * @param target - Overlay draw target.
     * @param x - Column X in screen space.
     * @param ms - Timing sample in milliseconds.
     * @param chartRect - Chart band bounds for clamping.
     * @param paletteIndex - Palette index for the dot.
     */
    #drawDot(target: OverlayDrawTarget, x: number, ms: number, chartRect: Rect2i, paletteIndex: number): void {
        const y = computeTimingChartDotY(ms, chartRect, TIMING_CHART_FULL_SCALE_MS);

        if (y === null) {
            return;
        }

        this.#dotScratch.set(x, y, 1, 1);
        target.drawBarFill(this.#dotScratch, paletteIndex);
    }
}
