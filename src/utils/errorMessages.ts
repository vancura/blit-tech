/**
 * Shared user-facing error message strings for the Blit-Tech bootstrap and runtime paths.
 *
 * Both the production bootstrap (Bootstrap.ts) and the error-preview demo
 * (BootstrapHelpers.ts) import from here, guaranteeing they can never drift
 * apart. Runtime message helpers (palette, sprite) are also centralized here
 * so every site uses identical wording.
 */

/**
 * Returns the canvas-not-found error message for the given canvas element ID.
 *
 * @param canvasId - The canvas element ID that was searched for.
 * @returns User-facing error string.
 */
export function CANVAS_NOT_FOUND_MESSAGE(canvasId: string): string {
    return `Can't find the canvas on the page. Make sure your HTML has a <canvas id='${canvasId}'> element.`;
}

/**
 * Generic engine initialization failure message.
 *
 * Shown when the engine returns false for any reason not covered by a more
 * specific GPU failure message.
 */
export const INIT_FAILED_MESSAGE =
    'Something went wrong starting the engine. Check the browser console (press F12) for details.';

/**
 * Friendly message for a WebGPU adapter failure.
 *
 * Shown when `requestAdapter()` resolves to null (hardware acceleration
 * disabled, drivers too old, or running in a VM / remote desktop).
 */
export const WEBGPU_ADAPTER_MESSAGE =
    "Your computer's graphics card couldn't start WebGPU. Try updating your browser, or check that hardware acceleration is enabled.";

/**
 * Friendly message for a WebGPU device failure.
 *
 * Shown when `requestDevice()` rejects (GPU resource exhaustion or a
 * transient driver error).
 */
export const WEBGPU_DEVICE_MESSAGE =
    "Couldn't connect to the graphics card. Try closing other tabs or restarting the browser.";

// #region Runtime — Palette

/**
 * Returns the "no active palette" error message used whenever a palette must
 * be set before an operation can proceed.
 *
 * @returns User-facing error string.
 */
export function noActivePaletteError(): string {
    return 'No palette set yet. Call BT.paletteSet(somePalette) before drawing or running palette effects.';
}

/**
 * Returns the error message for a palette index that is negative or not a
 * whole number.
 *
 * @param index - The invalid index value that was supplied.
 * @returns User-facing error string.
 */
export function paletteIndexNegativeError(index: number): string {
    return `The color number must be a whole number that's 0 or higher (got ${index}).`;
}

/**
 * Returns the error message for a palette index that exceeds the palette size.
 *
 * @param index - The out-of-range index that was supplied.
 * @param size - The number of colors in the active palette.
 * @returns User-facing error string.
 */
export function paletteIndexOutOfRangeError(index: number, size: number): string {
    return `The color number ${index} is too big for this palette. The palette has ${size} colors, so use a number from 0 to ${size - 1}.`;
}

// #endregion

// #region Runtime — Sprites

/**
 * Returns the error message for a sprite pixel whose color is absent from the
 * active palette.
 *
 * @param x - Pixel x coordinate within the source image.
 * @param y - Pixel y coordinate within the source image.
 * @param src - Source image label (e.g. `'sheet.png'` or `(unnamed)`).
 * @param hex - The color that was not found, as a lowercase hex string.
 * @returns User-facing error string.
 */
export function spriteColorNotInPaletteError(x: number, y: number, src: string, hex: string): string {
    return (
        `The pixel at (${x}, ${y}) in ${src} has the color ${hex}, but that color isn't in your palette.` +
        ` Either add ${hex} to the palette, or change that pixel in the image.`
    );
}

/**
 * Returns the error message shown when a sprite sheet has not been indexized
 * before use.
 *
 * @returns User-facing error string.
 */
export function spriteNotIndexizedError(): string {
    return (
        "This sprite sheet hasn't been prepared yet. Use SpriteSheet.loadIndexed(...) for one-step setup," +
        ' or call sheet.indexize(palette) after BT.paletteSet.'
    );
}

// #endregion
