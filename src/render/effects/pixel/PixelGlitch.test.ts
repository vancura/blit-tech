import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice, installMockNavigatorGPU, uninstallMockNavigatorGPU } from '../../../__test__/webgpu-mock';
import { Vector2i } from '../../../utils/Vector2i';
import { PixelGlitch } from './PixelGlitch';

const FORMAT: GPUTextureFormat = 'bgra8unorm';
const SIZE = new Vector2i(320, 240);

beforeAll(() => {
    installMockNavigatorGPU();
});

afterAll(() => {
    uninstallMockNavigatorGPU();
});

describe('PixelGlitch', () => {
    it("declares tier='pixel'", () => {
        expect(new PixelGlitch().tier).toBe('pixel');
    });

    it('uses nearest sampling to preserve palette colors', () => {
        const device = createMockGPUDevice();
        const createSampler = vi.spyOn(device, 'createSampler');
        const fx = new PixelGlitch();

        fx.init(device, FORMAT, SIZE);

        const desc = createSampler.mock.calls[0]?.[0];
        expect(desc?.magFilter).toBe('nearest');
        expect(desc?.minFilter).toBe('nearest');
    });

    it('init allocates a 32-byte uniform buffer', () => {
        const device = createMockGPUDevice();
        const createBuffer = vi.spyOn(device, 'createBuffer');
        const fx = new PixelGlitch();

        fx.init(device, FORMAT, SIZE);

        expect(createBuffer.mock.calls[0]?.[0]?.size).toBe(32);
    });

    it('updateUniforms writes intensity, bandHeight, seed', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const fx = new PixelGlitch();
        fx.intensity = 0.4;
        fx.bandHeight = 6;
        fx.seed = 12;

        fx.init(device, FORMAT, SIZE);
        fx.updateUniforms(16, SIZE);

        const buf = writeBuffer.mock.calls[0]?.[2] as Float32Array;
        expect(buf[2]).toBeCloseTo(0.4);
        expect(buf[3]).toBeCloseTo(6);
        expect(buf[4]).toBeCloseTo(12);
    });
});
