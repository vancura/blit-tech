/**
 * Draw helper for the inline overlay toggle hint bitmap icon (VV-548).
 */

import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { OVERLAY_BAR_HEIGHT, OVERLAY_EDGE_MARGIN_PX } from './layout/constants';
import type { OverlayDrawTarget } from './OverlayDrawTarget';
import { OVERLAY_TOGGLE_ICON_HEIGHT, OVERLAY_TOGGLE_ICON_MASK, OVERLAY_TOGGLE_ICON_WIDTH } from './toggleIconData';

/** Reused fill rect for icon horizontal runs (one overlay draw at a time). */
const iconDrawScratch = {
    run: new Rect2i(),
    origin: new Vector2i(),
};

/**
 * Computes the icon top-left Y inside the hint bar without allocating.
 *
 * @param hintBarTopY - Top Y of the bottom hint bar from the layout plan.
 * @returns Icon top Y in display pixels.
 */
export function overlayToggleHintIconY(hintBarTopY: number): number {
    return hintBarTopY + Math.floor((OVERLAY_BAR_HEIGHT - OVERLAY_TOGGLE_ICON_HEIGHT) / 2);
}

/**
 * Returns the top-left screen position for the toggle hint icon inside the hint bar.
 *
 * @param hintBarTopY - Top Y of the bottom hint bar from the layout plan.
 * @returns Icon anchor in display pixels.
 */
export function overlayToggleHintIconPos(hintBarTopY: number): Vector2i {
    return new Vector2i(OVERLAY_EDGE_MARGIN_PX, overlayToggleHintIconY(hintBarTopY));
}

/**
 * Returns the screen-space rect reserved for the toggle hint icon (palette swatch exclusion).
 *
 * @param hintBarTopY - Top Y of the bottom hint bar from the layout plan.
 * @returns Icon bounding rect in display pixels.
 */
export function overlayToggleHintIconExclusionRect(hintBarTopY: number): Rect2i {
    return new Rect2i(
        OVERLAY_EDGE_MARGIN_PX,
        overlayToggleHintIconY(hintBarTopY),
        OVERLAY_TOGGLE_ICON_WIDTH,
        OVERLAY_TOGGLE_ICON_HEIGHT,
    );
}

/**
 * Draws the toggle hint icon from {@link OVERLAY_TOGGLE_ICON_MASK} using on-top bar fills.
 *
 * Collapses each mask row into horizontal runs to minimize draw calls. Reuses scratch rects
 * so the path stays allocation-free after warmup.
 *
 * @param target - Overlay draw target.
 * @param hintBarTopY - Top Y of the bottom hint bar from the layout plan.
 * @param textPaletteIndex - Overlay text palette index (`OverlayStyle.textPaletteIndex`, default `2`).
 * @param inverted - When `true`, draw the complement mask so the symbol reads against the hint bar fill.
 */
export function drawOverlayToggleIcon(
    target: OverlayDrawTarget,
    hintBarTopY: number,
    textPaletteIndex: number,
    inverted = false,
): void {
    writeOverlayToggleHintIconOrigin(iconDrawScratch.origin, hintBarTopY);
    const originX = iconDrawScratch.origin.x;
    const originY = iconDrawScratch.origin.y;
    const run = iconDrawScratch.run;
    const foregroundBit = inverted ? 0 : 1;

    for (let row = 0; row < OVERLAY_TOGGLE_ICON_HEIGHT; row++) {
        let col = 0;

        while (col < OVERLAY_TOGGLE_ICON_WIDTH) {
            const rowOffset = row * OVERLAY_TOGGLE_ICON_WIDTH;

            if (OVERLAY_TOGGLE_ICON_MASK[rowOffset + col] !== foregroundBit) {
                col++;
                continue;
            }

            const runStart = col;

            while (col < OVERLAY_TOGGLE_ICON_WIDTH && OVERLAY_TOGGLE_ICON_MASK[rowOffset + col] === foregroundBit) {
                col++;
            }

            run.set(originX + runStart, originY + row, col - runStart, 1);
            target.drawBarFillOnTop(run, textPaletteIndex);
        }
    }
}

/**
 * Writes the toggle hint icon top-left origin into {@link target} without allocating.
 *
 * @param target - Reusable vector mutated in place.
 * @param hintBarTopY - Top Y of the bottom hint bar from the layout plan.
 */
function writeOverlayToggleHintIconOrigin(target: Vector2i, hintBarTopY: number): void {
    target.x = OVERLAY_EDGE_MARGIN_PX;
    target.y = overlayToggleHintIconY(hintBarTopY);
}
