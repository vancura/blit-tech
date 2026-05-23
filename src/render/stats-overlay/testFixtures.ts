/**
 * Shared mocks and helpers for stats overlay unit tests.
 */

import { vi } from 'vitest';

import type { BitmapFont } from '../../assets/BitmapFont';
import type { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import type { IRenderer } from '../IRenderer';
import { STATS_BAR_HEIGHT } from './constants';
import { customBarY } from './layoutHelpers';

/** Parsed {@link IRenderer.drawBitmapTextOnTop} call from a mock renderer. */
export type BitmapTextCall = {
    pos: Vector2i;
    text: string;
    paletteOffset: number;
};

/**
 * Minimal renderer stub for {@link StatsOverlay.updateAndRender}.
 *
 * @returns Renderer with spied camera, bar fills, and bitmap text draws.
 */
export function createMockRenderer(): IRenderer & {
    drawBitmapText: ReturnType<typeof vi.fn>;
    drawBitmapTextOnTop: ReturnType<typeof vi.fn>;
    drawRectFill: ReturnType<typeof vi.fn>;
    drawRectFillOnTop: ReturnType<typeof vi.fn>;
} {
    const drawRectFillOnTop = vi.fn();
    const drawBitmapTextOnTop = vi.fn();

    return {
        getCameraOffset: vi.fn(() => Vector2i.zero()),
        resetCamera: vi.fn(),
        setCameraOffset: vi.fn(),
        drawRectFill: vi.fn(),
        drawRectFillOnTop,
        drawBitmapText: vi.fn(),
        drawBitmapTextOnTop,
    } as never;
}

/**
 * Collects {@link IRenderer.drawBitmapTextOnTop} calls from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Parsed draw calls in invocation order.
 */
export function getBitmapTextCalls(renderer: ReturnType<typeof createMockRenderer>): BitmapTextCall[] {
    return renderer.drawBitmapTextOnTop.mock.calls.map((call) => ({
        pos: call[1] as Vector2i,
        text: call[2] as string,
        paletteOffset: call[3] as number,
    }));
}

/**
 * Collects {@link IRenderer.drawRectFillOnTop} rects from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Filled rectangles in invocation order.
 */
export function getRectFillCalls(renderer: ReturnType<typeof createMockRenderer>): Rect2i[] {
    return renderer.drawRectFillOnTop.mock.calls.map((call) => call[0] as Rect2i);
}

/**
 * Y of custom row bar top stacked above the bottom band (legacy helper for tests).
 *
 * @param displayHeight - Logical display height.
 * @param rowIndex - Custom row index.
 * @returns Bar top Y.
 */
export function customRowBarY(displayHeight: number, rowIndex: number): number {
    const bottomAreaY = displayHeight - STATS_BAR_HEIGHT;

    return customBarY(displayHeight, bottomAreaY, rowIndex);
}

export const mockFont = {} as BitmapFont;

export { STATS_BAR_HEIGHT, STATS_EDGE_MARGIN_PX, STATS_ROW_GAP_PX, STATS_TOP_TEXT_Y } from './constants';
