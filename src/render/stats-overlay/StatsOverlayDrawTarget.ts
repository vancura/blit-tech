import type { BitmapFont } from '../../assets/BitmapFont';
import type { Rect2i } from '../../utils/Rect2i';
import type { Vector2i } from '../../utils/Vector2i';
import type { IRenderer } from '../IRenderer';

/**
 * Internal draw port for the engine stats HUD.
 *
 * Not part of the public {@link BT} API. {@link WebGpuRenderer} and
 * {@link SoftwareRenderer} implement this alongside {@link IRenderer}.
 */
export interface StatsOverlayDrawTarget {
    /**
     * Filled rectangles composited above demo sprites for the stats overlay.
     *
     * On WebGPU, batched in `overlayPrimitives` after the demo sprite pass.
     *
     * @param rect - Rectangle bounds in display coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawBarFill(rect: Rect2i, paletteIndex: number): void;

    /**
     * Bitmap text composited above overlay bar fills for the stats overlay.
     *
     * On WebGPU, batched in `overlaySprites` after overlay bar fills.
     *
     * @param font - Bitmap font with character glyphs (underlying sheet must be indexized).
     * @param pos - Text position (top-left corner).
     * @param text - String to render.
     * @param paletteOffset - Palette index offset applied to all glyphs (default 0).
     */
    drawLabel(font: BitmapFont, pos: Vector2i, text: string, paletteOffset?: number): void;
}

/**
 * Renderer surface used by {@link StatsOverlay.updateAndRender}.
 *
 * Combines screen-space camera helpers with stats overlay draw batches.
 */
export type StatsOverlayRenderer = Pick<IRenderer, 'getCameraOffset' | 'resetCamera' | 'setCameraOffset'> &
    StatsOverlayDrawTarget;
