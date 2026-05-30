/**
 * Per-frame timing snapshot fed into {@link Overlay.updateAndRender}.
 *
 * Values are wall-clock CPU timings from `performance.now()` measured by
 * {@link BTAPI} and smoothed inside the overlay before display.
 */
export interface OverlayTimingSnapshot {
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

    /**
     * Estimated dropped refresh intervals detected at the start of this present frame.
     * Zero when none; set from {@link GameLoop} before the overlay samples the chart.
     */
    readonly droppedFrames: number;
}

/** Computed palette swatch grid dimensions for the palette band. */
export interface PaletteGridLayout {
    /** Number of columns in the grid. */
    readonly cols: number;

    /** Number of rows in the full palette grid. */
    readonly rows: number;

    /** Number of rows visible in the viewport (<= {@link rows}). */
    readonly visibleRows: number;

    /** Side length of each swatch in pixels. */
    readonly swatchSize: number;

    /** Gap between swatches horizontally and vertically. */
    readonly gap: number;

    /** Total palette band height including padding (based on {@link visibleRows}). */
    readonly totalHeight: number;
}
