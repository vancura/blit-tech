/**
 * Bootstrap Utilities for Blit-Tech
 *
 * Provides common initialization helpers for WebGPU games:
 * - WebGPU support detection
 * - Error display in DOM
 * - Canvas element retrieval
 * - One-liner game bootstrap
 */

import { BTAPI } from '../core/BTAPI';
import type { IBlitTechGame } from '../core/IBlitTechGame';

// #region Types

/**
 * Options for the bootstrap function.
 */
export interface BootstrapOptions {
    /**
     * Canvas element ID to use.
     * Default: 'game-canvas'
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
 * Constructor type for game classes.
 */
export type GameConstructor = new () => IBlitTechGame;

/**
 * Internal result type for bootstrap steps.
 */
interface BootstrapResult {
    success: boolean;
    error?: Error;
}

// #endregion

// #region Constants

/** Default canvas element ID. */
const DEFAULT_CANVAS_ID = 'game-canvas';

/** Default container element ID for error display. */
const DEFAULT_CONTAINER_ID = 'canvas-container';

// #endregion

// #region Error Messages

/** Error message for WebGPU not supported. */
const WEBGPU_NOT_SUPPORTED_MESSAGE =
    'Your browser does not support WebGPU.\n\n' +
    'Supported browsers:\n' +
    'Chrome/Edge 113+\n' +
    'Firefox Nightly (with the flag enabled)\n' +
    'Safari 18+\n\n' +
    'Please update your browser or try a different one.';

/** Error message for initialization failure. */
const INIT_FAILED_MESSAGE =
    'The game engine failed to initialize.\n\n' +
    'This usually means WebGPU could not access your GPU.\n' +
    'Check the console for detailed error messages.';

// #endregion

// #region Helper Functions

/**
 * Checks if WebGPU is supported in the current browser environment.
 * Tests for the presence of the navigator.gpu API.
 *
 * @returns True if WebGPU is available, false otherwise.
 *
 * @example
 * if (!checkWebGPUSupport()) {
 *     displayError('WebGPU Not Supported', 'Please use Chrome 113+');
 * }
 */
export function checkWebGPUSupport(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Content that can be displayed in an error message.
 * Use string for plain text, or object for text with code formatting.
 */
export type ErrorContent =
    | string
    | {
          text: string;
          code?: string;
      };

/**
 * Displays an error message in the page UI.
 * Replaces the container's content with a styled error box.
 *
 * SECURITY: This function renders content safely using textContent to prevent XSS attacks.
 * All text (including code) is treated as plain text, not interpreted as markup.
 *
 * @param title - Error heading text displayed prominently.
 * @param content - Error message content (string or object with optional code formatting).
 * @param containerId - ID of the container element. Default: 'canvas-container'
 *
 * @example
 * displayError(
 *     'Canvas Error',
 *     'Failed to find canvas element with id: ' + userProvidedId
 * );
 *
 * @example
 * displayError(
 *     'Initialization Error',
 *     { text: 'An error occurred:', code: error.message }
 * );
 */
export function displayError(title: string, content: ErrorContent, containerId: string = DEFAULT_CONTAINER_ID): void {
    const container = document.getElementById(containerId);

    if (container) {
        // Create error elements using DOM methods for safety.
        const errorDiv = document.createElement('div');

        errorDiv.style.cssText = `
            padding: 40px;
            text-align: center;
            color: #ff6b6b;
            background: #2a0000;
            border: 2px solid #ff0000;
            border-radius: 8px;
            max-width: 600px;
            margin: 0 auto;
        `;

        const heading = document.createElement('h2');
        const msg = document.createElement('p');
        const consoleMsg = document.createElement('p');

        heading.style.cssText = 'margin-top: 0; font-size: 24px;';
        msg.style.cssText = 'margin: 20px 0; line-height: 1.6; white-space: pre-line;';
        consoleMsg.style.cssText = 'margin-top: 20px; font-size: 14px; opacity: 0.8;';

        heading.textContent = `[X] ${title}`;

        // Handle content - either plain string or object with code formatting.
        if (typeof content === 'string') {
            msg.textContent = content; // Plain text rendering
        } else {
            msg.textContent = content.text; // Plain text rendering

            if (content.code) {
                // Add code block using DOM for safety.
                const codeBlock = document.createElement('code');

                codeBlock.style.cssText =
                    'display: block; margin-top: 10px; padding: 10px; ' +
                    'background: #1a0000; border: 1px solid #ff0000; ' +
                    'border-radius: 4px; font-family: monospace; font-size: 12px; ' +
                    'text-align: left; overflow-x: auto; white-space: pre-wrap; word-break: break-all;';

                codeBlock.textContent = content.code; // Safe - uses textContent

                msg.appendChild(codeBlock);
            }
        }

        consoleMsg.textContent = 'Check the browser console for more details.';

        errorDiv.appendChild(heading);
        errorDiv.appendChild(msg);
        errorDiv.appendChild(consoleMsg);

        container.innerHTML = '';
        container.appendChild(errorDiv);
    } else {
        // Fallback to console if container not found.
        const message = typeof content === 'string' ? content : `${content.text}\n${content.code ?? ''}`;

        console.error(`[Blit-Tech] ${title}: ${message}`);
    }
}

/**
 * Retrieves a canvas element from the DOM by ID.
 * Validates that the element exists and is a canvas element.
 *
 * @param canvasId - ID of the canvas element. Default: 'game-canvas'
 * @returns The canvas element if found and valid, null otherwise.
 *
 * @example
 * const canvas = getCanvas('my-game-canvas');
 * if (!canvas) {
 *     displayError('Canvas Error', 'Failed to find a canvas element.');
 *     return;
 * }
 */
export function getCanvas(canvasId: string = DEFAULT_CANVAS_ID): HTMLCanvasElement | null {
    const element = document.getElementById(canvasId);
    let canvas: HTMLCanvasElement | null = null;

    if (!element) {
        console.error(`[Blit-Tech] Canvas element with id '${canvasId}' not found`);
    } else if (!(element instanceof HTMLCanvasElement)) {
        console.error(`[Blit-Tech] Element with id '${canvasId}' is not a canvas element`);
    } else {
        canvas = element;
    }

    return canvas;
}

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
                'Make sure your HTML includes a canvas element with the correct ID.',
            new Error(`Canvas element '${canvasId}' not found`),
            containerId,
            onError,
        );
    }

    return { canvas, result };
}

/**
 * Initializes the game engine with the provided game and canvas.
 *
 * @param GameClass - Game class constructor.
 * @param canvas - Canvas element.
 * @param containerId - Container ID for error display.
 * @param onSuccess - Optional success callback.
 * @param onError - Optional error callback.
 * @returns BootstrapResult with success status.
 */
async function initializeGame(
    GameClass: GameConstructor,
    canvas: HTMLCanvasElement,
    containerId: string,
    onSuccess?: () => void,
    onError?: (error: Error) => void,
): Promise<BootstrapResult> {
    const game = new GameClass();
    const initialized = await BTAPI.instance.initialize(game, canvas);
    let result: BootstrapResult;

    if (initialized) {
        console.log('[Blit-Tech] Game started successfully!');
        onSuccess?.();
        result = { success: true };
    } else {
        result = handleBootstrapError(
            'Initialization Failed',
            INIT_FAILED_MESSAGE,
            new Error('Engine initialization failed'),
            containerId,
            onError,
        );
    }

    return result;
}

// #endregion

// #region Bootstrap Function

/**
 * One-liner bootstrap function for Blit-Tech games.
 * Handles WebGPU detection, canvas retrieval, and engine initialization.
 *
 * This function provides a streamlined way to start a game with sensible defaults
 * while allowing customization through options.
 *
 * @param GameClass - Game class constructor implementing IBlitTechGame.
 * @param options - Optional configuration for IDs and callbacks.
 * @returns Promise resolving to true if initialization succeeded, false otherwise.
 *
 * @example
 * // Simplest usage - uses default IDs.
 * bootstrap(MyGame);
 *
 * @example
 * // With custom options.
 * bootstrap(MyGame, {
 *     canvasId: 'custom-canvas',
 *     containerId: 'custom-container',
 *     onSuccess: () => console.log('Game started!'),
 *     onError: (err) => analytics.trackError(err),
 * });
 *
 * @example
 * // Await the result.
 * const success = await bootstrap(MyGame);
 * if (success) {
 *     console.log('Game is running');
 * }
 */
export async function bootstrap(GameClass: GameConstructor, options: BootstrapOptions = {}): Promise<boolean> {
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

            // Initialize the game.
            if (success && canvas) {
                const initResult = await initializeGame(GameClass, canvas, containerId, onSuccess, onError);
                success = initResult.success;
            }
        }
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[Blit-Tech] Bootstrap error:', error);

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
