/**
 * Bootstrap Utilities for Blit-Tech
 *
 * Provides a one-liner demo bootstrap that handles WebGPU detection,
 * canvas retrieval, and engine initialization with error display.
 */

import { BTAPI } from '../core/BTAPI';
import type { IBlitTechDemo } from '../core/IBlitTechDemo';
import type { ErrorContent } from './BootstrapHelpers';
import { DEFAULT_CANVAS_ID, DEFAULT_CONTAINER_ID, displayError, getCanvas } from './BootstrapHelpers';
import { CANVAS_NOT_FOUND_MESSAGE, INIT_FAILED_MESSAGE } from './errorMessages';

// #region Types

/**
 * Options for the bootstrap function.
 */
export interface BootstrapOptions {
    /**
     * Canvas element ID to use.
     * Default: 'blit-tech-canvas'
     */
    canvasID?: string;

    /**
     * Container element ID for error display.
     * Default: 'canvas-container'
     */
    containerID?: string;

    /** Custom callback on successful initialization. */
    onSuccess?: () => void;

    /** Custom callback on initialization error. */
    onError?: (error: Error) => void;

    /**
     * Whether to automatically handle DOM ready state.
     * Default: true
     */
    isWaitingForDOMReady?: boolean;
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
 * @param containerID - Container ID for error display.
 * @param onError - Optional error callback.
 * @returns BootstrapResult indicating failure.
 */
function handleBootstrapError(
    title: string,
    message: ErrorContent,
    error: Error,
    containerID: string,
    onError?: (error: Error) => void,
): BootstrapResult {
    displayError(title, message, containerID);
    onError?.(error);
    return { success: false, error };
}

/**
 * Validates the canvas element and returns it.
 *
 * @param canvasID - Canvas element ID.
 * @param containerID - Container ID for error display.
 * @param onError - Optional error callback.
 * @returns Canvas element or null with error handling.
 */
function validateCanvas(
    canvasID: string,
    containerID: string,
    onError?: (error: Error) => void,
): { canvas: HTMLCanvasElement | null; result: BootstrapResult } {
    const canvas = getCanvas(canvasID);
    let result: BootstrapResult;

    if (canvas) {
        result = { success: true };
    } else {
        result = handleBootstrapError(
            'Canvas Error',
            CANVAS_NOT_FOUND_MESSAGE(canvasID),
            new Error(`Canvas element '${canvasID}' not found`),
            containerID,
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
 * @param containerID - Container ID for error display.
 * @param onSuccess - Optional success callback.
 * @param onError - Optional error callback.
 * @returns BootstrapResult with success status.
 */
async function initDemo(
    DemoClass: DemoConstructor,
    canvas: HTMLCanvasElement,
    containerID: string,
    onSuccess?: () => void,
    onError?: (error: Error) => void,
): Promise<BootstrapResult> {
    const demo = new DemoClass();

    if (typeof demo.update !== 'function' || typeof demo.render !== 'function') {
        return handleBootstrapError(
            'Demo Setup Error',
            'Your Demo class is missing update() or render(). Add both methods so the engine knows what to run each frame.',
            new Error('Demo class is missing update() or render()'),
            containerID,
            onError,
        );
    }

    let initialized: boolean;
    let initError: Error | undefined;

    try {
        initialized = await BTAPI.instance.init(demo, canvas);
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
            containerID,
            onError,
        );
    }

    return result;
}

// #endregion

// #region Bootstrap Function

/**
 * One-liner bootstrap function for Blit-Tech demos.
 * Handles canvas retrieval and engine initialization. Backend selection
 * (WebGPU or software fallback) is managed internally by BTAPI.
 *
 * This function provides a streamlined way to start a demo with sensible defaults
 * while allowing customization through options.
 *
 * @param DemoClass - Demo class constructor implementing `IBlitTechDemo` (optional `configure()` for hardware settings).
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
 *     canvasID: 'custom-canvas',
 *     containerID: 'custom-container',
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
        canvasID = DEFAULT_CANVAS_ID,
        containerID = DEFAULT_CONTAINER_ID,
        onSuccess,
        onError,
        isWaitingForDOMReady = true,
    } = options;

    let success: boolean;

    // Wait for DOM if needed.
    if (isWaitingForDOMReady) {
        await waitForDOM();
    }

    try {
        const { canvas, result: canvasResult } = validateCanvas(canvasID, containerID, onError);

        success = canvasResult.success;

        if (success && canvas) {
            canvas.tabIndex = 0;

            try {
                canvas.focus({ preventScroll: true });
            } catch {
                canvas.focus();
            }

            const initResult = await initDemo(DemoClass, canvas, containerID, onSuccess, onError);

            success = initResult.success;
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
            containerID,
            onError,
        );

        success = false;
    }

    return success;
}

// #endregion
