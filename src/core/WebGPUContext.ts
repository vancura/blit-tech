import { WEBGPU_ADAPTER_MESSAGE, WEBGPU_DEVICE_MESSAGE } from '../utils/errorMessages';
import { RenderDimensionLimitError, validateWebGPUTextureDimension } from '../utils/RenderLimits';
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

    /** WebGPU drawing-buffer size in pixels (`configuredDrawingBufferSize ?? logicalSize`). */
    drawingBufferSize: Vector2i;
}

// #endregion

// #region WebGPU Initialization

/**
 * Initializes the WebGPU adapter, device, and canvas context for a canvas.
 *
 * The WebGPU drawing buffer is sized to `configuredDrawingBufferSize` when provided so
 * the engine can run display-tier post-processing (CRT scanlines, barrel
 * distortion, etc.) at output resolution. The CSS size of the canvas matches
 * the drawing-buffer size - when the demo wants different on-screen and
 * GPU-internal sizes it must apply CSS itself after init.
 *
 * When `configuredDrawingBufferSize` is omitted, the drawing buffer matches the logical
 * `logicalSize` (no upscaling, no display-tier effects).
 *
 * @param canvas - HTML canvas element to configure for WebGPU rendering.
 * @param logicalSize - Internal logical rendering resolution in pixels.
 * @param configuredDrawingBufferSize - Optional output drawing-buffer size from `configure()`.
 * @returns Initialized device, context, and drawing-buffer size, or null when WebGPU
 *          is absent or the canvas context could not be obtained.
 * @throws Error with a user-friendly message when the adapter or device cannot be
 *         created (hardware acceleration disabled, drivers too old, resource exhaustion).
 */
export async function initWebGPU(
    canvas: HTMLCanvasElement,
    logicalSize: Vector2i,
    configuredDrawingBufferSize?: Vector2i,
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

        throw new Error(WEBGPU_ADAPTER_MESSAGE);
    }

    // Drawing buffer = configured size when provided, else logical size.
    const drawingBufferSize = configuredDrawingBufferSize ?? logicalSize;
    const adapterLimit = adapter.limits?.maxTextureDimension2D;
    const adapterLogicalError = validateWebGPUTextureDimension('logicalSize', logicalSize, adapterLimit);
    const adapterOutputError =
        configuredDrawingBufferSize === undefined
            ? null
            : validateWebGPUTextureDimension('drawingBufferSize', drawingBufferSize, adapterLimit);
    const adapterDimensionError = adapterLogicalError ?? adapterOutputError;

    if (adapterDimensionError) {
        console.error(`[BT] ${adapterDimensionError}`);

        throw new RenderDimensionLimitError(adapterDimensionError);
    }

    // Request device.
    let device: GPUDevice;

    try {
        device = await adapter.requestDevice();
    } catch (err) {
        console.error('[BT] Failed to get WebGPU device:', err);

        throw new Error(WEBGPU_DEVICE_MESSAGE, { cause: err });
    }

    const deviceLimit = device.limits?.maxTextureDimension2D;
    const deviceLogicalError = validateWebGPUTextureDimension('logicalSize', logicalSize, deviceLimit);
    const deviceOutputError =
        configuredDrawingBufferSize === undefined
            ? null
            : validateWebGPUTextureDimension('drawingBufferSize', drawingBufferSize, deviceLimit);
    const deviceDimensionError = deviceLogicalError ?? deviceOutputError;

    if (deviceDimensionError) {
        console.error(`[BT] ${deviceDimensionError}`);

        throw new RenderDimensionLimitError(deviceDimensionError);
    }

    // Set canvas resolution BEFORE getting the WebGPU context so getCurrentTexture()
    // returns valid textures.
    canvas.width = drawingBufferSize.x;
    canvas.height = drawingBufferSize.y;

    // Only touch CSS when an explicit drawing buffer was configured. Demos
    // that omit it can style the canvas via HTML/CSS without us overriding.
    if (configuredDrawingBufferSize) {
        console.log(
            `[BT] Canvas drawing buffer: ${drawingBufferSize.x}x${drawingBufferSize.y} ` +
                `(logical render: ${logicalSize.x}x${logicalSize.y})`,
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
