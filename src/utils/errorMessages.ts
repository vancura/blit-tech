/**
 * Shared user-facing error message strings for the Blit-Tech bootstrap path.
 *
 * Both the production bootstrap (Bootstrap.ts) and the error-preview demo
 * (BootstrapHelpers.ts) import from here, guaranteeing they can never drift
 * apart.
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
