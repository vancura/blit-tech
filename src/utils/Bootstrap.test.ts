// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BTAPI } from '../core/BTAPI';
import { bootstrap } from './Bootstrap';
import { DEFAULT_CANVAS_ID, DEFAULT_CONTAINER_ID } from './BootstrapHelpers';
import { Vector2i } from './Vector2i';

// #region Test Demo

class MockDemo {
    queryHardware() {
        return { displaySize: new Vector2i(320, 240), targetFPS: 60 };
    }

    async initialize() {
        return true;
    }

    update() {}
    render() {}
}

// #endregion

// #region Helpers

function setupDOM(): { canvas: HTMLCanvasElement; container: HTMLDivElement } {
    const container = document.createElement('div');
    container.id = DEFAULT_CONTAINER_ID;
    document.body.appendChild(container);

    const canvas = document.createElement('canvas');
    canvas.id = DEFAULT_CANVAS_ID;
    document.body.appendChild(canvas);

    return { canvas, container };
}

function teardownDOM(): void {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
}

function stubWebGPU(): void {
    const nav = navigator as unknown as Record<string, unknown>;
    nav.gpu = {};
}

function unstubWebGPU(): void {
    const nav = navigator as unknown as Record<string, unknown>;
    delete nav.gpu;
}

// #endregion

describe('bootstrap', () => {
    beforeEach(() => {
        vi.spyOn(BTAPI.instance, 'initialize').mockResolvedValue(true);
        Object.defineProperty(document, 'readyState', { value: 'complete', writable: true, configurable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        unstubWebGPU();
        teardownDOM();
    });

    // #region waitForDOMReady

    describe('waitForDOMReady', () => {
        it('should skip DOM waiting when waitForDOMReady is false', async () => {
            setupDOM();
            stubWebGPU();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false });
            expect(result).toBe(true);
        });

        it('should resolve after DOMContentLoaded when readyState is loading', async () => {
            Object.defineProperty(document, 'readyState', { value: 'loading', writable: true, configurable: true });
            setupDOM();
            stubWebGPU();

            const bootstrapPromise = bootstrap(MockDemo, { waitForDOMReady: true });

            Object.defineProperty(document, 'readyState', { value: 'complete', writable: true, configurable: true });
            document.dispatchEvent(new Event('DOMContentLoaded'));

            const result = await bootstrapPromise;
            expect(result).toBe(true);
        });

        it('should proceed immediately when readyState is complete', async () => {
            setupDOM();
            stubWebGPU();
            const result = await bootstrap(MockDemo, { waitForDOMReady: true });
            expect(result).toBe(true);
        });
    });

    // #endregion

    // #region WebGPU validation

    describe('WebGPU validation', () => {
        it('should return false and call onError when WebGPU is not supported', async () => {
            setupDOM();
            // No navigator.gpu installed.
            const onError = vi.fn();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false, onError });
            expect(result).toBe(false);
            expect(onError).toHaveBeenCalledOnce();
        });
    });

    // #endregion

    // #region Canvas validation

    describe('canvas validation', () => {
        it('should return false and call onError when canvas is not found', async () => {
            stubWebGPU();
            // No canvas in DOM — only the container.
            const container = document.createElement('div');
            container.id = DEFAULT_CONTAINER_ID;
            document.body.appendChild(container);

            const onError = vi.fn();
            const result = await bootstrap(MockDemo, {
                waitForDOMReady: false,
                canvasId: 'nonexistent-canvas',
                onError,
            });
            expect(result).toBe(false);
            expect(onError).toHaveBeenCalledOnce();
        });
    });

    // #endregion

    // #region Engine initialization

    describe('engine initialization', () => {
        it('should return false and call onError when BTAPI.initialize returns false', async () => {
            setupDOM();
            stubWebGPU();
            vi.spyOn(BTAPI.instance, 'initialize').mockResolvedValue(false);

            const onError = vi.fn();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false, onError });
            expect(result).toBe(false);
            expect(onError).toHaveBeenCalledOnce();
        });

        it('should return false and call onError when BTAPI.initialize throws', async () => {
            setupDOM();
            stubWebGPU();
            vi.spyOn(BTAPI.instance, 'initialize').mockRejectedValue(new Error('Init exploded'));

            const onError = vi.fn();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false, onError });
            expect(result).toBe(false);
            expect(onError).toHaveBeenCalledOnce();
        });

        it('should return true and call onSuccess on successful initialization', async () => {
            setupDOM();
            stubWebGPU();

            const onSuccess = vi.fn();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false, onSuccess });
            expect(result).toBe(true);
            expect(onSuccess).toHaveBeenCalledOnce();
        });

        it('should use default canvas and container IDs when not specified', async () => {
            setupDOM();
            stubWebGPU();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false });
            expect(result).toBe(true);
        });

        it('should use custom canvas and container IDs when specified', async () => {
            const container = document.createElement('div');
            container.id = 'custom-container';
            document.body.appendChild(container);

            const canvas = document.createElement('canvas');
            canvas.id = 'custom-canvas';
            document.body.appendChild(canvas);

            stubWebGPU();
            const result = await bootstrap(MockDemo, {
                waitForDOMReady: false,
                canvasId: 'custom-canvas',
                containerId: 'custom-container',
            });
            expect(result).toBe(true);
        });
    });

    // #endregion

    // #region Unexpected errors

    describe('unexpected errors', () => {
        it('should return false when BTAPI.initialize throws synchronously', async () => {
            setupDOM();
            stubWebGPU();

            vi.spyOn(BTAPI.instance, 'initialize').mockImplementation(() => {
                throw new Error('Synchronous throw from initialize');
            });

            const onError = vi.fn();
            const result = await bootstrap(MockDemo, { waitForDOMReady: false, onError });
            expect(result).toBe(false);
            expect(onError).toHaveBeenCalledOnce();
        });
    });

    // #endregion
});
