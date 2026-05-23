/** Height of each stats bar strip in pixels. */
export const STATS_BAR_HEIGHT = 13;

/** Horizontal inset from screen edges for stats text. */
export const STATS_EDGE_MARGIN_PX = 3;

/** Gap between the bottom text baseline and the display bottom edge. */
export const STATS_BOTTOM_TEXT_GAP_PX = -1;

/** Vertical offset for top-row text inside the top bar. */
export const STATS_TOP_TEXT_Y = 0;

/** Gap between stacked stats bars (custom rows and bottom bar). */
export const STATS_ROW_GAP_PX = 1;

/** Side length of the bottom-right corner region that toggles overlay visibility. */
export const STATS_TOGGLE_CORNER_SIZE = 48;

/** `KeyboardEvent.code` for the tilde / backquote toggle key. */
export const STATS_TOGGLE_KEY_CODE = 'Backquote';

/** Pointer primary button code (mouse left / touch). */
export const POINTER_PRIMARY_BUTTON = 20;

/** Exponential smoothing factor for measured FPS (0..1). */
export const FPS_SMOOTHING = 0.12;

/** `performance.now()` milliseconds per second. */
export const MS_PER_SECOND = 1000;

/** Default palette indices when HUD named slots are unavailable. */
export const DEFAULT_IDX_BG = 1;

/** Default palette index for overlay system-font text. */
export const DEFAULT_IDX_TEXT = 2;

/** System font glyph advance in pixels. */
export const SYSTEM_CHAR_ADVANCE = 6;

/** Default timing chart band height in pixels (RetroBlit uses bottom - 22). */
export const DEFAULT_TIMING_CHART_HEIGHT = 22;

/** Bottom-right hint label when palette grid is disabled. */
export const STATS_BOTTOM_HINT_LABEL = '[~]';
