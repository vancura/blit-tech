/**
 * Inline row-major mask for the overlay toggle hint icon (VV-548).
 *
 * `1` draws a foreground pixel; `0` is transparent..
 */

/** Toggle hint icon width in pixels. */
export const OVERLAY_TOGGLE_ICON_WIDTH = 11;

/** Toggle hint icon height in pixels. */
export const OVERLAY_TOGGLE_ICON_HEIGHT = 7;

/**
 * Row-major tilde toggle hint mask (`width` × `height`).
 */
export const OVERLAY_TOGGLE_ICON_MASK: readonly number[] = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, //
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, //
    0,
    0,
    0,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0, //
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0, //
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    0,
    0,
    0, //
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, //
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, //
];
