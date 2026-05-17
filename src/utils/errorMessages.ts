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

// #region Runtime — Render configuration

/**
 * Returns the error message for a render dimension that is not a positive whole-number pixel size.
 *
 * @param field - Hardware settings field that contains the invalid size.
 * @param size - Invalid size formatted as `WIDTHxHEIGHT`.
 * @returns User-facing error string.
 */
export function renderDimensionInvalidError(field: string, size: string): string {
    return (
        `${field} must use whole-number pixel dimensions greater than 0 (got ${size}). ` +
        'Update configure() to return a positive integer width and height'
    );
}

/**
 * Returns the error message for a render dimension whose width or height exceeds engine limits.
 *
 * @param field - Hardware settings field that contains the invalid size.
 * @param size - Invalid size formatted as `WIDTHxHEIGHT`.
 * @param maxWidth - Maximum accepted width in pixels.
 * @param maxHeight - Maximum accepted height in pixels.
 * @returns User-facing error string.
 */
export function renderDimensionTooLargeError(field: string, size: string, maxWidth: number, maxHeight: number): string {
    return (
        `${field} is too large (got ${size}). ` + `Use a size no larger than ${maxWidth}x${maxHeight} in configure()`
    );
}

/**
 * Returns the error message for a render dimension whose total pixel area exceeds engine limits.
 *
 * @param field - Hardware settings field that contains the invalid size.
 * @param size - Invalid size formatted as `WIDTHxHEIGHT`.
 * @param maxPixels - Maximum accepted total pixels.
 * @returns User-facing error string.
 */
export function renderDimensionAreaTooLargeError(field: string, size: string, maxPixels: number): string {
    return `${field} uses too many pixels (got ${size}). Use a size with ${maxPixels.toLocaleString('en-US')} total pixels or fewer`;
}

/**
 * Returns the error message for a render dimension that exceeds the active WebGPU texture limit.
 *
 * @param field - Hardware settings field that contains the invalid size.
 * @param size - Invalid size formatted as `WIDTHxHEIGHT`.
 * @param maxTextureDimension2D - WebGPU adapter/device texture dimension limit.
 * @returns User-facing error string.
 */
export function renderDimensionGpuLimitError(field: string, size: string, maxTextureDimension2D: number): string {
    return (
        `${field} is too large for this graphics card (got ${size}). ` +
        `Use a width and height of ${maxTextureDimension2D} pixels or fewer`
    );
}

// #endregion

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

/**
 * Returns the error message when `applyHUD` is called with `startSlot` less than 1.
 *
 * @param startSlot - The invalid start slot value that was supplied.
 * @returns User-facing error string.
 */
export function hudStartSlotError(startSlot: number): string {
    return `HUD preset slots start from 1 (slot 0 is always transparent). Got ${startSlot}.`;
}

/**
 * Returns the error message when the HUD preset slots would exceed the palette size.
 *
 * @param startSlot - The requested start slot.
 * @param count - Number of HUD slots needed.
 * @param size - The palette size.
 * @returns User-facing error string.
 */
export function hudRangeError(startSlot: number, count: number, size: number): string {
    return (
        `HUD preset needs ${count} slots starting at ${startSlot}, ` +
        `but this palette only has ${size} entries (max slot: ${size - 1}).`
    );
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
