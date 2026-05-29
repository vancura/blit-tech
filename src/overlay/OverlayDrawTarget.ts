import type { BitmapFont } from '../assets/BitmapFont';
import type { IRenderer } from '../render/IRenderer';
import type { Rect2i } from '../utils/Rect2i';
import type { Vector2i } from '../utils/Vector2i';

/**
 * Internal draw port for the engine overlay HUD.
 *
 * Not part of the public {@link BT} API. {@link WebGpuRenderer} and
 * {@link SoftwareRenderer} implement this alongside {@link IRenderer}.
 */
export interface OverlayDrawTarget {
    /**
     * Filled rectangles composited above demo sprites for the overlay.
     *
     * On WebGPU, batched in `overlayPrimitives` after the demo sprite pass.
     *
     * @param rect - Rectangle bounds in display coordinates.
     * @param paletteIndex - Palette color index.
     */
    drawBarFill(rect: Rect2i, paletteIndex: number): void;

    /**
     * Bitmap text composited above overlay bar fills for the overlay.
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
 * Renderer surface used by {@link Overlay.updateAndRender}.
 *
 * Combines screen-space camera helpers with overlay draw batches.
 */
export type OverlayRenderer = Pick<IRenderer, 'getCameraOffset' | 'resetCamera' | 'setCameraOffset'> &
    OverlayDrawTarget;
