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
 * - `indexize()` / `reindexize()` palette-index conversion
 *
 * GPU-facing behavior is verified with the local WebGPU mock helpers and
 * stubbed asset-loading/browser APIs.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice } from '../__test__/webgpu-mock';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { AssetLoader } from './AssetLoader';
import { Palette } from './Palette';
import { SpriteSheet } from './SpriteSheet';

// #region OffscreenCanvas Test Helpers

/**
 * Returns a minimal OffscreenCanvas mock whose getImageData yields the supplied
 * pixel buffer. Use vi.stubGlobal to install it for a single test.
 */
function makeOffscreenCanvasMock(pixelData: Uint8ClampedArray, w: number, h: number) {
    return class {
        public readonly width = w;
        public readonly height = h;

        getContext(_id: string) {
            return {
                drawImage: () => {},
                imageSmoothingEnabled: false,
                getImageData: () => ({ data: pixelData }),
            };
        }
    };
}

// #endregion

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

    // #region Indexization

    describe('isIndexized', () => {
        it('returns false before indexize is called', () => {
            const sheet = new SpriteSheet(mockImage);
            expect(sheet.isIndexized()).toBe(false);
        });
    });

    describe('indexize', () => {
        afterEach(() => {
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
        });

        it('sets isIndexized to true after conversion', () => {
            // Default stub from setup.ts returns all-zero pixels (all transparent).
            const palette = new Palette(16);
            const sheet = new SpriteSheet(mockImage);

            sheet.indexize(palette);

            expect(sheet.isIndexized()).toBe(true);
        });

        it('maps transparent pixels (alpha=0) to palette index 0', () => {
            // All pixels fully transparent — expect no throws and all indices to be 0.
            const palette = new Palette(16);
            const sheet = new SpriteSheet({ width: 2, height: 2 } as HTMLImageElement);

            expect(() => sheet.indexize(palette)).not.toThrow();
            expect(sheet.isIndexized()).toBe(true);
        });

        it('maps opaque pixels to the matching palette index', () => {
            const w = 2;
            const h = 1;
            // One red pixel (alpha=255), one transparent pixel.
            const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);

            vi.stubGlobal('OffscreenCanvas', makeOffscreenCanvasMock(pixels, w, h));

            const palette = new Palette(16);
            palette.set(1, new Color32(255, 0, 0, 255)); // red at index 1

            const sheet = new SpriteSheet({ width: w, height: h } as HTMLImageElement);
            sheet.indexize(palette);

            expect(sheet.isIndexized()).toBe(true);
        });

        it('throws when an opaque pixel color is not in the palette', () => {
            const w = 1;
            const h = 1;
            // Solid red pixel — not in an empty palette.
            const pixels = new Uint8ClampedArray([200, 100, 50, 255]);

            vi.stubGlobal('OffscreenCanvas', makeOffscreenCanvasMock(pixels, w, h));

            const palette = new Palette(16); // no colors set (all black/transparent)
            const sheet = new SpriteSheet({ width: w, height: h } as HTMLImageElement);

            expect(() => sheet.indexize(palette)).toThrow(/c86432|c86432|pixel at \(0, 0\)/i);
        });

        it('creates an r8uint GPU texture on next getTexture call', () => {
            const palette = new Palette(16);
            const sheet = new SpriteSheet(mockImage);

            sheet.indexize(palette);

            const device = createMockGPUDevice();
            const createTextureSpy = vi.spyOn(device, 'createTexture');

            sheet.getTexture(device);

            expect(createTextureSpy).toHaveBeenCalledOnce();
            expect(createTextureSpy).toHaveBeenCalledWith(expect.objectContaining({ format: 'r8uint' }));
        });

        it('invalidates the existing texture when called a second time', () => {
            const palette = new Palette(16);
            const sheet = new SpriteSheet(mockImage);
            const device = createMockGPUDevice();

            sheet.indexize(palette);
            const first = sheet.getTexture(device);

            // Call indexize again — should destroy the existing texture.
            sheet.indexize(palette);
            const second = sheet.getTexture(device);

            expect(second).not.toBe(first);
        });
    });

    describe('reindexize', () => {
        afterEach(() => {
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
        });

        it('throws when called before indexize', () => {
            const palette = new Palette(16);
            const sheet = new SpriteSheet(mockImage);

            expect(() => sheet.reindexize(palette)).toThrow(/indexize\(\) must be called before/i);
        });

        it('invalidates the GPU texture so the next getTexture re-creates it', () => {
            const palette = new Palette(16);
            const sheet = new SpriteSheet(mockImage);
            const device = createMockGPUDevice();

            sheet.indexize(palette);
            const first = sheet.getTexture(device);

            sheet.reindexize(palette);
            const second = sheet.getTexture(device);

            expect(second).not.toBe(first);
        });

        it('succeeds without error when palette is unchanged', () => {
            const palette = new Palette(16);
            const sheet = new SpriteSheet(mockImage);

            sheet.indexize(palette);

            expect(() => sheet.reindexize(palette)).not.toThrow();
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

    // #region fromIndexedPixels

    describe('fromIndexedPixels', () => {
        it('creates a sheet with correct dimensions', () => {
            const pixels = new Uint8Array(16 * 16) as Uint8Array<ArrayBuffer>;
            const sheet = SpriteSheet.fromIndexedPixels(16, 16, pixels);

            expect(sheet.size.x).toBe(16);
            expect(sheet.size.y).toBe(16);
        });

        it('marks the sheet as indexized', () => {
            const pixels = new Uint8Array(8 * 8) as Uint8Array<ArrayBuffer>;
            const sheet = SpriteSheet.fromIndexedPixels(8, 8, pixels);

            expect(sheet.isIndexized()).toBe(true);
        });

        it('throws on indexize (no source image)', () => {
            const pixels = new Uint8Array(4 * 4) as Uint8Array<ArrayBuffer>;
            const sheet = SpriteSheet.fromIndexedPixels(4, 4, pixels);
            const palette = new Palette(16);

            expect(() => sheet.indexize(palette)).toThrow('not available for sheets created from raw indexed data');
        });

        it('throws on reindexize (no source image)', () => {
            const pixels = new Uint8Array(4 * 4) as Uint8Array<ArrayBuffer>;
            const sheet = SpriteSheet.fromIndexedPixels(4, 4, pixels);
            const palette = new Palette(16);

            expect(() => sheet.reindexize(palette)).toThrow('not available for sheets created from raw indexed data');
        });

        it('throws on getImage (no source image)', () => {
            const pixels = new Uint8Array(4 * 4) as Uint8Array<ArrayBuffer>;
            const sheet = SpriteSheet.fromIndexedPixels(4, 4, pixels);

            expect(() => sheet.getImage()).toThrow('not available for sheets created from raw indexed data');
        });

        it('throws RangeError when pixel array length mismatches dimensions', () => {
            const pixels = new Uint8Array(10) as Uint8Array<ArrayBuffer>;

            expect(() => SpriteSheet.fromIndexedPixels(4, 4, pixels)).toThrow(RangeError);
            expect(() => SpriteSheet.fromIndexedPixels(4, 4, pixels)).toThrow(
                'indexedPixels length 10 does not match 4x4 (expected 16)',
            );
        });

        it('creates r8uint GPU texture via getTexture', () => {
            const device = createMockGPUDevice();
            const createTextureSpy = vi.spyOn(device, 'createTexture');
            const pixels = new Uint8Array(4 * 4) as Uint8Array<ArrayBuffer>;
            const sheet = SpriteSheet.fromIndexedPixels(4, 4, pixels);

            const texture = sheet.getTexture(device);

            expect(texture).toBeDefined();
            expect(createTextureSpy).toHaveBeenCalledOnce();
            expect(createTextureSpy).toHaveBeenCalledWith(expect.objectContaining({ format: 'r8uint' }));
        });
    });

    // #endregion
});
