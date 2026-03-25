// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    checkWebGPUSupport,
    DEFAULT_CANVAS_ID,
    DEFAULT_CONTAINER_ID,
    displayError,
    getCanvas,
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

        it('should return null when the element is not a canvas', () => {
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

        it('should render object content without code block when code is omitted', () => {
            displayError('Error Title', { text: 'An error occurred' });
            const container = document.getElementById(DEFAULT_CONTAINER_ID);
            expect(container?.querySelector('code')).toBeNull();
        });

        it('should fall back to console.error when container is not found', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            displayError('Error', 'Message', 'nonexistent-container-id');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    // #endregion
});
