import { describe, expect, it } from 'vitest';

import { Vector2i } from '../utils/Vector2i';
import { OVERLAY_EDGE_MARGIN_PX } from './layout/constants';
import { hintBarY } from './layout/layoutPlan';
import { hintIconExclusionRect, hintIconPos, hintIconY, toggleIcon } from './OverlayToggleIcon';
import { createMockRenderer } from './testFixtures';
import { ICON_HEIGHT, ICON_MASK, ICON_WIDTH } from './toggleIconData';

describe('overlayToggleHintIconPos', () => {
    it('anchors the icon at the left edge margin inside the hint bar', () => {
        const hintBarTopY = hintBarY(240);

        expect(hintIconPos(hintBarTopY)).toEqual(new Vector2i(OVERLAY_EDGE_MARGIN_PX, 230));
        expect(hintIconY(hintBarTopY)).toBe(230);
        expect(hintIconExclusionRect(hintBarTopY)).toMatchObject({
            x: OVERLAY_EDGE_MARGIN_PX,
            y: 230,
            width: ICON_WIDTH,
            height: ICON_HEIGHT,
        });
    });
});

describe('drawOverlayToggleIcon', () => {
    function countMaskRuns(foregroundBit: 0 | 1): number {
        let expectedRuns = 0;

        for (let row = 0; row < ICON_HEIGHT; row++) {
            let col = 0;

            while (col < ICON_WIDTH) {
                const rowOffset = row * ICON_WIDTH;

                if (ICON_MASK[rowOffset + col] !== foregroundBit) {
                    col++;
                    continue;
                }

                while (col < ICON_WIDTH && ICON_MASK[rowOffset + col] === foregroundBit) {
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

        toggleIcon(renderer, hintBarTopY, 2);

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

        toggleIcon(renderer, hintBarTopY, 2, true);

        expect(renderer.drawBarFillOnTop).toHaveBeenCalledTimes(countMaskRuns(0));
        expect(renderer.drawBarFillOnTop.rectSnapshots[0]).toMatchObject({
            x: OVERLAY_EDGE_MARGIN_PX,
            y: 230,
            width: ICON_WIDTH,
            height: 1,
        });
    });
});
