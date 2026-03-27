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
}

// #endregion

// #region WebGPU Initialization

/**
 * Initializes the WebGPU adapter, device, and canvas context for a canvas.
 *
 * The function configures the canvas pixel resolution first, optionally applies
 * a separate CSS display size, then configures the WebGPU context using the
 * browser's preferred canvas format.
 *
 * @param canvas - HTML canvas element to configure for WebGPU rendering.
 * @param displaySize - Internal rendering resolution in pixels.
 * @param canvasDisplaySize - Optional CSS display size for pixel upscaling.
 * @returns Initialized device and context, or null if initialization failed.
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

    // Set canvas resolution BEFORE getting WebGPU context.
    // This ensures getCurrentTexture() returns valid textures.
    canvas.width = displaySize.x;
    canvas.height = displaySize.y;

    // Set CSS display size if specified (for upscaling).
    if (canvasDisplaySize) {
        canvas.style.width = `${canvasDisplaySize.x}px`;
        canvas.style.height = `${canvasDisplaySize.y}px`;

        console.log(`[BT] Canvas display size: ${canvasDisplaySize.x}x${canvasDisplaySize.y}`);
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

    return { device, context };
}

// #endregion
