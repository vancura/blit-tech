import { describe, expect, it } from 'vitest';

import { Vector2i } from '../utils/Vector2i';
import { OVERLAY_EDGE_MARGIN_PX } from './layout/constants';
import { hintBarY } from './layout/layoutPlan';
import {
    drawOverlayToggleIcon,
    overlayToggleHintIconExclusionRect,
    overlayToggleHintIconPos,
    overlayToggleHintIconY,
} from './OverlayToggleIcon';
import { createMockRenderer } from './testFixtures';
import { OVERLAY_TOGGLE_ICON_HEIGHT, OVERLAY_TOGGLE_ICON_MASK, OVERLAY_TOGGLE_ICON_WIDTH } from './toggleIconData';

describe('overlayToggleHintIconPos', () => {
    it('anchors the icon at the left edge margin inside the hint bar', () => {
        const hintBarTopY = hintBarY(240);

        expect(overlayToggleHintIconPos(hintBarTopY)).toEqual(new Vector2i(OVERLAY_EDGE_MARGIN_PX, 230));
        expect(overlayToggleHintIconY(hintBarTopY)).toBe(230);
        expect(overlayToggleHintIconExclusionRect(hintBarTopY)).toMatchObject({
            x: OVERLAY_EDGE_MARGIN_PX,
            y: 230,
            width: OVERLAY_TOGGLE_ICON_WIDTH,
            height: OVERLAY_TOGGLE_ICON_HEIGHT,
        });
    });
});

describe('drawOverlayToggleIcon', () => {
    function countMaskRuns(foregroundBit: 0 | 1): number {
        let expectedRuns = 0;

        for (let row = 0; row < OVERLAY_TOGGLE_ICON_HEIGHT; row++) {
            let col = 0;

            while (col < OVERLAY_TOGGLE_ICON_WIDTH) {
                const rowOffset = row * OVERLAY_TOGGLE_ICON_WIDTH;

                if (OVERLAY_TOGGLE_ICON_MASK[rowOffset + col] !== foregroundBit) {
                    col++;
                    continue;
                }

                while (col < OVERLAY_TOGGLE_ICON_WIDTH && OVERLAY_TOGGLE_ICON_MASK[rowOffset + col] === foregroundBit) {
                    col++;
                }

                expectedRuns++;
            }
        }

        return expectedRuns;
    }

    it('draws one on-top fill per horizontal foreground mask run', () => {
        const renderer = createMockRenderer();
        const hintBarTopY = hintBarY(240);

        drawOverlayToggleIcon(renderer, hintBarTopY, 2);

        expect(renderer.drawBarFillOnTop).toHaveBeenCalledTimes(countMaskRuns(1));
        expect(renderer.drawBarFillOnTop.rectSnapshots[0]).toMatchObject({
            x: OVERLAY_EDGE_MARGIN_PX + 3,
            y: 232,
            width: 2,
            height: 1,
        });
    });

    it('draws the complement mask when inverted', () => {
        const renderer = createMockRenderer();
        const hintBarTopY = hintBarY(240);

        drawOverlayToggleIcon(renderer, hintBarTopY, 2, true);

        expect(renderer.drawBarFillOnTop).toHaveBeenCalledTimes(countMaskRuns(0));
        expect(renderer.drawBarFillOnTop.rectSnapshots[0]).toMatchObject({
            x: OVERLAY_EDGE_MARGIN_PX,
            y: 230,
            width: OVERLAY_TOGGLE_ICON_WIDTH,
            height: 1,
        });
    });
});
