import type { Vector2i } from '../utils/Vector2i';

// #region Types

/**
 * Result returned when WebGPU canvas initialization succeeds.
 */
export interface WebGPUContextResult {
    /** Initialized WebGPU device. */
    device: GPUDevice;

    /** Configured WebGPU canvas context. */
    context: GPUCanvasContext;

    /** WebGPU drawing-buffer size in pixels (`canvasDisplaySize ?? displaySize`). */
    drawingBufferSize: Vector2i;
}

// #endregion

// #region WebGPU Initialization

/**
 * Initializes the WebGPU adapter, device, and canvas context for a canvas.
 *
 * The WebGPU drawing buffer is sized to `canvasDisplaySize` when provided so
 * the engine can run display-tier post-processing (CRT scanlines, barrel
 * distortion, etc.) at output resolution. The CSS size of the canvas matches
 * the drawing-buffer size — when the demo wants different on-screen and
 * GPU-internal sizes it must apply CSS itself after init.
 *
 * When `canvasDisplaySize` is omitted, the drawing buffer matches the logical
 * `displaySize` (no upscaling, no display-tier effects).
 *
 * @param canvas - HTML canvas element to configure for WebGPU rendering.
 * @param displaySize - Internal logical rendering resolution in pixels.
 * @param canvasDisplaySize - Optional output drawing-buffer size in pixels.
 * @returns Initialized device, context, and drawing-buffer size, or null on failure.
 */
export async function initializeWebGPU(
    canvas: HTMLCanvasElement,
    displaySize: Vector2i,
    canvasDisplaySize?: Vector2i,
): Promise<WebGPUContextResult | null> {
    if (!navigator.gpu) {
        console.error("[BT] WebGPU isn't supported in this browser.");
        console.error('[BT] Please use Chrome/Edge 113+ or Firefox Nightly with WebGPU enabled.');
        console.error('[BT] See: https://caniuse.com/webgpu');

        return null;
    }

    // Request adapter.
    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
        console.error('[BT] Failed to get WebGPU adapter.');
        console.error('[BT] This could mean:');
        console.error('[BT]   1. The GPU/drivers are too old');
        console.error('[BT]   2. WebGPU is disabled in browser settings');
        console.error('[BT]   3. Running in an incompatible environment (VM, remote desktop, etc.)');
        console.error('[BT] Browser:', navigator.userAgent);

        return null;
    }

    // Request device.
    let device: GPUDevice;

    try {
        device = await adapter.requestDevice();
    } catch (err) {
        console.error('[BT] Failed to get WebGPU device:', err);

        return null;
    }

    // Drawing buffer = canvasDisplaySize when provided, else logical displaySize.
    // Set canvas resolution BEFORE getting the WebGPU context so getCurrentTexture()
    // returns valid textures.
    const drawingBufferSize = canvasDisplaySize ?? displaySize;

    canvas.width = drawingBufferSize.x;
    canvas.height = drawingBufferSize.y;

    // Only touch CSS when an explicit canvasDisplaySize was supplied. Demos
    // that omit it can style the canvas via HTML/CSS without us overriding.
    if (canvasDisplaySize) {
        canvas.style.width = `${canvasDisplaySize.x}px`;
        canvas.style.height = `${canvasDisplaySize.y}px`;

        console.log(
            `[BT] Canvas drawing buffer: ${drawingBufferSize.x}x${drawingBufferSize.y} ` +
                `(logical render: ${displaySize.x}x${displaySize.y})`,
        );
    }

    const context = canvas.getContext('webgpu') as GPUCanvasContext;

    if (!context) {
        console.error('[BT] Failed to get WebGPU context');

        return null;
    }

    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
    });

    console.log('[BT] WebGPU initialized successfully');

    return { device, context, drawingBufferSize: drawingBufferSize.clone() };
}

// #endregion
