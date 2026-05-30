/**
 * Shared mocks and helpers for overlay unit tests.
 */

import { vi } from 'vitest';

import type { BitmapFont } from '../assets/BitmapFont';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { OVERLAY_BAR_HEIGHT } from './layout/constants';
import { customBarY } from './layout/layoutHelpers';
import type { OverlayRenderer } from './OverlayDrawTarget';

/** Parsed {@link OverlayDrawTarget.drawLabel} call from a mock renderer. */
export type BitmapTextCall = {
    pos: Vector2i;
    text: string;
    paletteOffset: number;
};

/**
 * Minimal renderer stub for {@link Overlay.updateAndRender}.
 *
 * @returns Renderer with spied camera, bar fills, and bitmap text draws.
 */
export function createMockRenderer(): OverlayRenderer & {
    drawBitmapText: ReturnType<typeof vi.fn>;
    drawLabel: ReturnType<typeof vi.fn>;
    drawLabelOnTop: ReturnType<typeof vi.fn>;
    drawPixel: ReturnType<typeof vi.fn>;
    drawRectFill: ReturnType<typeof vi.fn>;
    drawBarFill: ReturnType<typeof vi.fn> & { rectSnapshots: Rect2i[] };
    drawBarFillOnTop: ReturnType<typeof vi.fn> & { rectSnapshots: Rect2i[] };
} {
    const rectSnapshots: Rect2i[] = [];
    const drawBarFill = vi.fn((rect: Rect2i) => {
        rectSnapshots.push(new Rect2i(rect.x, rect.y, rect.width, rect.height));
    }) as ReturnType<typeof vi.fn> & { rectSnapshots: Rect2i[] };
    drawBarFill.rectSnapshots = rectSnapshots;
    const drawBarFillOnTop = vi.fn((rect: Rect2i) => {
        rectSnapshots.push(new Rect2i(rect.x, rect.y, rect.width, rect.height));
    }) as ReturnType<typeof vi.fn> & { rectSnapshots: Rect2i[] };
    drawBarFillOnTop.rectSnapshots = rectSnapshots;
    const drawLabel = vi.fn();
    const drawLabelOnTop = vi.fn();
    const drawPixel = vi.fn();
    const drawRect = vi.fn();

    return {
        getCameraOffset: vi.fn(() => Vector2i.zero()),
        resetCamera: vi.fn(),
        setCameraOffset: vi.fn(),
        drawRectFill: vi.fn(),
        drawBarFill,
        drawBarFillOnTop,
        drawRect,
        drawBitmapText: vi.fn(),
        drawLabel,
        drawLabelOnTop,
        drawPixel,
    } as never;
}

/**
 * Collects {@link OverlayDrawTarget.drawLabel} calls from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Parsed draw calls in invocation order.
 */
export function getBitmapTextCalls(renderer: ReturnType<typeof createMockRenderer>): BitmapTextCall[] {
    return renderer.drawLabel.mock.calls.map((call) => ({
        pos: call[1] as Vector2i,
        text: call[2] as string,
        paletteOffset: (call[3] as number | undefined) ?? 0,
    }));
}

/**
 * Collects {@link OverlayDrawTarget.drawBarFill} rects from a mock renderer.
 *
 * @param renderer - Mock from {@link createMockRenderer}.
 * @returns Filled rectangles in invocation order.
 */
export function getRectFillCalls(renderer: ReturnType<typeof createMockRenderer>): Rect2i[] {
    return [...renderer.drawBarFill.rectSnapshots];
}

/**
 * Y of custom row bar top stacked above the footer.
 *
 * @param displayHeight - Logical display height.
 * @param rowIndex - Custom row index.
 * @param footerHeight - Reserved footer height from {@link resolveOverlayFooterHeight}.
 * @returns Bar top Y.
 */
export function customRowBarY(displayHeight: number, rowIndex: number, footerHeight = OVERLAY_BAR_HEIGHT): number {
    const footerStackTopY = displayHeight - footerHeight;

    return customBarY(footerStackTopY, rowIndex);
}

export const mockFont = {} as BitmapFont;

export { OVERLAY_BAR_HEIGHT, OVERLAY_EDGE_MARGIN_PX, OVERLAY_ROW_GAP_PX, OVERLAY_TOP_TEXT_Y } from './layout/constants';
