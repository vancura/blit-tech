import type { Rect2i } from '../../utils/Rect2i';
import type { Vector2i } from '../../utils/Vector2i';

/** Cached screen-space layout for the overlay bars and toggle hit region. */
export interface StatsOverlayLayout {
    /** Logical display width in pixels (fixed at init). */
    readonly displayWidth: number;

    /** Logical display height in pixels (fixed at init). */
    readonly displayHeight: number;

    /** System font line height in pixels. */
    readonly lineHeight: number;

    /** Y baseline for bottom-bar text. */
    readonly bottomTextY: number;

    /** Y baseline for top-bar text. */
    readonly topTextY: number;

    /** Bottom-right 48x48 px region that toggles overlay visibility on primary press. */
    readonly toggleRect: Rect2i;
}

/**
 * Per-frame timing snapshot fed into {@link StatsOverlay.updateAndRender}.
 *
 * Values are wall-clock CPU timings from `performance.now()` measured by
 * {@link BTAPI} and smoothed inside the overlay before display.
 */
export interface StatsOverlayTimingSnapshot {
    /** Total frame CPU time in milliseconds (update + render callback work). */
    readonly frameMs: number;

    /** Sum of all fixed `update()` calls that ran for this frame, in milliseconds. */
    readonly updateMs: number;

    /** Demo `render()` wall time for this frame, in milliseconds. */
    readonly renderMs: number;

    /** Number of fixed update steps processed for this frame (0..8). */
    readonly updateSteps: number;

    /** Number of draw API calls issued by the demo for this frame. */
    readonly drawCalls: number;
}

/** Computed palette swatch grid dimensions for the bottom band. */
export interface PaletteGridLayout {
    /** Number of columns in the grid. */
    readonly cols: number;

    /** Number of rows in the grid. */
    readonly rows: number;

    /** Side length of each swatch in pixels. */
    readonly swatchSize: number;

    /** Gap between swatches horizontally and vertically. */
    readonly gap: number;

    /** Total bottom band height including padding. */
    readonly totalHeight: number;
}

/** Feature flags and dimensions consumed by the layout planner. */
export interface StatsOverlayLayoutConfig {
    readonly displayWidth: number;
    readonly displayHeight: number;
    readonly lineHeight: number;
    readonly customRowCount: number;
    readonly timingChartEnabled: boolean;
    readonly timingChartHeight: number;
    /** Mirrors {@link HardwareSettings.statsOverlayPaletteView}. */
    readonly statsOverlayPaletteView: boolean;
    readonly paletteGrid?: PaletteGridLayout;
}

/** Computed screen-space bands and text anchors for one frame. */
export interface StatsOverlayLayoutPlan {
    readonly titleBar: Rect2i;
    readonly timingChart: Rect2i;
    readonly metricsBar: Rect2i;
    readonly timingTextBar: Rect2i;
    readonly customBars: readonly Rect2i[];
    readonly bottomArea: Rect2i;
    readonly toggleRect: Rect2i;
    readonly topLeftPos: Vector2i;
    readonly topRightPos: Vector2i;
    readonly topMetricsPos: Vector2i;
    readonly topTimingPos: Vector2i;
    readonly bottomRightPos: Vector2i;
}
