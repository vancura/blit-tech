/**
 * Unit tests for {@link StatsOverlay} layout helpers and toggle hit-testing.
 */

import { describe, expect, it } from 'vitest';

import { Vector2i } from '../utils/Vector2i';
import {
    createStatsOverlayLayout,
    isPointerInStatsToggleCorner,
    resolveStatsDemoLabel,
    StatsOverlay,
} from './StatsOverlay';

describe('resolveStatsDemoLabel', () => {
    it('formats registry-style page titles', () => {
        expect(resolveStatsDemoLabel('Blit-Tech Demo 006 - Patterns')).toBe('Blit-Tech - Patterns Demo');
    });

    it('falls back when title is empty', () => {
        expect(resolveStatsDemoLabel('')).toBe('Blit-Tech Demo');
        expect(resolveStatsDemoLabel(undefined)).toBe('Blit-Tech Demo');
    });

    it('passes through non-registry titles unchanged', () => {
        expect(resolveStatsDemoLabel('Custom Page')).toBe('Custom Page');
    });
});

describe('createStatsOverlayLayout', () => {
    it('places bottom text one line above the display bottom', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(layout.displayWidth).toBe(320);
        expect(layout.displayHeight).toBe(240);
        expect(layout.bottomTextY).toBe(240 - 14 - 1);
        expect(layout.toggleRect.x).toBe(320 - 48);
        expect(layout.toggleRect.y).toBe(240 - 48);
        expect(layout.toggleRect.width).toBe(48);
        expect(layout.toggleRect.height).toBe(48);
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

describe('StatsOverlay', () => {
    it('starts visible and toggles visibility', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Test Demo', 60);

        expect(overlay.visible).toBe(true);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            1,
        );

        expect(overlay.visible).toBe(false);

        overlay.handleToggle(
            null,
            {
                isKeyPressed: (key: string) => key === 'Backquote',
            } as never,
            2,
        );

        expect(overlay.visible).toBe(true);
    });
});
