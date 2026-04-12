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

/** Minimum Safari major version where WebGPU is available (behind Feature Flags on 18-25, default on 26+). */
const MIN_SAFARI_VERSION = 18;

/** Minimum Safari major version where WebGPU is enabled by default. */
const MIN_SAFARI_DEFAULT_VERSION = 26;

/** Minimum Firefox major version that ships WebGPU enabled by default on Windows. */
const MIN_FIREFOX_VERSION = 141;

/** Download URL for Chrome. */
const DOWNLOAD_CHROME_URL = 'https://www.google.com/chrome';

/** Download URL for Firefox Nightly. */
const FIREFOX_NIGHTLY_URL = 'https://www.mozilla.org/firefox/channel/desktop/';

// #endregion

// #region Module State

/** Stored keydown handler for previewWebGPUErrors, used to remove the previous listener on re-entry. */
let previewKeyHandler: ((e: KeyboardEvent) => void) | null = null;

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
 * Appends text to an element, converting newline characters to `<br>` elements.
 * Safe against XSS: all text is inserted via createTextNode, never innerHTML.
 *
 * @param element - Target element to append into.
 * @param text - Plain text, optionally containing newline characters.
 */
function appendTextWithLineBreaks(element: HTMLElement, text: string): void {
    const lines = text.split('\n');

    lines.forEach((line, index) => {
        element.appendChild(document.createTextNode(line));

        if (index < lines.length - 1) {
            element.appendChild(document.createElement('br'));
        }
    });
}

/**
 * Displays an error message in the page UI.
 * Replaces the container's content with a styled error box.
 *
 * SECURITY: This function renders content safely using createTextNode to prevent XSS attacks.
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
            max-width: 640px;
            margin: 0 auto;
            font-family: monospace;
        `;

        const heading = document.createElement('h2');
        const msg = document.createElement('p');

        heading.style.cssText = 'margin: 0 0 28px; font-size: 18px;';
        msg.style.cssText = 'margin: 0; line-height: 1.8; text-align: left; white-space: pre-wrap;';

        heading.textContent = title;

        // Handle content - either plain string or object with code formatting.
        // appendTextWithLineBreaks is used instead of textContent so that \n produces
        // visible line breaks, making numbered step lists readable in the error panel.
        if (typeof content === 'string') {
            appendTextWithLineBreaks(msg, content);
        } else {
            appendTextWithLineBreaks(msg, content.text);

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

        errorDiv.appendChild(heading);
        errorDiv.appendChild(msg);

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

    const ua = typeof navigator.userAgent === 'string' ? navigator.userAgent : '';

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
                'WebGPU is supported in this version of Chrome but is not available.\n\n' +
                '1. Check that hardware acceleration is on: open chrome://settings/system in the address bar ' +
                'and confirm "Use graphics acceleration when available" is enabled, then relaunch Chrome.\n' +
                '2. Make sure the page is served over https or http://localhost, not plain http.\n' +
                '3. If your GPU is blocklisted, open chrome://flags/#enable-unsafe-webgpu, ' +
                'set "Unsafe WebGPU Support" to Enabled, and relaunch Chrome.'
            );

        case 'edge':
            if (browser.version < MIN_CHROME_EDGE_VERSION) {
                return `Update Microsoft Edge to version ${MIN_CHROME_EDGE_VERSION} or later to use WebGPU.`;
            }

            return (
                'WebGPU is supported in this version of Edge but is not available.\n\n' +
                '1. Check that hardware acceleration is on: open edge://settings/system in the address bar ' +
                'and confirm "Use hardware acceleration when available" is enabled, then relaunch Edge.\n' +
                '2. Make sure the page is served over https or http://localhost, not plain http.\n' +
                '3. If your GPU is blocklisted, open edge://flags/#enable-unsafe-webgpu, ' +
                'set "Unsafe WebGPU Support" to Enabled, and relaunch Edge.'
            );

        case 'firefox-nightly':
            return (
                'Enable WebGPU in Firefox Nightly:\n\n' +
                '1. Type about:config in the address bar and press Enter.\n' +
                '2. Accept the risk warning to proceed.\n' +
                '3. Search for dom.webgpu.enabled.\n' +
                '4. Double-click the entry to set it to true.\n' +
                '5. Restart Firefox Nightly.'
            );

        case 'firefox':
            if (browser.version >= MIN_FIREFOX_VERSION) {
                return (
                    'WebGPU support in Firefox depends on your operating system:\n\n' +
                    `- Windows: enabled by default in Firefox ${MIN_FIREFOX_VERSION}+.\n` +
                    '- Mac (Apple Silicon): enabled by default in Firefox 145+ on macOS 26, ' +
                    'or Firefox 147+ on all macOS versions.\n' +
                    '- Linux and Android: available in Firefox Nightly only, ' +
                    'not yet in stable.\n\n' +
                    'If you are on a supported OS and WebGPU is still unavailable, ' +
                    'open about:config, confirm dom.webgpu.enabled is set to true, ' +
                    'and restart Firefox.'
                );
            }

            return (
                'WebGPU is not yet available in this version of Firefox.\n' +
                `Update to Firefox ${MIN_FIREFOX_VERSION} or later (Windows), or download Firefox Nightly ` +
                `at ${FIREFOX_NIGHTLY_URL} and enable dom.webgpu.enabled in about:config.`
            );

        case 'safari':
            if (browser.version < MIN_SAFARI_VERSION) {
                return (
                    `Update Safari to version ${MIN_SAFARI_VERSION} or later to use WebGPU. ` +
                    `Safari ${MIN_SAFARI_VERSION}–${MIN_SAFARI_DEFAULT_VERSION - 1} supports WebGPU via Feature Flags; ` +
                    `Safari ${MIN_SAFARI_DEFAULT_VERSION}+ (macOS Tahoe 26) has it enabled by default.`
                );
            }

            if (browser.version < MIN_SAFARI_DEFAULT_VERSION) {
                return (
                    `Safari ${MIN_SAFARI_VERSION}-${MIN_SAFARI_DEFAULT_VERSION - 1} supports WebGPU but it must be enabled manually. ` +
                    'To enable WebGPU in Safari:\n\n' +
                    '1. Open Safari Settings (Command + Comma) and go to the Advanced tab.\n' +
                    '2. Check "Show features for web developers" to enable the Develop menu.\n' +
                    '3. From the menu bar, choose Develop > Feature Flags.\n' +
                    '4. Search for "WebGPU" and enable it.\n' +
                    '5. Restart Safari.\n\n' +
                    `Alternatively, update to Safari ${MIN_SAFARI_DEFAULT_VERSION} (macOS Tahoe 26) where WebGPU is on by default.`
                );
            }

            return (
                `WebGPU is enabled by default in Safari ${MIN_SAFARI_DEFAULT_VERSION} but appears to be unavailable. ` +
                'If you disabled it via Feature Flags, re-enable it:\n\n' +
                '1. Open Safari Settings (Command + Comma) and go to the Advanced tab.\n' +
                '2. Check "Show features for web developers" to enable the Develop menu.\n' +
                '3. From the menu bar, choose Develop > Feature Flags.\n' +
                '4. Search for "WebGPU" and enable it.\n' +
                '5. Restart Safari.'
            );

        default:
            return (
                `Supported browsers: Chrome ${MIN_CHROME_EDGE_VERSION}+, Microsoft Edge ${MIN_CHROME_EDGE_VERSION}+, ` +
                `Firefox ${MIN_FIREFOX_VERSION}+ (Windows / Mac 145+) or Firefox Nightly, Safari ${MIN_SAFARI_DEFAULT_VERSION}+.`
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

// #region Dev Utilities

/**
 * Preview entry describing a single error variant.
 */
interface ErrorPreviewEntry {
    /** Short human-readable label shown in the navigation bar. */
    readonly label: string;

    /** Error panel heading. */
    readonly title: string;

    /** Error panel body content. */
    readonly content: ErrorContent;
}

/**
 * Returns all distinct error message variants used by the engine.
 * Covers every browser/version branch of {@link getWebGPUInstructions} plus the
 * three non-WebGPU error types (canvas, initialization, unexpected).
 *
 * @returns Array of preview entries, one per error variant.
 */
function buildErrorPreviewEntries(): ReadonlyArray<ErrorPreviewEntry> {
    return [
        // WebGPU not supported — Chrome
        {
            label: 'Chrome, outdated (< 113)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'chrome', version: 100 }),
        },
        {
            label: 'Chrome, current (>= 113)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'chrome', version: 130 }),
        },

        // WebGPU not supported — Edge
        {
            label: 'Edge, outdated (< 113)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'edge', version: 100 }),
        },
        {
            label: 'Edge, current (>= 113)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'edge', version: 130 }),
        },

        // WebGPU not supported — Firefox
        {
            label: 'Firefox Nightly',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'firefox-nightly', version: 130 }),
        },
        {
            label: 'Firefox stable, outdated (< 141)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'firefox', version: 130 }),
        },
        {
            label: 'Firefox stable, current (>= 141)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'firefox', version: 141 }),
        },

        // WebGPU not supported — Safari
        {
            label: 'Safari, outdated (< 18)',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'safari', version: 17 }),
        },
        {
            label: 'Safari 18-25, Feature Flags required',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'safari', version: 18 }),
        },
        {
            label: 'Safari 26+, enabled by default',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'safari', version: 26 }),
        },

        // WebGPU not supported — unknown browser
        {
            label: 'Unknown browser',
            title: 'WebGPU Not Supported',
            content: getWebGPUInstructions({ name: 'unknown', version: 0 }),
        },

        // Non-WebGPU errors
        {
            label: 'Canvas element not found',
            title: 'Canvas Error',
            content:
                "Failed to find the canvas element with the id 'blit-tech-canvas'.\n\n" +
                'Make sure the HTML includes a canvas element with the correct ID.',
        },
        {
            label: 'Initialization failed (with error)',
            title: 'Initialization Failed',
            content: {
                text: 'The engine failed to initialize. Check the console for details.',
                code: "TypeError: Cannot read properties of undefined (reading 'requestDevice')",
            },
        },
        {
            label: 'Unexpected error during bootstrap',
            title: 'Unexpected Error',
            content: {
                text: 'An unexpected error occurred during initialization:',
                code: 'RangeError: Maximum call stack size exceeded',
            },
        },
    ];
}

/**
 * Cycles through every error message variant for visual testing.
 *
 * Renders each variant in the error container with Prev/Next navigation buttons.
 * Arrow keys also cycle through variants once the function has been called.
 *
 * Intended for **development use only**. Do not call this in production demos.
 *
 * @param containerId - Container element ID. Default: 'canvas-container'
 *
 * @example
 * // Call once during development to inspect all error layouts:
 * import { previewWebGPUErrors } from 'blit-tech';
 * previewWebGPUErrors();
 */
export function previewWebGPUErrors(containerId: string = DEFAULT_CONTAINER_ID): void {
    const entries = buildErrorPreviewEntries();
    let current = 0;

    const show = (index: number): void => {
        current = index;

        // eslint-disable-next-line security/detect-object-injection
        const entry = entries[index];

        if (!entry) {
            return;
        }

        displayError(entry.title, entry.content, containerId);

        const container = document.getElementById(containerId);

        if (!container) {
            return;
        }

        // Navigation bar appended below the error box.
        const nav = document.createElement('div');

        nav.style.cssText =
            'display: flex; align-items: center; justify-content: center; gap: 16px; ' +
            'margin-top: 12px; font-family: monospace; font-size: 12px; color: #aaa;';

        const prevBtn = document.createElement('button');

        prevBtn.textContent = '<< Prev';
        prevBtn.style.cssText = 'padding: 4px 12px; font-family: monospace; cursor: pointer;';
        prevBtn.addEventListener('click', () => {
            show((current - 1 + entries.length) % entries.length);
        });

        const counter = document.createElement('span');

        counter.textContent = `${index + 1} / ${entries.length}  —  ${entry.label}`;

        const nextBtn = document.createElement('button');

        nextBtn.textContent = 'Next >>';
        nextBtn.style.cssText = 'padding: 4px 12px; font-family: monospace; cursor: pointer;';
        nextBtn.addEventListener('click', () => {
            show((current + 1) % entries.length);
        });

        nav.appendChild(prevBtn);
        nav.appendChild(counter);
        nav.appendChild(nextBtn);
        container.appendChild(nav);
    };

    // Arrow-key navigation. Remove any previously registered handler first so
    // repeated calls don't stack multiple listeners.
    if (previewKeyHandler) {
        document.removeEventListener('keydown', previewKeyHandler);
    }

    previewKeyHandler = (e: KeyboardEvent): void => {
        if (e.key === 'ArrowLeft') {
            show((current - 1 + entries.length) % entries.length);
        } else if (e.key === 'ArrowRight') {
            show((current + 1) % entries.length);
        }
    };

    document.addEventListener('keydown', previewKeyHandler);

    show(current);
}

// #endregion
