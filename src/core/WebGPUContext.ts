import type { Vector2i } from '../utils/Vector2i';

// #region Types

/**
 * Result of a successful WebGPU context initialization.
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
 * Initializes the WebGPU adapter, device, and canvas context.
 * Configures the canvas resolution and optional CSS display size for upscaling.
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
        console.error('[BlitTech] WebGPU is not supported in this browser.');
        console.error('[BlitTech] Please use Chrome/Edge 113+ or Firefox Nightly with WebGPU enabled.');
        console.error('[BlitTech] See: https://caniuse.com/webgpu');

        return null;
    }

    // Request adapter.
    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
        console.error('[BlitTech] Failed to get WebGPU adapter.');
        console.error('[BlitTech] This could mean:');
        console.error('[BlitTech]   1. Your GPU/drivers are too old');
        console.error('[BlitTech]   2. WebGPU is disabled in browser settings');
        console.error('[BlitTech]   3. Running in incompatible environment (VM, remote desktop, etc.)');
        console.error('[BlitTech] Browser:', navigator.userAgent);

        return null;
    }

    // Request device.
    const device = await adapter.requestDevice();

    if (!device) {
        console.error('[BlitTech] Failed to get WebGPU device');

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

        console.log(`[BlitTech] Canvas display size: ${canvasDisplaySize.x}x${canvasDisplaySize.y}`);
    }

    const context = canvas.getContext('webgpu') as GPUCanvasContext;

    if (!context) {
        console.error('[BlitTech] Failed to get WebGPU context');

        return null;
    }

    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
    });

    console.log('[BlitTech] WebGPU initialized successfully');

    return { device, context };
}

// #endregion
