/**
 * Dynamic Y-band planner for the stats overlay.
 *
 * Computes bar rects and text anchors each frame from display size, custom row count,
 * and optional timing-chart / palette-grid feature flags (palette view on by default;
 * timing chart default off for parity with the legacy fixed layout).
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
import { statsRightAlignedTextX } from './layoutHelpers';
import type { StatsOverlayLayoutConfig, StatsOverlayLayoutPlan } from './types';

/** Mutable scratch object reused by {@link buildStatsOverlayLayoutPlan}. */
export interface StatsOverlayLayoutPlanScratch {
    titleBar: Rect2i;
    timingChart: Rect2i;
    metricsBar: Rect2i;
    timingTextBar: Rect2i;
    customBars: Rect2i[];
    bottomArea: Rect2i;
    toggleRect: Rect2i;
    topLeftPos: Vector2i;
    topRightPos: Vector2i;
    topMetricsPos: Vector2i;
    topTimingPos: Vector2i;
    bottomRightPos: Vector2i;
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
        bottomArea: new Rect2i(0, 0, 0, STATS_BAR_HEIGHT),
        toggleRect: new Rect2i(0, 0, 0, 0),
        topLeftPos: new Vector2i(STATS_EDGE_MARGIN_PX, 0),
        topRightPos: new Vector2i(0, 0),
        topMetricsPos: new Vector2i(STATS_EDGE_MARGIN_PX, 0),
        topTimingPos: new Vector2i(STATS_EDGE_MARGIN_PX, 0),
        bottomRightPos: new Vector2i(0, 0),
    };
}

/**
 * Computes bottom band height from palette grid config or legacy 13 px bar.
 *
 * @param config - Layout configuration.
 * @returns Bottom area height in pixels.
 */
function resolveBottomAreaHeight(config: StatsOverlayLayoutConfig): number {
    if (config.paletteViewEnabled && config.paletteGrid !== undefined) {
        return config.paletteGrid.totalHeight;
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
 * @param bottomRightLabel - Text for bottom-right hint (for X alignment).
 * @param topRightLabel - Text for top-right backend/resolution label.
 * @param bottomTextY - Baseline Y for bottom-right text from init layout.
 * @param toggleRect - Bottom-right toggle hit region from init layout.
 * @returns The same scratch object as {@link StatsOverlayLayoutPlan}.
 */
export function buildStatsOverlayLayoutPlan(
    config: StatsOverlayLayoutConfig,
    scratch: StatsOverlayLayoutPlanScratch,
    bottomRightLabel: string,
    topRightLabel: string,
    bottomTextY: number,
    toggleRect: Rect2i,
): StatsOverlayLayoutPlan {
    const { displayWidth, displayHeight } = config;
    const bottomHeight = resolveBottomAreaHeight(config);

    scratch.bottomArea.x = 0;
    scratch.bottomArea.y = displayHeight - bottomHeight;
    scratch.bottomArea.width = displayWidth;
    scratch.bottomArea.height = bottomHeight;

    ensureCustomBarPool(scratch, config.customRowCount, displayWidth);

    /* eslint-disable security/detect-object-injection -- rowIndex bounded by customRowCount */
    for (let rowIndex = 0; rowIndex < config.customRowCount; rowIndex++) {
        const bar = scratch.customBars[rowIndex];

        if (bar === undefined) {
            continue;
        }

        const barY = scratch.bottomArea.y - (rowIndex + 1) * (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);

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

    scratch.bottomRightPos.x = statsRightAlignedTextX(bottomRightLabel, displayWidth);
    scratch.bottomRightPos.y = bottomTextY;

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
        paletteViewEnabled: false,
    };
}
