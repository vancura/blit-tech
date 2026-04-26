import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice, installMockNavigatorGPU, uninstallMockNavigatorGPU } from '../../../__test__/webgpu-mock';
import { Vector2i } from '../../../utils/Vector2i';
import { PixelMosaic } from './PixelMosaic';

const FORMAT: GPUTextureFormat = 'bgra8unorm';
const SIZE = new Vector2i(320, 240);

beforeAll(() => {
    installMockNavigatorGPU();
});

afterAll(() => {
    uninstallMockNavigatorGPU();
});

describe('PixelMosaic', () => {
    it("declares tier='pixel'", () => {
        expect(new PixelMosaic().tier).toBe('pixel');
    });

    it('uses nearest sampling', () => {
        const device = createMockGPUDevice();
        const createSampler = vi.spyOn(device, 'createSampler');
        const fx = new PixelMosaic();

        fx.init(device, FORMAT, SIZE);

        expect(createSampler.mock.calls[0]?.[0]?.magFilter).toBe('nearest');
    });

    it('updateUniforms writes blockSize', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const fx = new PixelMosaic();
        fx.blockSize = 8;

        fx.init(device, FORMAT, SIZE);
        fx.updateUniforms(16, SIZE);

        const buf = writeBuffer.mock.calls[0]?.[2] as Float32Array;
        expect(buf[2]).toBeCloseTo(8);
    });
});
