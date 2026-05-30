/**
 * Scrolling update/render timing chart band for the overlay (VV-539, VV-545 severity, VV-7 grid, VV-541 tags).
 */

import type { BitmapFont } from '../../assets/BitmapFont';
import { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import type { OverlayDrawTarget } from '../OverlayDrawTarget';
import type { OverlayTimingSnapshot } from '../types';
import { TIMING_CHART_FULL_SCALE_MS } from './constants';
import { classifyTimingChartSeverity, TIMING_CHART_SEVERITY_ERROR, TIMING_CHART_SEVERITY_WARNING } from './severity';
import {
    computeTimingChartBarHeight,
    computeTimingChartDotY,
    computeTimingChartGridLineY,
    shouldDrawTimingChartGridLineY,
    timingChartBaselineY,
    type TimingChartDrawStyle,
    writeTimingChartGridMarkers,
} from './style';
import {
    computeTimingChartTagLabelY,
    computeTimingChartTagMarkerX,
    computeTimingChartTagTextX,
    computeTimingChartTagTickY,
    formatTimingChartTagRelTick,
    groupTimingChartTagsByColumn,
    normalizeTimingChartTagLabel,
    pruneTimingChartTagsInPlace,
    TIMING_CHART_TAG_START,
    type TimingChartTag,
    type TimingChartTagColumnGroup,
} from './tags';

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

    /** Event tags anchored to absolute ticks (VV-541). */
    readonly #tags: TimingChartTag[] = [];

    /** Tick at last chart reset; used for relative tick labels. */
    #chartStartTick = 0;

    /** Timing samples recorded since the last chart width reset (one per overlay frame). */
    #totalSamples = 0;

    readonly #tagLabelPos = new Vector2i(0, 0);

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
     * Records an event tag on the scrolling timeline (RetroBlit AssignTag parity).
     *
     * No-op when the chart is disabled. Empty labels become `"Untitled"`.
     *
     * @param label - Tag text shown above the chart band.
     * @param currentTick - Current fixed-update tick (`BT.ticks`).
     */
    assignTag(label: string | undefined, currentTick: number): void {
        if (this.#bufferWidth <= 0) {
            return;
        }

        this.#tags.push({
            label: normalizeTimingChartTagLabel(label),
            tick: currentTick,
            sampleIndex: this.#totalSamples,
        });
    }

    /**
     * Clears ring-buffer state when the chart width changes.
     *
     * Resets tags and adds a {@link TIMING_CHART_TAG_START} marker (RetroBlit Reset parity).
     *
     * @param width - New chart width in pixels.
     * @param currentTick - Current fixed-update tick for tag epoch and start marker.
     */
    reset(width: number, currentTick = 0): void {
        if (width <= 0) {
            this.#bufferWidth = 0;
            this.#writeIndex = 0;
            this.#sampleCount = 0;
            this.#tags.length = 0;
            this.#totalSamples = 0;

            return;
        }

        if (width === this.#bufferWidth) {
            return;
        }

        this.#bufferWidth = width;
        this.#writeIndex = 0;
        this.#sampleCount = 0;
        this.#totalSamples = 0;
        this.#updateMsBuffer = new Float32Array(width);
        this.#renderMsBuffer = new Float32Array(width);
        this.#severityBuffer = new Uint8Array(width);
        this.#chartStartTick = currentTick;
        this.#tags.length = 0;

        this.assignTag(TIMING_CHART_TAG_START, currentTick);
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

        /* eslint-disable security/detect-object-injection -- index is ring-buffer write cursor bounded by bufferWidth */
        this.#updateMsBuffer[index] = Math.max(0, timing.updateMs);
        this.#renderMsBuffer[index] = Math.max(0, timing.renderMs);
        this.#severityBuffer[index] = classifyTimingChartSeverity(
            timing.frameMs,
            this.#targetFps,
            timing.droppedFrames,
        );
        /* eslint-enable security/detect-object-injection */

        this.#writeIndex = (this.#writeIndex + 1) % this.#bufferWidth;
        this.#sampleCount = Math.min(this.#sampleCount + 1, this.#bufferWidth);
        this.#totalSamples++;

        pruneTimingChartTagsInPlace(this.#tags, this.#totalSamples, this.#bufferWidth);
    }

    /**
     * Draws horizontal grid reference lines, timing dots, and event tags.
     *
     * Uses {@link OverlayDrawTarget.drawBarFill} with 1x1 rects so update and render samples stay
     * visible without alpha blending (palette-indexed engine).
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band from layout plan.
     * @param style - Resolved chart palette indices.
     * @param font - System bitmap font for tag labels.
     * @param currentTick - Current fixed-update tick for tag scroll and prune.
     */
    draw(
        target: OverlayDrawTarget,
        chartRect: Rect2i,
        style: TimingChartDrawStyle,
        font: BitmapFont,
        currentTick: number,
    ): void {
        if (!this.#enabled || chartRect.width <= 0 || chartRect.height <= 0) {
            return;
        }

        this.reset(chartRect.width, currentTick);

        this.#drawGridLines(target, chartRect, style);

        const tagGroups = groupTimingChartTagsByColumn(this.#tags, this.#totalSamples, this.#bufferWidth);

        this.#drawTagMarkers(target, chartRect, style, tagGroups);

        if (this.#sampleCount > 0) {
            this.#drawSamples(target, chartRect, style);
        }

        this.#drawTags(target, chartRect, style, font, tagGroups);
    }

    /**
     * Draws one-pixel timing samples for each populated ring-buffer column.
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band.
     * @param style - Resolved chart palette indices.
     */
    #drawSamples(target: OverlayDrawTarget, chartRect: Rect2i, style: TimingChartDrawStyle): void {
        const baselineY = timingChartBaselineY(chartRect);

        for (let column = 0; column < this.#sampleCount; column++) {
            const bufferIndex =
                this.#sampleCount < this.#bufferWidth ? column : (this.#writeIndex + column) % this.#bufferWidth;

            /* eslint-disable security/detect-object-injection -- bufferIndex derived from bounded ring cursor */
            const updateMs = this.#updateMsBuffer[bufferIndex] as number;
            const renderMs = this.#renderMsBuffer[bufferIndex] as number;
            const severity = this.#severityBuffer[bufferIndex] as number;
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
     * Draws a one-pixel vertical marker per tag, aligned with timing columns (VV-541).
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band.
     * @param style - Resolved chart palette indices.
     * @param tagGroups - Tags grouped by sample column.
     */
    #drawTagMarkers(
        target: OverlayDrawTarget,
        chartRect: Rect2i,
        style: TimingChartDrawStyle,
        tagGroups: readonly TimingChartTagColumnGroup[],
    ): void {
        for (const group of tagGroups) {
            const x = computeTimingChartTagMarkerX(chartRect.x, chartRect.width, group.sampleIndex, this.#totalSamples);

            if (x === null) {
                continue;
            }

            this.#lineScratch.set(x, chartRect.y, 1, chartRect.height);
            target.drawBarFill(this.#lineScratch, style.gridBarIndex);
        }
    }

    /**
     * Draws event tag labels above the chart band (VV-541).
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band.
     * @param style - Resolved chart palette indices.
     * @param font - System bitmap font.
     * @param tagGroups - Tags grouped by sample column.
     */
    #drawTags(
        target: OverlayDrawTarget,
        chartRect: Rect2i,
        style: TimingChartDrawStyle,
        font: BitmapFont,
        tagGroups: readonly TimingChartTagColumnGroup[],
    ): void {
        const paletteOffset = style.tagBarIndex - 1;

        for (const group of tagGroups) {
            const textX = computeTimingChartTagTextX(
                chartRect.x,
                chartRect.width,
                group.sampleIndex,
                this.#totalSamples,
            );

            if (textX === null) {
                continue;
            }

            const leadTag = group.tags[0];

            if (leadTag !== undefined) {
                this.#tagLabelPos.x = textX;
                this.#tagLabelPos.y = computeTimingChartTagTickY(chartRect.y);

                target.drawLabelOnTop(
                    font,
                    this.#tagLabelPos.clone(),
                    formatTimingChartTagRelTick(leadTag.tick, this.#chartStartTick),
                    paletteOffset,
                );
            }

            for (let stackIndex = 0; stackIndex < group.tags.length; stackIndex++) {
                /* eslint-disable security/detect-object-injection -- stackIndex bounded by group.tags.length */
                const tag = group.tags[stackIndex];

                if (tag === undefined) {
                    continue;
                }

                this.#tagLabelPos.x = textX;
                this.#tagLabelPos.y = computeTimingChartTagLabelY(chartRect.y, stackIndex);

                target.drawLabelOnTop(font, this.#tagLabelPos.clone(), tag.label, paletteOffset);
                /* eslint-enable security/detect-object-injection */
            }
        }
    }

    /**
     * Draws faint horizontal grid lines behind timing dots (VV-7).
     *
     * @param target - Overlay draw target.
     * @param chartRect - Screen-space chart band from layout plan.
     * @param style - Resolved chart palette indices.
     */
    #drawGridLines(target: OverlayDrawTarget, chartRect: Rect2i, style: TimingChartDrawStyle): void {
        const markerCount = writeTimingChartGridMarkers(this.#targetFps, this.#gridMarkerMs);
        let lastY = -1;

        for (let index = 0; index < markerCount; index++) {
            /* eslint-disable security/detect-object-injection -- index bounded by markerCount */
            const ms: number = this.#gridMarkerMs[index] as number;
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
    #severityPaletteIndex(severity: number, style: TimingChartDrawStyle): number | null {
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
