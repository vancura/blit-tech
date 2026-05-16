import { DEFAULT_CONTAINER_ID } from './BootstrapHelpers';
import type { Vector2i } from './Vector2i';

// #region Constants

/** Default cap for on-screen canvas CSS size (demos layout uses these as max bounds). */
export const DEFAULT_MAX_CANVAS_DISPLAY_SIZE = { x: 960, y: 720 } as const;

// #endregion

// #region Types

/** Inputs for {@link applyCanvasLayoutStyles}. */
export interface CanvasLayoutStyleOptions {
    /** Logical render resolution (used for aspect ratio when `canvasDisplaySize` is omitted). */
    displaySize: Vector2i;
    /** Optional output / drawing-buffer size (drives aspect ratio when set). */
    canvasDisplaySize?: Vector2i;
    /** Maximum on-screen canvas size in CSS pixels (letterboxing still applies below this). */
    maxCanvasDisplaySize: Vector2i;
}

// #endregion

// #region Exported Helpers

/**
 * Resolves the layout root element for CSS custom property injection.
 *
 * @param canvas - The canvas element to check.
 * @returns The parent container when it carries the expected ID, otherwise the canvas itself.
 */
function resolveLayoutRoot(canvas: HTMLCanvasElement): HTMLElement {
    const parent = canvas.parentElement;

    if (parent?.id === DEFAULT_CONTAINER_ID) {
        return parent;
    }

    return canvas;
}

/**
 * Publishes CSS custom properties used by demo page layout to size the canvas.
 *
 * The demos `layout.html` reads `--canvas-display-w/h` for aspect ratio and
 * `--canvas-max-w/h` for the largest allowed display size.
 *
 * @param canvas - Target canvas element.
 * @param options - Display and max sizes from {@link HardwareSettings}.
 */
export function applyCanvasLayoutStyles(canvas: HTMLCanvasElement, options: CanvasLayoutStyleOptions): void {
    const aspectSource = options.canvasDisplaySize ?? options.displaySize;
    const layoutRoot = resolveLayoutRoot(canvas);

    layoutRoot.style.setProperty('--canvas-display-w', String(aspectSource.x));
    layoutRoot.style.setProperty('--canvas-display-h', String(aspectSource.y));
    const maxW = `${options.maxCanvasDisplaySize.x}px`;
    const maxH = `${options.maxCanvasDisplaySize.y}px`;

    layoutRoot.style.setProperty('--canvas-max-w', maxW);
    layoutRoot.style.setProperty('--canvas-max-h', maxH);
    canvas.style.setProperty('max-width', maxW, 'important');
    canvas.style.setProperty('max-height', maxH, 'important');

    if (options.canvasDisplaySize) {
        canvas.style.width = `${options.canvasDisplaySize.x}px`;
        canvas.style.height = `${options.canvasDisplaySize.y}px`;
    }
}

// #endregion
