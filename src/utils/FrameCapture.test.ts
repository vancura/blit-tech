import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice, createMockGPUTexture } from '../__test__/webgpu-mock';
import { alignedBytesPerRow, FrameCapture, swizzleBGRAtoRGBA } from './FrameCapture';

// #region Browser API Mocks

/**
 * Installs browser-only globals (ImageData, OffscreenCanvas) that don't exist in Node.js.
 * Call in beforeEach for tests that exercise the full capture-to-PNG flow.
 */
function installBrowserMocks(): void {
    const mockBlob = new Blob(['png-data'], { type: 'image/png' });

    // Use classes so they work with `new`.
    vi.stubGlobal(
        'ImageData',
        class MockImageData {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            constructor(data: Uint8ClampedArray, width: number, height: number) {
                this.data = data;
                this.width = width;
                this.height = height;
            }
        },
    );

    vi.stubGlobal(
        'OffscreenCanvas',
        class MockOffscreenCanvas {
            getContext(): { putImageData: ReturnType<typeof vi.fn> } {
                return { putImageData: vi.fn() };
            }
            async convertToBlob(): Promise<Blob> {
                return mockBlob;
            }
        },
    );
}

// #endregion

// #region alignedBytesPerRow

describe('alignedBytesPerRow', () => {
    it('should return 256 for widths up to 64 pixels', () => {
        // 64 * 4 = 256, which is already aligned.
        expect(alignedBytesPerRow(1)).toBe(256);
        expect(alignedBytesPerRow(32)).toBe(256);
        expect(alignedBytesPerRow(64)).toBe(256);
    });

    it('should round up to next 256 boundary', () => {
        // 65 * 4 = 260 -> next 256 multiple = 512
        expect(alignedBytesPerRow(65)).toBe(512);
        // 128 * 4 = 512 -> already aligned
        expect(alignedBytesPerRow(128)).toBe(512);
        // 320 * 4 = 1280 -> next 256 multiple = 1280 (already aligned)
        expect(alignedBytesPerRow(320)).toBe(1280);
    });

    it('should handle typical retro resolutions', () => {
        // 160 * 4 = 640 -> next 256 = 768
        expect(alignedBytesPerRow(160)).toBe(768);
        // 240 * 4 = 960 -> next 256 = 1024
        expect(alignedBytesPerRow(240)).toBe(1024);
        // 256 * 4 = 1024 -> already aligned
        expect(alignedBytesPerRow(256)).toBe(1024);
    });
});

// #endregion

// #region swizzleBGRAtoRGBA

describe('swizzleBGRAtoRGBA', () => {
    it('should swap B and R channels', () => {
        // BGRA: B=10, G=20, R=30, A=40
        const data = new Uint8ClampedArray([10, 20, 30, 40]);

        swizzleBGRAtoRGBA(data);

        // RGBA: R=30, G=20, B=10, A=40
        expect(data[0]).toBe(30);
        expect(data[1]).toBe(20);
        expect(data[2]).toBe(10);
        expect(data[3]).toBe(40);
    });

    it('should handle multiple pixels', () => {
        const data = new Uint8ClampedArray([
            255,
            0,
            0,
            255, // Pixel 1: BGRA (blue)
            0,
            255,
            0,
            255, // Pixel 2: BGRA (green)
        ]);

        swizzleBGRAtoRGBA(data);

        // Pixel 1: RGBA (blue channel stays, red channel swapped)
        expect(data[0]).toBe(0); // R (was B=255, now R from position 2)
        expect(data[2]).toBe(255); // B (was R=0, now B from position 0)
        // Pixel 2: green channel unchanged
        expect(data[4]).toBe(0);
        expect(data[5]).toBe(255);
        expect(data[6]).toBe(0);
    });

    it('should handle empty array', () => {
        const data = new Uint8ClampedArray([]);

        swizzleBGRAtoRGBA(data);

        expect(data.length).toBe(0);
    });
});

// #endregion

// #region FrameCapture

describe('FrameCapture', () => {
    beforeEach(() => {
        installBrowserMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should start with no pending capture', () => {
        const capture = new FrameCapture();

        expect(capture.hasPendingCapture()).toBe(false);
    });

    it('should set pending flag after requestCapture', () => {
        const capture = new FrameCapture();

        // Don't await -- just queue the request.
        void capture.requestCapture();

        expect(capture.hasPendingCapture()).toBe(true);
    });

    it('should reject previous capture when a new one is requested', async () => {
        const capture = new FrameCapture();

        const firstCapture = capture.requestCapture();

        void capture.requestCapture();

        await expect(firstCapture).rejects.toThrow('superseded');
    });

    it('should clear pending flag after resolveCapture', async () => {
        const capture = new FrameCapture();

        void capture.requestCapture();

        expect(capture.hasPendingCapture()).toBe(true);

        const device = createMockGPUDevice();
        const texture = createMockGPUTexture(4, 4);
        const encoder = device.createCommandEncoder();

        // Add copyTextureToBuffer to mock encoder.
        (encoder as unknown as Record<string, unknown>).copyTextureToBuffer = vi.fn();

        capture.executeCaptureInEncoder(device, texture, encoder as unknown as GPUCommandEncoder);

        await capture.resolveCapture(device);

        expect(capture.hasPendingCapture()).toBe(false);
    });

    it('should call copyTextureToBuffer in executeCaptureInEncoder', () => {
        const capture = new FrameCapture();

        void capture.requestCapture();

        const device = createMockGPUDevice();
        const texture = createMockGPUTexture(320, 240);
        const copyFn = vi.fn();
        const encoder = {
            ...device.createCommandEncoder(),
            copyTextureToBuffer: copyFn,
        } as unknown as GPUCommandEncoder;

        capture.executeCaptureInEncoder(device, texture, encoder);

        expect(copyFn).toHaveBeenCalledOnce();

        // Verify the buffer destination has aligned bytesPerRow.
        const destArg = copyFn.mock.calls[0]?.[1] as { bytesPerRow: number };

        expect(destArg.bytesPerRow).toBe(alignedBytesPerRow(320));
    });

    it('should resolve with a Blob on successful capture', async () => {
        const capture = new FrameCapture();
        const capturePromise = capture.requestCapture();

        const device = createMockGPUDevice();
        const texture = createMockGPUTexture(4, 4);
        const encoder = {
            ...device.createCommandEncoder(),
            copyTextureToBuffer: vi.fn(),
        } as unknown as GPUCommandEncoder;

        capture.executeCaptureInEncoder(device, texture, encoder);

        await capture.resolveCapture(device);

        const result = await capturePromise;

        expect(result).toBeInstanceOf(Blob);
        expect(result.type).toBe('image/png');
    });

    it('should detect BGRA format from texture', () => {
        const capture = new FrameCapture();

        void capture.requestCapture();

        const device = createMockGPUDevice();
        const bgraTexture = { ...createMockGPUTexture(4, 4), format: 'bgra8unorm' } as unknown as GPUTexture;
        const encoder = {
            ...device.createCommandEncoder(),
            copyTextureToBuffer: vi.fn(),
        } as unknown as GPUCommandEncoder;

        capture.executeCaptureInEncoder(device, bgraTexture, encoder);

        // The BGRA flag is stored internally -- we verify it indirectly
        // through the resolveCapture flow. For now, just verify no error.
        expect(capture.hasPendingCapture()).toBe(true);
    });

    it('should not throw when resolveCapture is called without pending capture', async () => {
        const capture = new FrameCapture();
        const device = createMockGPUDevice();

        await expect(capture.resolveCapture(device)).resolves.toBeUndefined();
    });
});

// #endregion
