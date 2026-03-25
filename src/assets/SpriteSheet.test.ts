import { describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice } from '../__test__/webgpu-mock';
import { Rect2i } from '../utils/Rect2i';
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
    });

    // #endregion
});
