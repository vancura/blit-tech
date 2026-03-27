/**
 * Bootstrap Utilities for Blit-Tech
 *
 * Provides a one-liner demo bootstrap that handles WebGPU detection,
 * canvas retrieval, and engine initialization with error display.
 */

import { BTAPI } from '../core/BTAPI';
import type { IBlitTechDemo } from '../core/IBlitTechDemo';
import type { ErrorContent } from './BootstrapHelpers';
import {
    checkWebGPUSupport,
    DEFAULT_CANVAS_ID,
    DEFAULT_CONTAINER_ID,
    displayError,
    getCanvas,
} from './BootstrapHelpers';

// #region Types

/**
 * Options for the bootstrap function.
 */
export interface BootstrapOptions {
    /**
     * Canvas element ID to use.
     * Default: 'blit-tech-canvas'
     */
    canvasId?: string;

    /**
     * Container element ID for error display.
     * Default: 'canvas-container'
     */
    containerId?: string;

    /** Custom callback on successful initialization. */
    onSuccess?: () => void;

    /** Custom callback on initialization error. */
    onError?: (error: Error) => void;

    /**
     * Whether to automatically handle DOM ready state.
     * Default: true
     */
    waitForDOMReady?: boolean;
}

/**
 * Constructor type for demo classes.
 */
export type DemoConstructor = new () => IBlitTechDemo;

/**
 * Internal result type for bootstrap steps.
 */
interface BootstrapResult {
    success: boolean;
    error?: Error;
}

// #endregion

// #region Error Messages

/** Error message for WebGPU not supported. */
const WEBGPU_NOT_SUPPORTED_MESSAGE =
    'The browser does not support WebGPU.\n\n' +
    'Supported browsers:\n' +
    'Chrome/Edge 113+\n' +
    'Firefox Nightly (with the flag enabled)\n' +
    'Safari 18+\n\n' +
    'Please update the browser or try a different one.';

/** Error message for initialization failure. */
const INIT_FAILED_MESSAGE = 'The engine failed to initialize. Check the console for details.';

// #endregion

// #region Helper Functions

/**
 * Waits for DOM to be ready if it's still loading.
 *
 * @returns Promise that resolves when DOM is ready.
 */
async function waitForDOM(): Promise<void> {
    if (document.readyState === 'loading') {
        await new Promise<void>((resolve) => {
            document.addEventListener('DOMContentLoaded', () => resolve());
        });
    }
}

/**
 * Handles a bootstrap error by displaying it and invoking the callback.
 *
 * @param title - Error title for display.
 * @param message - Error message for display.
 * @param error - The Error object.
 * @param containerId - Container ID for error display.
 * @param onError - Optional error callback.
 * @returns BootstrapResult indicating failure.
 */
function handleBootstrapError(
    title: string,
    message: ErrorContent,
    error: Error,
    containerId: string,
    onError?: (error: Error) => void,
): BootstrapResult {
    displayError(title, message, containerId);
    onError?.(error);
    return { success: false, error };
}

/**
 * Validates WebGPU support and returns the result.
 *
 * @param containerId - Container ID for error display.
 * @param onError - Optional error callback.
 * @returns BootstrapResult with success status.
 */
function validateWebGPU(containerId: string, onError?: (error: Error) => void): BootstrapResult {
    let result: BootstrapResult;

    if (checkWebGPUSupport()) {
        result = { success: true };
    } else {
        result = handleBootstrapError(
            'WebGPU Not Supported',
            WEBGPU_NOT_SUPPORTED_MESSAGE,
            new Error('WebGPU is not supported in this browser'),
            containerId,
            onError,
        );
    }

    return result;
}

/**
 * Validates the canvas element and returns it.
 *
 * @param canvasId - Canvas element ID.
 * @param containerId - Container ID for error display.
 * @param onError - Optional error callback.
 * @returns Canvas element or null with error handling.
 */
function validateCanvas(
    canvasId: string,
    containerId: string,
    onError?: (error: Error) => void,
): { canvas: HTMLCanvasElement | null; result: BootstrapResult } {
    const canvas = getCanvas(canvasId);
    let result: BootstrapResult;

    if (canvas) {
        result = { success: true };
    } else {
        result = handleBootstrapError(
            'Canvas Error',
            `Failed to find the canvas element with the id '${canvasId}'.\n\n` +
                'Make sure the HTML includes a canvas element with the correct ID.',
            new Error(`Canvas element '${canvasId}' not found`),
            containerId,
            onError,
        );
    }

    return { canvas, result };
}

/**
 * Initializes the engine with the provided demo and canvas.
 *
 * @param DemoClass - Demo class constructor.
 * @param canvas - Canvas element.
 * @param containerId - Container ID for error display.
 * @param onSuccess - Optional success callback.
 * @param onError - Optional error callback.
 * @returns BootstrapResult with success status.
 */
async function initializeDemo(
    DemoClass: DemoConstructor,
    canvas: HTMLCanvasElement,
    containerId: string,
    onSuccess?: () => void,
    onError?: (error: Error) => void,
): Promise<BootstrapResult> {
    const demo = new DemoClass();
    let initialized: boolean;
    let initError: Error | undefined;

    try {
        initialized = await BTAPI.instance.initialize(demo, canvas);
    } catch (err) {
        initError = err instanceof Error ? err : new Error(String(err));
        console.error('[BT] Engine initialization threw an unexpected error:', initError);
        initialized = false;
    }

    let result: BootstrapResult;

    if (initialized) {
        console.log('[BT] Demo started successfully');

        onSuccess?.();

        result = { success: true };
    } else {
        const displayMessage: ErrorContent = initError
            ? { text: INIT_FAILED_MESSAGE, code: initError.message }
            : INIT_FAILED_MESSAGE;

        result = handleBootstrapError(
            'Initialization Failed',
            displayMessage,
            initError ?? new Error('Engine initialization failed'),
            containerId,
            onError,
        );
    }

    return result;
}

// #endregion

// #region Bootstrap Function

/**
 * One-liner bootstrap function for Blit-Tech demos.
 * Handles WebGPU detection, canvas retrieval, and engine initialization.
 *
 * This function provides a streamlined way to start a demo with sensible defaults
 * while allowing customization through options.
 *
 * @param DemoClass - Demo class constructor implementing IBlitTechDemo.
 * @param options - Optional configuration for IDs and callbacks.
 * @returns `true` when the demo boots successfully; otherwise `false`.
 *
 * @example
 * // Simplest usage - uses default IDs.
 * bootstrap(MyDemo);
 *
 * @example
 * // With custom options.
 * bootstrap(MyDemo, {
 *     canvasId: 'custom-canvas',
 *     containerId: 'custom-container',
 *     onSuccess: () => console.log('Demo started!'),
 *     onError: (err) => analytics.trackError(err),
 * });
 *
 * @example
 * // Await the result.
 * const success = await bootstrap(MyDemo);
 * if (success) {
 *     console.log('Demo is running');
 * }
 */
export async function bootstrap(DemoClass: DemoConstructor, options: BootstrapOptions = {}): Promise<boolean> {
    const {
        canvasId = DEFAULT_CANVAS_ID,
        containerId = DEFAULT_CONTAINER_ID,
        onSuccess,
        onError,
        waitForDOMReady = true,
    } = options;

    let success = false;

    // Wait for DOM if needed.
    if (waitForDOMReady) {
        await waitForDOM();
    }

    try {
        // Validate WebGPU support.
        const webGPUResult = validateWebGPU(containerId, onError);

        success = webGPUResult.success;

        // Validate canvas element.
        if (success) {
            const { canvas, result: canvasResult } = validateCanvas(canvasId, containerId, onError);

            success = canvasResult.success;

            // Initialize the demo.
            if (success && canvas) {
                const initResult = await initializeDemo(DemoClass, canvas, containerId, onSuccess, onError);

                success = initResult.success;
            }
        }
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        console.error('[BT] Bootstrap error:', error);

        handleBootstrapError(
            'Unexpected Error',
            {
                text: 'An unexpected error occurred during initialization:',
                code: error.message,
            },
            error,
            containerId,
            onError,
        );

        success = false;
    }

    return success;
}

// #endregion
