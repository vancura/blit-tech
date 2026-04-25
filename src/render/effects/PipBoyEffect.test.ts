/**
 * Unit tests for {@link PipBoyEffect}.
 *
 * Covers the post-process effect contract:
 * - {@link PipBoyEffect.init} creates a render pipeline, an 80-byte uniform
 *   buffer, and a sampler
 * - {@link PipBoyEffect.updateUniforms} writes the uniform block once per frame
 *   with the expected byte length and field ordering
 * - {@link PipBoyEffect.encodePass} issues exactly one render pass with the
 *   expected `setPipeline / setBindGroup / draw(3, 1, 0, 0) / end` sequence
 * - per-source-view bind group caching avoids redundant `createBindGroup`
 *   calls when the same source texture is re-bound
 * - {@link PipBoyEffect.dispose} releases GPU resources and is safe to call twice
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice, installMockNavigatorGPU, uninstallMockNavigatorGPU } from '../../__test__/webgpu-mock';
import { Vector2i } from '../../utils/Vector2i';
import { PipBoyEffect } from './PipBoyEffect';

// #region Constants

const FORMAT: GPUTextureFormat = 'bgra8unorm';
const DISPLAY_SIZE = new Vector2i(320, 240);
const UNIFORM_BYTES = 80;

// #endregion

// #region Mock setup

beforeAll(() => {
    installMockNavigatorGPU();
});

afterAll(() => {
    uninstallMockNavigatorGPU();
});

// #endregion

// #region Construction

describe('PipBoyEffect construction', () => {
    it('exposes the PipBoy reference defaults', () => {
        const effect = new PipBoyEffect();

        expect(effect.screenCurvature).toBe(0.02);
        expect(effect.scanLineAmount).toBe(0.6);
        expect(effect.scanLineStrength).toBe(-8);
        expect(effect.pixelStrength).toBe(-1.5);
        expect(effect.maskIntensity).toBeCloseTo(0.1);
        expect(effect.maskSize).toBe(6);
        expect(effect.maskBorder).toBe(0.5);
        expect(effect.aberration).toBe(1);
        expect(effect.vignetteAmount).toBe(0.2);
        expect(effect.noiseAmount).toBe(0.015);
        expect(effect.interferenceAmount).toBeCloseTo(0.06);
        expect(effect.rollLineAmount).toBeCloseTo(0.1);
        expect(effect.rollSpeed).toBe(1);

        // Animation uniforms default to deterministic, no-op values so the
        // unmodified effect produces a fixed reference frame.
        expect(effect.time).toBe(0);
        expect(effect.glitchIntensity).toBe(0);
        expect(effect.glitchSeed).toBe(0);
        expect(effect.flickerAmount).toBe(1);
    });
});

// #endregion

// #region init()

describe('init()', () => {
    it('creates a render pipeline targeting the supplied format', () => {
        const device = createMockGPUDevice();
        const createPipeline = vi.spyOn(device, 'createRenderPipeline');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        expect(createPipeline).toHaveBeenCalledTimes(1);

        const desc = createPipeline.mock.calls[0]?.[0] as GPURenderPipelineDescriptor;
        expect(desc.fragment?.targets[0]?.format).toBe(FORMAT);
    });

    it('allocates an 80-byte uniform buffer with UNIFORM | COPY_DST usage', () => {
        const device = createMockGPUDevice();
        const createBuffer = vi.spyOn(device, 'createBuffer');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        const uniformCalls = createBuffer.mock.calls.filter((call) => call[0].size === UNIFORM_BYTES);

        expect(uniformCalls).toHaveLength(1);

        const desc = uniformCalls[0]?.[0] as GPUBufferDescriptor;
        expect(desc.usage & GPUBufferUsage.UNIFORM).toBe(GPUBufferUsage.UNIFORM);
        expect(desc.usage & GPUBufferUsage.COPY_DST).toBe(GPUBufferUsage.COPY_DST);
    });

    it('creates a linear sampler with clamp-to-edge addressing', () => {
        const device = createMockGPUDevice();
        const createSampler = vi.spyOn(device, 'createSampler');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        expect(createSampler).toHaveBeenCalledTimes(1);

        const desc = createSampler.mock.calls[0]?.[0] as GPUSamplerDescriptor;
        expect(desc.magFilter).toBe('linear');
        expect(desc.minFilter).toBe('linear');
        expect(desc.addressModeU).toBe('clamp-to-edge');
        expect(desc.addressModeV).toBe('clamp-to-edge');
    });
});

// #endregion

// #region updateUniforms()

describe('updateUniforms()', () => {
    it('writes the uniform block exactly once with the expected byte length', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);
        writeBuffer.mockClear();

        effect.updateUniforms(16, DISPLAY_SIZE);

        expect(writeBuffer).toHaveBeenCalledTimes(1);
        const args = writeBuffer.mock.calls[0];
        const data = args?.[2] as Float32Array;
        expect(data.byteLength).toBe(UNIFORM_BYTES);
    });

    it('packs the source resolution into uniform slots 0 and 1', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);
        writeBuffer.mockClear();

        effect.updateUniforms(16, new Vector2i(384, 224));

        const data = writeBuffer.mock.calls[0]?.[2] as Float32Array;

        expect(data[0]).toBe(384);
        expect(data[1]).toBe(224);
    });

    it('packs animation uniforms in the documented order (time, glitch*, flicker)', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        effect.time = 1.25;
        effect.glitchIntensity = 0.7;
        effect.glitchSeed = 42;
        effect.flickerAmount = 0.9;

        writeBuffer.mockClear();
        effect.updateUniforms(16, DISPLAY_SIZE);

        const data = writeBuffer.mock.calls[0]?.[2] as Float32Array;

        expect(data[2]).toBeCloseTo(1.25);
        expect(data[3]).toBeCloseTo(0.7);
        expect(data[4]).toBe(42);
        expect(data[5]).toBeCloseTo(0.9);
    });

    it('is a no-op before init() (no writeBuffer calls)', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const effect = new PipBoyEffect();

        effect.updateUniforms(16, DISPLAY_SIZE);

        expect(writeBuffer).not.toHaveBeenCalled();
    });
});

// #endregion

// #region encodePass()

describe('encodePass()', () => {
    function makeEncoder(device: GPUDevice): GPUCommandEncoder {
        return device.createCommandEncoder();
    }

    function makeView(label: string): GPUTextureView {
        return { label } as unknown as GPUTextureView;
    }

    it('issues one render pass with the destination view as color attachment', () => {
        const device = createMockGPUDevice();
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        const encoder = makeEncoder(device);
        const beginPass = vi.spyOn(encoder, 'beginRenderPass');
        const dest = makeView('dest');

        effect.encodePass(encoder, makeView('source'), dest);

        expect(beginPass).toHaveBeenCalledTimes(1);

        const desc = beginPass.mock.calls[0]?.[0] as GPURenderPassDescriptor;
        const attachment = (desc.colorAttachments as GPURenderPassColorAttachment[])[0];

        expect(attachment?.view).toBe(dest);
    });

    it('binds the source view, sets the pipeline, and draws a fullscreen triangle', () => {
        const device = createMockGPUDevice();
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        // Spy on the render pass methods by intercepting beginRenderPass.
        const encoder = makeEncoder(device);
        let setPipeline: ReturnType<typeof vi.fn> | null = null;
        let setBindGroup: ReturnType<typeof vi.fn> | null = null;
        let draw: ReturnType<typeof vi.fn> | null = null;
        let end: ReturnType<typeof vi.fn> | null = null;

        const original = encoder.beginRenderPass.bind(encoder);
        vi.spyOn(encoder, 'beginRenderPass').mockImplementation((descriptor) => {
            const pass = original(descriptor);
            setPipeline = vi.spyOn(pass, 'setPipeline');
            setBindGroup = vi.spyOn(pass, 'setBindGroup');
            draw = vi.spyOn(pass, 'draw');
            end = vi.spyOn(pass, 'end');
            return pass;
        });

        effect.encodePass(encoder, makeView('source'), makeView('dest'));

        expect(setPipeline).toHaveBeenCalledTimes(1);
        expect(setBindGroup).toHaveBeenCalledTimes(1);
        expect(setBindGroup).toHaveBeenCalledWith(0, expect.anything());
        expect(draw).toHaveBeenCalledWith(3, 1, 0, 0);
        expect(end).toHaveBeenCalledTimes(1);
    });

    it('caches per-source-view bind groups across consecutive frames', () => {
        const device = createMockGPUDevice();
        const createBindGroup = vi.spyOn(device, 'createBindGroup');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);
        createBindGroup.mockClear();

        const sourceA = makeView('sourceA');
        const dest = makeView('dest');

        effect.encodePass(makeEncoder(device), sourceA, dest);
        effect.encodePass(makeEncoder(device), sourceA, dest);
        effect.encodePass(makeEncoder(device), sourceA, dest);

        expect(createBindGroup).toHaveBeenCalledTimes(1);
    });

    it('creates a new bind group when the source view changes', () => {
        const device = createMockGPUDevice();
        const createBindGroup = vi.spyOn(device, 'createBindGroup');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);
        createBindGroup.mockClear();

        effect.encodePass(makeEncoder(device), makeView('sourceA'), makeView('dest'));
        effect.encodePass(makeEncoder(device), makeView('sourceB'), makeView('dest'));

        expect(createBindGroup).toHaveBeenCalledTimes(2);
    });

    it('is a no-op before init() (no render pass)', () => {
        const device = createMockGPUDevice();
        const encoder = makeEncoder(device);
        const beginPass = vi.spyOn(encoder, 'beginRenderPass');
        const effect = new PipBoyEffect();

        effect.encodePass(encoder, makeView('source'), makeView('dest'));

        expect(beginPass).not.toHaveBeenCalled();
    });
});

// #endregion

// #region dispose()

describe('dispose()', () => {
    it('destroys the uniform buffer and releases internal references', () => {
        const device = createMockGPUDevice();
        const createBuffer = vi.spyOn(device, 'createBuffer');
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        const uniformCalls = createBuffer.mock.results;
        const buffer = uniformCalls[0]?.value as GPUBuffer;
        const destroySpy = vi.spyOn(buffer, 'destroy');

        effect.dispose();

        expect(destroySpy).toHaveBeenCalled();
    });

    it('is safe to call twice', () => {
        const device = createMockGPUDevice();
        const effect = new PipBoyEffect();

        effect.init(device, FORMAT, DISPLAY_SIZE);

        expect(() => {
            effect.dispose();
            effect.dispose();
        }).not.toThrow();
    });
});

// #endregion
