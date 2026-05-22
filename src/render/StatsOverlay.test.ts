/**
 * Unit tests for {@link StatsOverlay} layout helpers, label parsing, and draw layout.
 *
 * Layout contract (see {@link StatsOverlay} and docs/api-core.md Stats overlay):
 * - Top left: demo title; top right: `backend | WxH`
 * - Bottom left: `FPS: N | Target: T`; bottom right: demo title
 */

import { describe, expect, it, vi } from 'vitest';

import type { BitmapFont } from '../assets/BitmapFont';
import { Palette } from '../assets/Palette';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';
import {
    createStatsOverlayLayout,
    isPointerInStatsToggleCorner,
    resolveStatsDemoLabel,
    StatsOverlay,
    statsRightAlignedTextX,
} from './StatsOverlay';

// #region Test Helpers

const STATS_EDGE_MARGIN_PX = 5;
const STATS_TOP_TEXT_Y = 1;
const SYSTEM_CHAR_ADVANCE = 6;

type BitmapTextCall = {
    pos: Vector2i;
    text: string;
    paletteOffset: number;
};

/**
 * Minimal renderer stub for {@link StatsOverlay.updateAndRender}.
 *
 * @returns Renderer with spied camera, bar fills, and bitmap text draws.
 */
function createMockRenderer(): IRenderer & {
    drawBitmapText: ReturnType<typeof vi.fn>;
    drawRectFill: ReturnType<typeof vi.fn>;
} {
    return {
        getCameraOffset: vi.fn(() => Vector2i.zero()),
        resetCamera: vi.fn(),
        setCameraOffset: vi.fn(),
        drawRectFill: vi.fn(),
        drawBitmapText: vi.fn(),
    } as never;
}

/**
 * Collects {@link IRenderer.drawBitmapText} calls from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Parsed draw calls in invocation order.
 */
function getBitmapTextCalls(renderer: ReturnType<typeof createMockRenderer>): BitmapTextCall[] {
    return renderer.drawBitmapText.mock.calls.map((call) => ({
        pos: call[1] as Vector2i,
        text: call[2] as string,
        paletteOffset: call[3] as number,
    }));
}

const mockFont = {} as BitmapFont;

// #endregion

// #region resolveStatsDemoLabel

describe('resolveStatsDemoLabel', () => {
    it('formats registry-style page titles without a Blit-Tech prefix', () => {
        expect(resolveStatsDemoLabel('Blit-Tech Demo 006 - Patterns')).toBe('Patterns Demo');
        expect(resolveStatsDemoLabel('Blit-Tech Demo 002 - Primitives')).toBe('Primitives Demo');
    });

    it('falls back when title is empty', () => {
        expect(resolveStatsDemoLabel('')).toBe('Demo');
        expect(resolveStatsDemoLabel(undefined)).toBe('Demo');
    });

    it('passes through non-registry titles unchanged', () => {
        expect(resolveStatsDemoLabel('Custom Page')).toBe('Custom Page');
    });
});

// #endregion

// #region createStatsOverlayLayout

describe('createStatsOverlayLayout', () => {
    it('places bottom text one line above the display bottom', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);

        expect(layout.displayWidth).toBe(320);
        expect(layout.displayHeight).toBe(240);
        expect(layout.bottomTextY).toBe(240 - 14 - 1);
        expect(layout.topTextY).toBe(STATS_TOP_TEXT_Y);
        expect(layout.toggleRect.x).toBe(320 - 48);
        expect(layout.toggleRect.y).toBe(240 - 48);
        expect(layout.toggleRect.width).toBe(48);
        expect(layout.toggleRect.height).toBe(48);
    });
});

// #endregion

// #region statsRightAlignedTextX

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

// #endregion

// #region isPointerInStatsToggleCorner

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

// #endregion

// #region StatsOverlay

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

    it('draws demo title top-left, backend top-right, FPS bottom-left, demo bottom-right', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Patterns Demo', 60);
        const renderer = createMockRenderer();

        overlay.setActiveBackend('webgpu');
        overlay.updateAndRender(renderer, mockFont, null, null, null, 0);

        const calls = getBitmapTextCalls(renderer);
        const backendText = 'webgpu | 320x240';
        const topRightX = statsRightAlignedTextX(backendText, 320);
        const bottomTitleX = statsRightAlignedTextX('Patterns Demo', 320);

        expect(calls).toHaveLength(4);
        expect(calls[0]).toEqual({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, STATS_TOP_TEXT_Y),
            text: 'Patterns Demo',
            paletteOffset: 1,
        });
        expect(calls[1]).toEqual({
            pos: new Vector2i(topRightX, STATS_TOP_TEXT_Y),
            text: backendText,
            paletteOffset: 1,
        });
        expect(calls[2]).toMatchObject({
            pos: new Vector2i(STATS_EDGE_MARGIN_PX, layout.bottomTextY),
            text: expect.stringMatching(/^FPS: \d+ \| Target: 60$/),
            paletteOffset: 1,
        });
        expect(calls[3]).toEqual({
            pos: new Vector2i(bottomTitleX, layout.bottomTextY),
            text: 'Patterns Demo',
            paletteOffset: 1,
        });
    });

    it('uses ellipsis backend placeholder before init completes', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60);
        const renderer = createMockRenderer();

        overlay.updateAndRender(renderer, mockFont, null, null, null, 0);

        const backendCall = getBitmapTextCalls(renderer)[1];
        expect(backendCall?.text).toBe('… | 320x240');
    });

    it('skips draw calls when hidden', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60);
        const renderer = createMockRenderer();

        overlay.handleToggle(null, { isKeyPressed: (key: string) => key === 'Backquote' } as never, 1);
        overlay.updateAndRender(renderer, mockFont, null, null, null, 2);

        expect(renderer.drawRectFill).not.toHaveBeenCalled();
        expect(renderer.drawBitmapText).not.toHaveBeenCalled();
    });

    it('resets camera for overlay draws then restores the saved offset', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60);
        const renderer = createMockRenderer();
        const saved = new Vector2i(12, 34);

        renderer.getCameraOffset = vi.fn(() => saved);
        overlay.updateAndRender(renderer, mockFont, null, null, null, 0);

        expect(renderer.resetCamera).toHaveBeenCalledOnce();
        expect(renderer.setCameraOffset).toHaveBeenCalledWith(saved);
    });

    it('resolves hud_bg and hud_dim palette indices when HUD aliases exist', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const overlay = new StatsOverlay(layout, 'Demo', 60);
        const renderer = createMockRenderer();
        const palette = new Palette(16);

        palette.applyHUD(1);
        overlay.updateAndRender(renderer, mockFont, palette, null, null, 0);

        const calls = getBitmapTextCalls(renderer);
        const hudDim = palette.getNamed('hud_dim');

        expect(calls.every((call) => call.paletteOffset === hudDim - 1)).toBe(true);
    });
});

// #endregion
