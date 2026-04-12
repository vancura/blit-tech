// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    checkWebGPUSupport,
    DEFAULT_CANVAS_ID,
    DEFAULT_CONTAINER_ID,
    detectBrowser,
    displayError,
    getCanvas,
    getWebGPUInstructions,
} from './BootstrapHelpers';

// #region Constants

describe('BootstrapHelpers', () => {
    describe('Constants', () => {
        it('should have DEFAULT_CANVAS_ID equal to blit-tech-canvas', () => {
            expect(DEFAULT_CANVAS_ID).toBe('blit-tech-canvas');
        });

        it('should have DEFAULT_CONTAINER_ID equal to canvas-container', () => {
            expect(DEFAULT_CONTAINER_ID).toBe('canvas-container');
        });
    });

    // #endregion

    // #region checkWebGPUSupport

    describe('checkWebGPUSupport', () => {
        it('should return false when navigator.gpu is absent', () => {
            expect(checkWebGPUSupport()).toBe(false);
        });

        it('should return true when navigator.gpu is present', () => {
            const nav = navigator as unknown as { gpu?: unknown };
            nav.gpu = {};

            try {
                expect(checkWebGPUSupport()).toBe(true);
            } finally {
                delete nav.gpu;
            }
        });
    });

    // #endregion

    // #region getCanvas

    describe('getCanvas', () => {
        it('should return null for a missing element', () => {
            const result = getCanvas('nonexistent-canvas-id');
            expect(result).toBeNull();
        });

        it('should return the canvas element for a valid canvas', () => {
            const canvas = document.createElement('canvas');
            canvas.id = DEFAULT_CANVAS_ID;
            document.body.appendChild(canvas);

            try {
                const result = getCanvas(DEFAULT_CANVAS_ID);
                expect(result).toBe(canvas);
                expect(result).toBeInstanceOf(HTMLCanvasElement);
            } finally {
                document.body.removeChild(canvas);
            }
        });

        it("should return null when the element isn't a canvas", () => {
            const div = document.createElement('div');
            div.id = DEFAULT_CANVAS_ID;
            document.body.appendChild(div);

            try {
                const result = getCanvas(DEFAULT_CANVAS_ID);
                expect(result).toBeNull();
            } finally {
                document.body.removeChild(div);
            }
        });
    });

    // #endregion

    // #region displayError

    describe('displayError', () => {
        beforeEach(() => {
            const container = document.createElement('div');
            container.id = DEFAULT_CONTAINER_ID;
            document.body.appendChild(container);
        });

        afterEach(() => {
            const container = document.getElementById(DEFAULT_CONTAINER_ID);

            if (container) {
                document.body.removeChild(container);
            }
        });

        it('should render title and string message in the container', () => {
            displayError('Test Error', 'Something went wrong');
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            expect(container?.querySelector('h2')?.textContent).toBe('Test Error');
            expect(container?.querySelector('p')?.textContent).toBe('Something went wrong');
        });

        it('should render object content with text and code block', () => {
            displayError('Error Title', { text: 'An error occurred', code: 'stack trace here' });
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            expect(container?.querySelector('h2')?.textContent).toBe('Error Title');
            expect(container?.querySelector('code')?.textContent).toBe('stack trace here');
        });

        it('should render object content without a code block when code is omitted', () => {
            displayError('Error Title', { text: 'An error occurred' });
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            expect(container?.querySelector('code')).toBeNull();
        });

        it("should fall back to console.error when the container isn't found", () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            displayError('Error', 'Message', 'nonexistent-container-id');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    // #endregion

    // #region detectBrowser

    describe('detectBrowser', () => {
        function withUA(ua: string, fn: () => void): void {
            const original = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });

            try {
                fn();
            } finally {
                Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
            }
        }

        it('should detect Chrome', () => {
            withUA(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                () => {
                    const result = detectBrowser();
                    expect(result.name).toBe('chrome');
                    expect(result.version).toBe(120);
                },
            );
        });

        it('should detect Edge (Chromium)', () => {
            withUA(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/113.0.0.0',
                () => {
                    const result = detectBrowser();
                    expect(result.name).toBe('edge');
                    expect(result.version).toBe(113);
                },
            );
        });

        it('should detect Firefox stable', () => {
            withUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0', () => {
                const result = detectBrowser();
                expect(result.name).toBe('firefox');
                expect(result.version).toBe(130);
            });
        });

        it('should detect Firefox Nightly', () => {
            withUA(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0 Nightly/20241201',
                () => {
                    const result = detectBrowser();
                    expect(result.name).toBe('firefox-nightly');
                    expect(result.version).toBe(134);
                },
            );
        });

        it('should detect Safari', () => {
            withUA(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
                () => {
                    const result = detectBrowser();
                    expect(result.name).toBe('safari');
                    expect(result.version).toBe(18);
                },
            );
        });

        it('should return unknown for an unrecognized user agent', () => {
            withUA('Mozilla/5.0 (compatible; SomeUnknownBrowser/1.0)', () => {
                const result = detectBrowser();
                expect(result.name).toBe('unknown');
                expect(result.version).toBe(0);
            });
        });
    });

    // #endregion

    // #region getWebGPUInstructions

    describe('getWebGPUInstructions', () => {
        it('should advise updating Chrome when the version is below 113', () => {
            const msg = getWebGPUInstructions({ name: 'chrome', version: 112 });
            expect(msg).toContain('Update Chrome');
        });

        it('should point Chrome 113+ users to chrome://flags', () => {
            const msg = getWebGPUInstructions({ name: 'chrome', version: 113 });
            expect(msg).toContain('chrome://flags');
        });

        it('should advise updating Edge when the version is below 113', () => {
            const msg = getWebGPUInstructions({ name: 'edge', version: 110 });
            expect(msg).toContain('Update Microsoft Edge');
        });

        it('should point Edge 113+ users to edge://flags', () => {
            const msg = getWebGPUInstructions({ name: 'edge', version: 113 });
            expect(msg).toContain('edge://flags');
        });

        it('should tell Firefox Nightly users to use about:config', () => {
            const msg = getWebGPUInstructions({ name: 'firefox-nightly', version: 134 });
            expect(msg).toContain('about:config');
        });

        it('should tell Firefox stable users to download Nightly', () => {
            const msg = getWebGPUInstructions({ name: 'firefox', version: 130 });
            expect(msg).toContain('Firefox Nightly');
        });

        it('should advise updating Safari when the version is below 18', () => {
            const msg = getWebGPUInstructions({ name: 'safari', version: 17 });
            expect(msg).toContain('Update Safari');
        });

        it('should advise enabling WebGPU via Feature Flags for Safari 18-25', () => {
            const msg = getWebGPUInstructions({ name: 'safari', version: 18 });
            expect(msg).toContain('Feature Flags');
            expect(msg).toContain('Develop');
        });

        it('should mention macOS Tahoe 26 as the upgrade target for Safari 18-25', () => {
            const msg = getWebGPUInstructions({ name: 'safari', version: 25 });
            expect(msg).toContain('Tahoe 26');
        });

        it('should say WebGPU is enabled by default for Safari 26+', () => {
            const msg = getWebGPUInstructions({ name: 'safari', version: 26 });
            expect(msg).toContain('enabled by default');
            expect(msg).toContain('Feature Flags');
        });

        it('should list supported browsers for an unknown browser', () => {
            const msg = getWebGPUInstructions({ name: 'unknown', version: 0 });
            expect(msg).toContain('Chrome 113');
        });
    });

    // #endregion
});
