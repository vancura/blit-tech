import type { Rect2i } from '../../utils/Rect2i';
import type { Vector2i } from '../../utils/Vector2i';
import type { PaletteGridLayout } from '../types';

/** Cached screen-space layout for the overlay bars and toggle hit region. */
export interface OverlayLayout {
    /** Logical display width in pixels (fixed at init). */
    readonly displayWidth: number;

    /** Logical display height in pixels (fixed at init). */
    readonly displayHeight: number;

    /** System font line height in pixels. */
    readonly lineHeight: number;

    /** Y baseline for the bottom hint label. */
    readonly bottomTextY: number;

    /** Y baseline for top-bar text. */
    readonly topTextY: number;

    /** Bottom-left 48x48 px region that toggles overlay body visibility on primary press. */
    readonly toggleRect: Rect2i;
}

/** Feature flags and dimensions consumed by the layout planner. */
export interface OverlayLayoutConfig {
    readonly displayWidth: number;

    readonly displayHeight: number;

    readonly lineHeight: number;

    readonly customRowCount: number;

    readonly timingChartEnabled: boolean;

    readonly timingChartHeight: number;

    /** Mirrors {@link HardwareSettings.overlayPaletteView}. */
    readonly overlayPaletteView: boolean;

    readonly paletteGrid?: PaletteGridLayout;
}

/** Computed screen-space bands and text anchors for one frame. */
export interface OverlayLayoutPlan {
    readonly titleBar: Rect2i;

    readonly timingChart: Rect2i;

    readonly metricsBar: Rect2i;

    readonly timingTextBar: Rect2i;

    readonly customBars: readonly Rect2i[];

    /** Palette swatch grid band when {@link HardwareSettings.overlayPaletteView} is enabled; height 0 otherwise. */
    readonly paletteBand: Rect2i;

    /** Bottom `[~]` hint bar (13 px); always at the display bottom edge. */
    readonly hintBar: Rect2i;

    readonly toggleRect: Rect2i;

    readonly topLeftPos: Vector2i;

    readonly topRightPos: Vector2i;

    readonly topMetricsPos: Vector2i;

    readonly topTimingPos: Vector2i;

    /** Bottom-left `[~]` toggle hint label anchor. */
    readonly hintLabelPos: Vector2i;
}
