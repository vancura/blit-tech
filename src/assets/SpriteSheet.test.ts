/**
 * Unit tests for {@link SpriteSheet}.
 *
 * Covers the responsibilities that sit between loaded image assets and GPU
 * rendering:
 * - normalized UV calculation from pixel-space rectangles
 * - reported sheet dimensions and source image access
 * - lazy GPU texture creation, caching, and recreation after destroy
 * - cleanup of GPU textures and temporary `ImageBitmap` instances
 * - `load()` behavior when bitmap decoding succeeds or falls back
 *
 * GPU-facing behavior is verified with the local WebGPU mock helpers and
 * stubbed asset-loading/browser APIs.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice } from '../__test__/webgpu-mock';
import { Rect2i } from '../utils/Rect2i';
import { AssetLoader } from './AssetLoader';
import { SpriteSheet } from './SpriteSheet';

describe('SpriteSheet', () => {
    const mockImage = { width: 256, height: 256 } as HTMLImageElement;

    // #region UV Calculation

    describe('getUVs', () => {
        it('should return (0, 0, 1, 1) for a full-size rect', () => {
            const sheet = new SpriteSheet(mockImage);
            const uvs = sheet.getUVs(new Rect2i(0, 0, 256, 256));

            expect(uvs.u0).toBe(0);
            expect(uvs.v0).toBe(0);
            expect(uvs.u1).toBe(1);
            expect(uvs.v1).toBe(1);
        });

        it('should compute correct UVs for a sub-rect', () => {
            const sheet = new SpriteSheet(mockImage);
            const uvs = sheet.getUVs(new Rect2i(64, 32, 16, 16));

            expect(uvs.u0).toBe(64 / 256);
            expect(uvs.v0).toBe(32 / 256);
            expect(uvs.u1).toBe(80 / 256);
            expect(uvs.v1).toBe(48 / 256);
        });
    });

    // #endregion

    // #region Size

    describe('size', () => {
        it('should reflect the image dimensions', () => {
            const sheet = new SpriteSheet(mockImage);
            expect(sheet.size.x).toBe(256);
            expect(sheet.size.y).toBe(256);
        });
    });

    // #endregion

    // #region Texture Management

    describe('getTexture', () => {
        it('should return a texture object from a mock device', () => {
            const sheet = new SpriteSheet(mockImage);
            const device = createMockGPUDevice();

            const texture = sheet.getTexture(device);
            expect(texture).toBeDefined();
            expect(texture.label).toBe('Sprite Sheet Texture');
        });

        it('should return the same cached texture on subsequent calls', () => {
            const sheet = new SpriteSheet(mockImage);
            const device = createMockGPUDevice();

            const first = sheet.getTexture(device);
            const second = sheet.getTexture(device);
            expect(second).toBe(first);
        });
    });

    // #endregion

    // #region Destroy

    describe('destroy', () => {
        it('should allow creating a new texture after destroy', () => {
            const sheet = new SpriteSheet(mockImage);
            const device = createMockGPUDevice();

            const first = sheet.getTexture(device);
            sheet.destroy();

            const second = sheet.getTexture(device);
            expect(second).not.toBe(first);
        });

        it('should call GPUTexture.destroy on the GPU texture', () => {
            const sheet = new SpriteSheet(mockImage);
            const device = createMockGPUDevice();

            const texture = sheet.getTexture(device);
            const destroySpy = vi.spyOn(texture, 'destroy');

            sheet.destroy();
            expect(destroySpy).toHaveBeenCalledOnce();
        });

        it('should not throw when destroyed before getTexture is called', () => {
            const sheet = new SpriteSheet(mockImage);
            expect(() => sheet.destroy()).not.toThrow();
        });
    });

    // #endregion

    // #region getImage

    describe('getImage', () => {
        it('should return the source HTMLImageElement', () => {
            const sheet = new SpriteSheet(mockImage);
            expect(sheet.getImage()).toBe(mockImage);
        });
    });

    // #endregion

    // #region load

    describe('load', () => {
        afterEach(() => {
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
        });

        it('should create a SpriteSheet with an ImageBitmap when createImageBitmap succeeds', async () => {
            const mockBitmap = { close: vi.fn() } as unknown as ImageBitmap;
            vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap));
            vi.spyOn(AssetLoader, 'loadImage').mockResolvedValue(mockImage);

            const sheet = await SpriteSheet.load('test.png');
            expect(sheet).toBeInstanceOf(SpriteSheet);
            expect(sheet.size.x).toBe(256);
        });

        it('should fall back to HTMLImageElement when createImageBitmap throws', async () => {
            vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Not supported')));
            vi.spyOn(AssetLoader, 'loadImage').mockResolvedValue(mockImage);

            const sheet = await SpriteSheet.load('test.png');
            expect(sheet).toBeInstanceOf(SpriteSheet);
        });

        it('should close imageBitmap after getTexture uploads it to the GPU', async () => {
            const closeSpy = vi.fn();
            vi.stubGlobal(
                'createImageBitmap',
                vi.fn().mockResolvedValue({ close: closeSpy } as unknown as ImageBitmap),
            );
            vi.spyOn(AssetLoader, 'loadImage').mockResolvedValue(mockImage);

            const sheet = await SpriteSheet.load('test.png');
            sheet.getTexture(createMockGPUDevice());
            expect(closeSpy).toHaveBeenCalledOnce();
        });

        it('should close imageBitmap on destroy when getTexture was never called', async () => {
            const closeSpy = vi.fn();
            vi.stubGlobal(
                'createImageBitmap',
                vi.fn().mockResolvedValue({ close: closeSpy } as unknown as ImageBitmap),
            );
            vi.spyOn(AssetLoader, 'loadImage').mockResolvedValue(mockImage);

            const sheet = await SpriteSheet.load('test.png');
            sheet.destroy();
            expect(closeSpy).toHaveBeenCalledOnce();
        });
    });

    // #endregion
});
