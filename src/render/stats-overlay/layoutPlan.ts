/**
 * Dynamic Y-band planner for the stats overlay.
 *
 * Computes bar rects and text anchors each frame from display size, custom row count,
 * and optional timing-chart / palette-grid feature flags (timing chart default off per
 * VV-539 timing chart opt-in via {@link HardwareSettings.statsOverlayTimingChart}).
 */

import { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import {
    DEFAULT_TIMING_CHART_HEIGHT,
    STATS_BAR_HEIGHT,
    STATS_EDGE_MARGIN_PX,
    STATS_ROW_GAP_PX,
    STATS_TOP_TEXT_Y,
} from './constants';
import { statsRightAlignedTextX, statsToggleHintTextX } from './layoutHelpers';
import type { StatsOverlayLayoutConfig, StatsOverlayLayoutPlan } from './types';

/** Mutable scratch object reused by {@link buildStatsOverlayLayoutPlan}. */
export interface StatsOverlayLayoutPlanScratch {
    titleBar: Rect2i;
    timingChart: Rect2i;
    metricsBar: Rect2i;
    timingTextBar: Rect2i;
    customBars: Rect2i[];
    paletteBand: Rect2i;
    hintBar: Rect2i;
    toggleRect: Rect2i;
    topLeftPos: Vector2i;
    topRightPos: Vector2i;
    topMetricsPos: Vector2i;
    topTimingPos: Vector2i;
    hintLabelPos: Vector2i;
}

/**
 * Top Y of the bottom hint bar (13 px strip at the display bottom edge).
 *
 * @param displayHeight - Logical display height in pixels.
 * @returns Hint bar top Y.
 */
export function hintBarY(displayHeight: number): number {
    return displayHeight - STATS_BAR_HEIGHT;
}

/**
 * Top Y of the palette swatch grid band stacked above the hint bar row gap.
 *
 * @param displayHeight - Logical display height in pixels.
 * @param paletteGridHeight - Total palette grid height from {@link computePaletteGrid}.
 * @returns Palette band top Y.
 */
export function paletteBandY(displayHeight: number, paletteGridHeight: number): number {
    return hintBarY(displayHeight) - STATS_ROW_GAP_PX - paletteGridHeight;
}

/**
 * Creates a reusable scratch object for layout planning.
 *
 * @returns Empty scratch plan with pre-allocated rects and positions.
 */
export function createStatsOverlayLayoutPlanScratch(): StatsOverlayLayoutPlanScratch {
    return {
        titleBar: new Rect2i(0, 0, 0, STATS_BAR_HEIGHT),
        timingChart: new Rect2i(0, 0, 0, 0),
        metricsBar: new Rect2i(0, 0, 0, STATS_BAR_HEIGHT),
        timingTextBar: new Rect2i(0, 0, 0, STATS_BAR_HEIGHT),
        customBars: [],
        paletteBand: new Rect2i(0, 0, 0, 0),
        hintBar: new Rect2i(0, 0, 0, STATS_BAR_HEIGHT),
        toggleRect: new Rect2i(0, 0, 0, 0),
        topLeftPos: new Vector2i(STATS_EDGE_MARGIN_PX, 0),
        topRightPos: new Vector2i(0, 0),
        topMetricsPos: new Vector2i(STATS_EDGE_MARGIN_PX, 0),
        topTimingPos: new Vector2i(STATS_EDGE_MARGIN_PX, 0),
        hintLabelPos: new Vector2i(0, 0),
    };
}

/**
 * Resolves footer rects: optional palette band above a row gap, then the hint bar at the display bottom.
 *
 * @param config - Layout configuration.
 * @param displayHeight - Logical display height in pixels.
 * @returns Palette band height, footer stack anchor Y, and hint bar top Y.
 */
function resolveFooterLayout(
    config: StatsOverlayLayoutConfig,
    displayHeight: number,
): { paletteBandHeight: number; footerStackTopY: number; hintBarTopY: number } {
    const hintBarTopY = hintBarY(displayHeight);
    const paletteEnabled = config.statsOverlayPaletteView && config.paletteGrid !== undefined;

    if (paletteEnabled) {
        const paletteBandHeight = config.paletteGrid.totalHeight;

        return {
            paletteBandHeight,
            footerStackTopY: paletteBandY(displayHeight, paletteBandHeight),
            hintBarTopY,
        };
    }

    return {
        paletteBandHeight: 0,
        footerStackTopY: hintBarTopY,
        hintBarTopY,
    };
}

/**
 * Total reserved footer height (palette grid + row gap + hint bar, or hint bar alone).
 *
 * @param config - Layout configuration.
 * @returns Footer band height in pixels.
 */
export function resolveStatsOverlayFooterHeight(config: StatsOverlayLayoutConfig): number {
    if (config.statsOverlayPaletteView && config.paletteGrid !== undefined) {
        return config.paletteGrid.totalHeight + STATS_ROW_GAP_PX + STATS_BAR_HEIGHT;
    }

    return STATS_BAR_HEIGHT;
}

/**
 * Ensures the custom bar scratch pool has at least `count` entries.
 *
 * @param scratch - Layout scratch object.
 * @param count - Number of custom rows.
 * @param displayWidth - Logical display width.
 */
function ensureCustomBarPool(scratch: StatsOverlayLayoutPlanScratch, count: number, displayWidth: number): void {
    while (scratch.customBars.length < count) {
        scratch.customBars.push(new Rect2i(0, 0, displayWidth, STATS_BAR_HEIGHT));
    }
}

/**
 * Builds or updates a layout plan from configuration (top-down stack).
 *
 * @param config - Feature flags and display dimensions.
 * @param scratch - Reusable scratch object mutated in place.
 * @param topRightLabel - Text for top-right backend/resolution label.
 * @param hintLabelBaselineY - Baseline Y for the hint label from init layout.
 * @param toggleRect - Bottom-left toggle hit region from init layout.
 * @returns The same scratch object as {@link StatsOverlayLayoutPlan}.
 */
export function buildStatsOverlayLayoutPlan(
    config: StatsOverlayLayoutConfig,
    scratch: StatsOverlayLayoutPlanScratch,
    topRightLabel: string,
    hintLabelBaselineY: number,
    toggleRect: Rect2i,
): StatsOverlayLayoutPlan {
    const { displayWidth, displayHeight } = config;
    const { paletteBandHeight, footerStackTopY, hintBarTopY } = resolveFooterLayout(config, displayHeight);

    scratch.hintBar.x = 0;
    scratch.hintBar.y = hintBarTopY;
    scratch.hintBar.width = displayWidth;
    scratch.hintBar.height = STATS_BAR_HEIGHT;

    scratch.paletteBand.x = 0;
    scratch.paletteBand.y = footerStackTopY;
    scratch.paletteBand.width = displayWidth;
    scratch.paletteBand.height = paletteBandHeight;

    ensureCustomBarPool(scratch, config.customRowCount, displayWidth);

    /* eslint-disable security/detect-object-injection -- rowIndex bounded by customRowCount */
    for (let rowIndex = 0; rowIndex < config.customRowCount; rowIndex++) {
        const bar = scratch.customBars[rowIndex];

        if (bar === undefined) {
            continue;
        }

        const barY = footerStackTopY - (rowIndex + 1) * (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);

        bar.x = 0;
        bar.y = barY;
        bar.width = displayWidth;
        bar.height = STATS_BAR_HEIGHT;
    }
    /* eslint-enable security/detect-object-injection */

    let y = 0;

    scratch.titleBar.x = 0;
    scratch.titleBar.y = y;
    scratch.titleBar.width = displayWidth;
    scratch.titleBar.height = STATS_BAR_HEIGHT;
    y += STATS_BAR_HEIGHT + STATS_ROW_GAP_PX;

    if (config.timingChartEnabled) {
        const chartHeight = config.timingChartHeight > 0 ? config.timingChartHeight : DEFAULT_TIMING_CHART_HEIGHT;

        scratch.timingChart.x = 0;
        scratch.timingChart.y = y;
        scratch.timingChart.width = displayWidth;
        scratch.timingChart.height = chartHeight;
        y += chartHeight + STATS_ROW_GAP_PX;
    } else {
        scratch.timingChart.x = 0;
        scratch.timingChart.y = y;
        scratch.timingChart.width = displayWidth;
        scratch.timingChart.height = 0;
    }

    scratch.metricsBar.x = 0;
    scratch.metricsBar.y = y;
    scratch.metricsBar.width = displayWidth;
    scratch.metricsBar.height = STATS_BAR_HEIGHT;
    y += STATS_BAR_HEIGHT + STATS_ROW_GAP_PX;

    scratch.timingTextBar.x = 0;
    scratch.timingTextBar.y = y;
    scratch.timingTextBar.width = displayWidth;
    scratch.timingTextBar.height = STATS_BAR_HEIGHT;

    scratch.toggleRect.x = toggleRect.x;
    scratch.toggleRect.y = toggleRect.y;
    scratch.toggleRect.width = toggleRect.width;
    scratch.toggleRect.height = toggleRect.height;

    scratch.topLeftPos.x = STATS_EDGE_MARGIN_PX;
    scratch.topLeftPos.y = STATS_TOP_TEXT_Y;

    scratch.topRightPos.x = statsRightAlignedTextX(topRightLabel, displayWidth);
    scratch.topRightPos.y = STATS_TOP_TEXT_Y;

    scratch.topMetricsPos.x = STATS_EDGE_MARGIN_PX;
    scratch.topMetricsPos.y = scratch.metricsBar.y + STATS_TOP_TEXT_Y;

    scratch.topTimingPos.x = STATS_EDGE_MARGIN_PX;
    scratch.topTimingPos.y = scratch.timingTextBar.y + STATS_TOP_TEXT_Y;

    scratch.hintLabelPos.x = statsToggleHintTextX();
    scratch.hintLabelPos.y = hintLabelBaselineY;

    return scratch;
}

/**
 * Default layout config with chart and palette features disabled.
 *
 * @param displayWidth - Logical display width.
 * @param displayHeight - Logical display height.
 * @param lineHeight - System font line height.
 * @param customRowCount - Demo custom row count for this frame.
 * @returns Config suitable for {@link buildStatsOverlayLayoutPlan}.
 */
export function createDefaultLayoutConfig(
    displayWidth: number,
    displayHeight: number,
    lineHeight: number,
    customRowCount: number,
): StatsOverlayLayoutConfig {
    return {
        displayWidth,
        displayHeight,
        lineHeight,
        customRowCount,
        timingChartEnabled: false,
        timingChartHeight: DEFAULT_TIMING_CHART_HEIGHT,
        statsOverlayPaletteView: false,
    };
}
