import type { OverlayStyle, OverlayTimingChartStyle } from '../../core/IBlitTechDemo';
import { DEFAULT_IDX_BG, DEFAULT_IDX_TEXT } from '../constants';
import {
    TIMING_CHART_DEFAULT_ERROR_IDX,
    TIMING_CHART_DEFAULT_EVENT_IDX,
    TIMING_CHART_DEFAULT_WARNING_IDX,
} from './constants';

/** Resolved palette indices used when drawing the timing chart band. */
export interface ResolvedOverlayTimingChartStyle {
    readonly updateBarIndex: number;
    readonly renderBarIndex: number;
    readonly warningBarIndex: number;
    readonly errorBarIndex: number;
    readonly eventBarIndex: number;
}

/**
 * Resolves timing chart palette indices from overlay and chart-specific settings.
 *
 * @param overlayStyle - Global overlay bar/text indices from hardware settings.
 * @param chartStyle - Optional timing-chart palette overrides.
 * @returns Resolved indices for chart draw and future semantic overlays.
 */
export function resolveOverlayTimingChartStyle(
    overlayStyle: OverlayStyle | undefined,
    chartStyle: OverlayTimingChartStyle | undefined,
): ResolvedOverlayTimingChartStyle {
    const barIndex = overlayStyle?.barPaletteIndex ?? DEFAULT_IDX_BG;
    const textIndex = overlayStyle?.textPaletteIndex ?? DEFAULT_IDX_TEXT;

    return {
        updateBarIndex: chartStyle?.updateBarPaletteIndex ?? barIndex,
        renderBarIndex: chartStyle?.renderBarPaletteIndex ?? textIndex,
        warningBarIndex: chartStyle?.warningPaletteIndex ?? TIMING_CHART_DEFAULT_WARNING_IDX,
        errorBarIndex: chartStyle?.errorPaletteIndex ?? TIMING_CHART_DEFAULT_ERROR_IDX,
        eventBarIndex: chartStyle?.eventPaletteIndex ?? TIMING_CHART_DEFAULT_EVENT_IDX,
    };
}

/**
 * Maps a timing sample in milliseconds to a vertical dot offset in pixels above the baseline.
 *
 * Scales linearly so {@link fullScaleMs} fills the chart band. Any non-zero sample draws at
 * least one pixel so lightweight demos (sub-millisecond `update()` / `render()`) stay visible.
 *
 * @param ms - Sample value in milliseconds.
 * @param chartHeight - Chart band height in pixels.
 * @param fullScaleMs - Milliseconds that map to full band height.
 * @returns Clamped offset in pixels (0 when sample is zero).
 */
export function computeTimingChartBarHeight(ms: number, chartHeight: number, fullScaleMs: number): number {
    if (chartHeight <= 0 || ms <= 0 || fullScaleMs <= 0) {
        return 0;
    }

    const scaled = Math.floor((ms * chartHeight) / fullScaleMs);

    return Math.min(chartHeight, Math.max(1, scaled));
}
