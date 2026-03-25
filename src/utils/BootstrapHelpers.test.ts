// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { checkWebGPUSupport, DEFAULT_CANVAS_ID, DEFAULT_CONTAINER_ID, getCanvas } from './BootstrapHelpers';

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
            (navigator as any).gpu = {};

            try {
                expect(checkWebGPUSupport()).toBe(true);
            } finally {
                delete (navigator as any).gpu;
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
});
