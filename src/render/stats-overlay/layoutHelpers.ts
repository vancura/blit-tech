import { Rect2i } from '../../utils/Rect2i';
import type { Vector2i } from '../../utils/Vector2i';
import {
    STATS_BAR_HEIGHT,
    STATS_BOTTOM_TEXT_GAP_PX,
    STATS_EDGE_MARGIN_PX,
    STATS_ROW_GAP_PX,
    STATS_TOGGLE_CORNER_SIZE,
    STATS_TOP_TEXT_Y,
    SYSTEM_CHAR_ADVANCE,
} from './constants';
import type { StatsOverlayLayout } from './types';

/**
 * Builds cached layout from logical display size and system font line height.
 *
 * @param displayWidth - Logical display width in pixels.
 * @param displayHeight - Logical display height in pixels.
 * @param lineHeight - System font line height in pixels.
 * @returns Frozen layout used for the lifetime of the overlay instance.
 */
export function createStatsOverlayLayout(
    displayWidth: number,
    displayHeight: number,
    lineHeight: number,
): StatsOverlayLayout {
    const bottomTextY = displayHeight - lineHeight - STATS_BOTTOM_TEXT_GAP_PX;
    const toggleRect = new Rect2i(
        0,
        displayHeight - STATS_TOGGLE_CORNER_SIZE,
        STATS_TOGGLE_CORNER_SIZE,
        STATS_TOGGLE_CORNER_SIZE,
    );

    return {
        displayWidth,
        displayHeight,
        lineHeight,
        bottomTextY,
        topTextY: STATS_TOP_TEXT_Y,
        toggleRect,
    };
}

/**
 * Returns whether a pointer position lies inside the toggle corner rect.
 *
 * @param pos - Pointer position in display coordinates.
 * @param toggleRect - Bottom-left toggle region.
 * @returns `true` when the point is inside the rect (`Rect2i.contains` half-open bounds).
 */
export function isPointerInStatsToggleCorner(pos: Vector2i, toggleRect: Rect2i): boolean {
    return toggleRect.contains(pos);
}

/**
 * X position for right-aligned stats text inside a bar.
 *
 * @param text - Text to place flush right with {@link STATS_EDGE_MARGIN_PX} inset.
 * @param displayWidth - Logical display width in pixels.
 * @returns Left edge X for `drawBitmapText` (never less than the margin).
 */
export function statsRightAlignedTextX(text: string, displayWidth: number): number {
    const width = text.length * SYSTEM_CHAR_ADVANCE;

    return Math.max(STATS_EDGE_MARGIN_PX, displayWidth - width - STATS_EDGE_MARGIN_PX + 1);
}

/**
 * X position for the bottom-left `[~]` toggle hint label.
 *
 * Aligns with the bottom-left toggle hit region ({@link STATS_TOGGLE_CORNER_SIZE}).
 *
 * @returns Left edge X for `drawBitmapText`.
 */
export function statsToggleHintTextX(): number {
    return STATS_EDGE_MARGIN_PX;
}

/**
 * Width in pixels of the bottom-left toggle hint label.
 *
 * @param hintLabel - Toggle hint text (typically `[~]`).
 * @returns Pixel width from system font advance.
 */
export function statsToggleHintTextWidth(hintLabel: string): number {
    return hintLabel.length * SYSTEM_CHAR_ADVANCE;
}

/**
 * Palette offset for system-font overlay text (foreground glyphs stored as index 1).
 *
 * @param paletteIndex - Palette color index for overlay text.
 * @returns Offset passed to `drawBitmapText`, or `0` when index 0 (transparent).
 */
export function statsBitmapTextPaletteOffset(paletteIndex: number): number {
    return paletteIndex > 0 ? paletteIndex - 1 : 0;
}

/**
 * Y coordinate of the top edge of a custom row bar stacked above the footer.
 *
 * @param footerStackTopY - Top Y of the footer stack (palette band or hint bar).
 * @param rowIndex - `0` is directly above the footer stack.
 * @returns Bar top Y in display pixels.
 */
export function customBarY(footerStackTopY: number, rowIndex: number): number {
    return footerStackTopY - (rowIndex + 1) * (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);
}
