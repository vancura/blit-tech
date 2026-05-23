import { describe, expect, it } from 'vitest';

import { Vector2i } from '../../utils/Vector2i';
import { STATS_EDGE_MARGIN_PX, STATS_TOP_TEXT_Y, SYSTEM_CHAR_ADVANCE } from './constants';
import { createStatsOverlayLayout, isPointerInStatsToggleCorner, statsRightAlignedTextX } from './layoutHelpers';

describe('createStatsOverlayLayout', () => {
    it('places bottom text at the configured bottom gap offset', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(layout.displayWidth).toBe(320);
        expect(layout.displayHeight).toBe(240);
        expect(layout.bottomTextY).toBe(240 - 14 + 1);
        expect(layout.topTextY).toBe(STATS_TOP_TEXT_Y);
        expect(layout.toggleRect.x).toBe(320 - 48);
        expect(layout.toggleRect.y).toBe(240 - 48);
        expect(layout.toggleRect.width).toBe(48);
        expect(layout.toggleRect.height).toBe(48);
    });
});

describe('statsRightAlignedTextX', () => {
    it('places text flush right with edge margin (+1 px inset)', () => {
        const label = 'webgpu | 320x240';
        const width = label.length * SYSTEM_CHAR_ADVANCE;
        expect(statsRightAlignedTextX(label, 320)).toBe(320 - width - STATS_EDGE_MARGIN_PX + 1);
    });

    it('never places text left of the edge margin', () => {
        expect(statsRightAlignedTextX('a very long label that exceeds the display', 32)).toBe(STATS_EDGE_MARGIN_PX);
    });
});

describe('isPointerInStatsToggleCorner', () => {
    it('returns true inside the bottom-right 48x48 region', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(isPointerInStatsToggleCorner(new Vector2i(300, 220), layout.toggleRect)).toBe(true);
        expect(isPointerInStatsToggleCorner(new Vector2i(272, 192), layout.toggleRect)).toBe(true);
    });

    it('returns false outside the toggle region', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(isPointerInStatsToggleCorner(new Vector2i(0, 0), layout.toggleRect)).toBe(false);
        expect(isPointerInStatsToggleCorner(new Vector2i(271, 191), layout.toggleRect)).toBe(false);
    });
});
