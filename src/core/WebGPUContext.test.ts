/**
 * Unit tests for {@link initializeWebGPU}.
 *
 * Covers the WebGPU bootstrap path used during engine initialization:
 * - graceful failure when WebGPU support, adapters, devices, or canvas context
 *   creation are unavailable
 * - successful device/context initialization with mocked GPU objects
 * - canvas pixel sizing and optional CSS display sizing
 *
 * Browser GPU capabilities are simulated with the local WebGPU mock helpers so
 * the suite can validate setup logic deterministically.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
    createMockGPUCanvasContext,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import { Vector2i } from '../utils/Vector2i';
import { initializeWebGPU } from './WebGPUContext';

// #region Helpers

function createMockCanvas(webgpuContext: unknown = createMockGPUCanvasContext()): HTMLCanvasElement {
    return {
        width: 0,
        height: 0,
        style: { width: '', height: '' },
        getContext: (type: string) => (type === 'webgpu' ? webgpuContext : null),
    } as unknown as HTMLCanvasElement;
}

// #endregion

describe('initializeWebGPU', () => {
    const displaySize = new Vector2i(320, 240);

    afterEach(() => {
        uninstallMockNavigatorGPU();
    });

    // #region No WebGPU support

    it('should return null when navigator.gpu is absent', async () => {
        // Use Object.defineProperty to install a navigator without .gpu — direct
        // property deletion throws in Node.js when navigator is null/non-writable.
        Object.defineProperty(globalThis, 'navigator', {
            value: { userAgent: 'test' },
            writable: true,
            configurable: true,
        });

        const canvas = createMockCanvas();
        const result = await initializeWebGPU(canvas, displaySize);

        expect(result).toBeNull();
    });

    // #endregion

    // #region Adapter failures

    it('should return null when requestAdapter returns null', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                gpu: {
                    requestAdapter: async () => null,
                    getPreferredCanvasFormat: () => 'bgra8unorm' as GPUTextureFormat,
                },
                userAgent: 'test',
            },
            writable: true,
            configurable: true,
        });

        const canvas = createMockCanvas();
        const result = await initializeWebGPU(canvas, displaySize);

        expect(result).toBeNull();
    });

    it('should return null when requestDevice throws', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                gpu: {
                    requestAdapter: async () => ({
                        requestDevice: async () => {
                            throw new Error('GPU device error');
                        },
                    }),
                    getPreferredCanvasFormat: () => 'bgra8unorm' as GPUTextureFormat,
                },
                userAgent: 'test',
            },
            writable: true,
            configurable: true,
        });

        const canvas = createMockCanvas();
        const result = await initializeWebGPU(canvas, displaySize);

        expect(result).toBeNull();
    });

    // #endregion

    // #region Context failures

    it('should return null when canvas.getContext returns null', async () => {
        installMockNavigatorGPU();

        const canvas = createMockCanvas(null);
        const result = await initializeWebGPU(canvas, displaySize);

        expect(result).toBeNull();
    });

    // #endregion

    // #region Success paths

    it('should return device and context on success', async () => {
        installMockNavigatorGPU();

        const canvas = createMockCanvas();

        const result = await initializeWebGPU(canvas, displaySize);

        expect(result).not.toBeNull();
        expect(result?.device).toBeDefined();
        expect(result?.context).toBeDefined();
    });

    it('should set canvas resolution from displaySize', async () => {
        installMockNavigatorGPU();

        const canvas = createMockCanvas();

        await initializeWebGPU(canvas, displaySize);

        expect(canvas.width).toBe(320);
        expect(canvas.height).toBe(240);
    });

    it('should set CSS size when canvasDisplaySize is provided', async () => {
        installMockNavigatorGPU();

        const canvas = createMockCanvas();
        const canvasDisplaySize = new Vector2i(640, 480);

        await initializeWebGPU(canvas, displaySize, canvasDisplaySize);

        expect(canvas.style.width).toBe('640px');
        expect(canvas.style.height).toBe('480px');
    });

    it('should not set CSS size when canvasDisplaySize is not provided', async () => {
        installMockNavigatorGPU();

        const canvas = createMockCanvas();

        await initializeWebGPU(canvas, displaySize);

        expect(canvas.style.width).toBe('');
        expect(canvas.style.height).toBe('');
    });

    // #endregion
});
