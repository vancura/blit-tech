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

/** Minimum Chrome/Edge major version that supports WebGPU. */
const MIN_CHROME_EDGE_VERSION = 113;

/** Minimum Safari major version that supports WebGPU. */
const MIN_SAFARI_VERSION = 18;

/** Download URL for Chrome. */
const DOWNLOAD_CHROME_URL = 'google.com/chrome';

/** Download URL for Firefox Nightly. */
const FIREFOX_NIGHTLY_URL = 'mozilla.org/firefox/channel/desktop/';

// #endregion

// #region Types

/**
 * Content that can be displayed in an error message.
 * Use string for plain text or object for text with code formatting.
 */
export type ErrorContent =
    | string
    | {
          text: string;
          code?: string;
      };

/**
 * Detected browser identity and major version.
 */
export interface BrowserInfo {
    /** Detected browser name. 'unknown' when the UA cannot be matched. */
    name: 'chrome' | 'edge' | 'firefox' | 'firefox-nightly' | 'safari' | 'unknown';

    /** Major version number, or 0 when the version cannot be parsed. */
    version: number;
}

// #endregion

// #region Internal Helpers

/**
 * Parses a major version number from a user-agent token like "Chrome/120.0.0.0".
 *
 * @param ua - Full user-agent string.
 * @param token - Token prefix to search for, e.g. "Chrome/".
 * @returns Major version number, or 0 if not found.
 */
function parseMajorVersion(ua: string, token: string): number {
    const idx = ua.indexOf(token);

    if (idx === -1) {
        return 0;
    }

    const version = parseInt(ua.slice(idx + token.length), 10);

    return Number.isNaN(version) ? 0 : version;
}

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
 * Detects the current browser from the navigator user-agent string.
 *
 * Detection order matters: Edge UAs also contain "Chrome", so Edge is checked first.
 * Firefox Nightly UAs contain both "Firefox" and "Nightly".
 * Safari UAs contain "Safari" and "Version" but not "Chrome" or "Edg".
 *
 * @returns Detected browser name and major version.
 *
 * @example
 * const { name, version } = detectBrowser();
 * // name: 'chrome', version: 120
 */
export function detectBrowser(): BrowserInfo {
    if (typeof navigator === 'undefined') {
        return { name: 'unknown', version: 0 };
    }

    const ua = navigator.userAgent;

    // Edge must be checked before Chrome — Edge UAs also contain "Chrome/".
    if (ua.includes('Edg/')) {
        return { name: 'edge', version: parseMajorVersion(ua, 'Edg/') };
    }

    if (ua.includes('Chrome/')) {
        return { name: 'chrome', version: parseMajorVersion(ua, 'Chrome/') };
    }

    // Firefox Nightly UAs contain "Nightly" in addition to "Firefox/".
    if (ua.includes('Firefox/')) {
        if (ua.includes('Nightly')) {
            return { name: 'firefox-nightly', version: parseMajorVersion(ua, 'Firefox/') };
        }

        return { name: 'firefox', version: parseMajorVersion(ua, 'Firefox/') };
    }

    // Safari UAs contain "Version/X" for the Safari release version.
    // Chrome/Edge also include "Safari/" so they must already be ruled out above.
    if (ua.includes('Safari/') && ua.includes('Version/')) {
        return { name: 'safari', version: parseMajorVersion(ua, 'Version/') };
    }

    return { name: 'unknown', version: 0 };
}

/**
 * Returns actionable, browser-specific instructions for enabling WebGPU.
 *
 * The message is plain text suitable for display in the error panel.
 *
 * @param browser - Detected browser from {@link detectBrowser}.
 * @returns Human-readable instructions string.
 *
 * @example
 * const info = detectBrowser();
 * const instructions = getWebGPUInstructions(info);
 * displayError('WebGPU Not Available', instructions);
 */
export function getWebGPUInstructions(browser: BrowserInfo): string {
    switch (browser.name) {
        case 'chrome':
            if (browser.version < MIN_CHROME_EDGE_VERSION) {
                return (
                    `Update Chrome to version ${MIN_CHROME_EDGE_VERSION} or later to use WebGPU.\n` +
                    `Download the latest version at ${DOWNLOAD_CHROME_URL}`
                );
            }

            return (
                'WebGPU may be disabled in the Chrome settings.\n' +
                'To enable it: visit chrome://flags in the address bar, search for WebGPU, ' +
                'and set it to Enabled. Then restart Chrome.'
            );

        case 'edge':
            if (browser.version < MIN_CHROME_EDGE_VERSION) {
                return `Update Microsoft Edge to version ${MIN_CHROME_EDGE_VERSION} or later to use WebGPU.`;
            }

            return (
                'WebGPU may be disabled in the Edge settings.\n' +
                'To enable it: visit edge://flags in the address bar, search for WebGPU, ' +
                'and set it to Enabled. Then restart Edge.'
            );

        case 'firefox-nightly':
            return (
                'Enable WebGPU in Firefox Nightly:\n' +
                '1. Type about:config in the address bar and press Enter.\n' +
                '2. Search for dom.webgpu.enabled.\n' +
                '3. Double-click the entry to set it to true.\n' +
                '4. Restart Firefox Nightly.'
            );

        case 'firefox':
            return (
                'WebGPU requires Firefox Nightly.\n' +
                `Download Firefox Nightly at ${FIREFOX_NIGHTLY_URL} ` +
                'then enable dom.webgpu.enabled in about:config.'
            );

        case 'safari':
            if (browser.version < MIN_SAFARI_VERSION) {
                return (
                    `Update Safari to version ${MIN_SAFARI_VERSION} or later to use WebGPU.\n` +
                    `Safari ${MIN_SAFARI_VERSION} requires macOS Sonoma 14.4 or later.`
                );
            }

            return (
                `WebGPU requires Safari ${MIN_SAFARI_VERSION}+ on macOS Sonoma 14.4 or later.\n` +
                'Check that hardware acceleration is enabled: Safari menu → Settings → Advanced → ' +
                'uncheck "Use hardware acceleration" and re-enable it.'
            );

        default:
            return (
                "WebGPU isn't available in this browser.\n" +
                `Supported browsers: Chrome ${MIN_CHROME_EDGE_VERSION}+, Microsoft Edge ${MIN_CHROME_EDGE_VERSION}+, ` +
                `Firefox Nightly (with dom.webgpu.enabled flag), Safari ${MIN_SAFARI_VERSION}+.`
            );
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
