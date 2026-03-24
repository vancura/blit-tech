/**
 * DOM utility helpers for Blit-Tech bootstrap.
 *
 * These utilities are independent of the engine and can be used directly
 * in demos or host pages for WebGPU detection and error display.
 */

// #region Constants

/** Default canvas element ID. */
export const DEFAULT_CANVAS_ID = 'blit-tech-canvas';

/** Default container element ID for error display. */
export const DEFAULT_CONTAINER_ID = 'canvas-container';

// #endregion

// #region Types

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

// #endregion

// #region Exported Helpers

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
            color: white;
            background: oklch(44.4% 0.177 26.899);
            box-shadow: 0 0 0 4px black inset;
            max-width: 600px;
            margin: 0 auto;
            font-family: monospace;
        `;

        const heading = document.createElement('h2');
        const msg = document.createElement('p');
        const consoleMsg = document.createElement('p');

        heading.style.cssText = 'margin-top: 0; font-size: 18px;';
        msg.style.cssText = 'margin: 20px 0; line-height: 1.6;';
        consoleMsg.style.cssText = 'margin-top: 20px; font-size: 12px; opacity: 0.66;';

        heading.textContent = title;

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
                    'font-family: monospace; font-size: 12px; ' +
                    'text-align: left; overflow-x: auto; white-space: pre-wrap; word-break: break-all;';

                codeBlock.textContent = content.code; // Safe - uses textContent

                msg.appendChild(codeBlock);
            }
        }

        consoleMsg.textContent = 'Check the browser console for more details.';

        errorDiv.appendChild(heading);
        errorDiv.appendChild(msg);
        errorDiv.appendChild(consoleMsg);

        // Clear existing children safely using DOM methods (avoids innerHTML).
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        container.appendChild(errorDiv);
    } else {
        // Fallback to console if container not found.
        const message = typeof content === 'string' ? content : `${content.text}\n${content.code ?? ''}`;

        console.error(`[BT] ${title}: ${message}`);
    }
}

/**
 * Retrieves a canvas element from the DOM by ID.
 * Validates that the element exists and is a canvas element.
 *
 * @param canvasId - ID of the canvas element. Default: 'blit-tech-canvas'
 * @returns The canvas element if found and valid, null otherwise.
 *
 * @example
 * const canvas = getCanvas('my-demo-canvas');
 * if (!canvas) {
 *     displayError('Canvas Error', 'Failed to find a canvas element.');
 *     return;
 * }
 */
export function getCanvas(canvasId: string = DEFAULT_CANVAS_ID): HTMLCanvasElement | null {
    const element = document.getElementById(canvasId);
    let canvas: HTMLCanvasElement | null = null;

    if (!element) {
        console.error(`[BT] Canvas element with id '${canvasId}' not found`);
    } else if (!(element instanceof HTMLCanvasElement)) {
        console.error(`[BT] Element with id '${canvasId}' is not a canvas element`);
    } else {
        canvas = element;
    }

    return canvas;
}

// #endregion
