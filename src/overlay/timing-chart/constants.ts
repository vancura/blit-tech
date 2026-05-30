/** Default timing chart band height in pixels (RetroBlit uses bottom - 22). */
export const DEFAULT_TIMING_CHART_HEIGHT = 22;

/** Milliseconds mapped to full chart band height (~one 60 FPS frame budget). */
export const TIMING_CHART_FULL_SCALE_MS = 16;

/** Default warning palette index for timing chart semantic overlays. */
export const TIMING_CHART_DEFAULT_WARNING_IDX = 3;

/** Default error palette index for timing chart semantic overlays. */
export const TIMING_CHART_DEFAULT_ERROR_IDX = 4;

/** Default palette index for timing chart tag and tick text. */
export const TIMING_CHART_DEFAULT_TAG_IDX = 5;

/**
 * Fixed interior grid markers in milliseconds (VV-7). Excludes 1 ms (band bottom edge).
 * Frame budget is added at draw time from targetFPS.
 */
export const TIMING_CHART_GRID_MARKER_MS: readonly number[] = [5, 10, 33.33];
