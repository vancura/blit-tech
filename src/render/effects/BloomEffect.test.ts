/**
 * Unit tests for {@link BloomEffect}.
 *
 * Mirrors the {@link PipBoyEffect} test shape: pipeline + uniform buffer + sampler
 * created on init, single uniform write per frame, single render pass per
 * encode, per-source-view bind group caching, and clean dispose.
 *
 * Also adds a stacking smoke test that pushes both a CRT and a Bloom into a
 * shared {@link PostProcessChain} to exercise the multi-effect ping-pong path
 * end-to-end at the unit-test level.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice, installMockNavigatorGPU, uninstallMockNavigatorGPU } from '../../__test__/webgpu-mock';
import { Vector2i } from '../../utils/Vector2i';
import { PostProcessChain } from '../PostProcessChain';
import { BloomEffect } from './BloomEffect';
import { PipBoyEffect } from './PipBoyEffect';

// #region Constants

const FORMAT: GPUTextureFormat = 'bgra8unorm';
const DISPLAY_SIZE = new Vector2i(320, 240);
const UNIFORM_BYTES = 16;

// #endregion

// #region Mock setup

beforeAll(() => {
    installMockNavigatorGPU();
});

afterAll(() => {
    uninstallMockNavigatorGPU();
});

// #endregion

describe('BloomEffect construction', () => {
    it('exposes the PipBoy reference defaults', () => {
        const bloom = new BloomEffect();

        expect(bloom.bloomSpread).toBe(3.0);
        expect(bloom.bloomGlow).toBeCloseTo(0.12);
    });
});

describe('init()', () => {
    it('creates a render pipeline targeting the supplied format', () => {
        const device = createMockGPUDevice();
        const createPipeline = vi.spyOn(device, 'createRenderPipeline');
        const bloom = new BloomEffect();

        bloom.init(device, FORMAT, DISPLAY_SIZE);

        const desc = createPipeline.mock.calls[0]?.[0] as GPURenderPipelineDescriptor;
        expect(desc.fragment?.targets[0]?.format).toBe(FORMAT);
    });

    it('allocates a 16-byte uniform buffer and a sampler', () => {
        const device = createMockGPUDevice();
        const createBuffer = vi.spyOn(device, 'createBuffer');
        const createSampler = vi.spyOn(device, 'createSampler');
        const bloom = new BloomEffect();

        bloom.init(device, FORMAT, DISPLAY_SIZE);

        const uniformCalls = createBuffer.mock.calls.filter((call) => call[0].size === UNIFORM_BYTES);

        expect(uniformCalls).toHaveLength(1);
        expect(createSampler).toHaveBeenCalledTimes(1);
    });
});

describe('updateUniforms()', () => {
    it('writes the resolution and parameters in the documented order', () => {
        const device = createMockGPUDevice();
        const writeBuffer = vi.spyOn(device.queue, 'writeBuffer');
        const bloom = new BloomEffect();

        bloom.init(device, FORMAT, DISPLAY_SIZE);
        bloom.bloomSpread = 4.5;
        bloom.bloomGlow = 0.25;

        writeBuffer.mockClear();
        bloom.updateUniforms(16, new Vector2i(200, 100));

        expect(writeBuffer).toHaveBeenCalledTimes(1);
        const data = writeBuffer.mock.calls[0]?.[2] as Float32Array;
        expect(data.byteLength).toBe(UNIFORM_BYTES);
        expect(data[0]).toBe(200);
        expect(data[1]).toBe(100);
        expect(data[2]).toBeCloseTo(4.5);
        expect(data[3]).toBeCloseTo(0.25);
    });
});

describe('encodePass()', () => {
    it('issues one render pass with the destination view', () => {
        const device = createMockGPUDevice();
        const bloom = new BloomEffect();

        bloom.init(device, FORMAT, DISPLAY_SIZE);

        const encoder = device.createCommandEncoder();
        const beginPass = vi.spyOn(encoder, 'beginRenderPass');
        const dest = { label: 'dest' } as unknown as GPUTextureView;

        bloom.encodePass(encoder, { label: 'src' } as unknown as GPUTextureView, dest);

        expect(beginPass).toHaveBeenCalledTimes(1);
        const desc = beginPass.mock.calls[0]?.[0] as GPURenderPassDescriptor;
        const attachment = (desc.colorAttachments as GPURenderPassColorAttachment[])[0];
        expect(attachment?.view).toBe(dest);
    });

    it('caches per-source-view bind groups across encode calls', () => {
        const device = createMockGPUDevice();
        const createBindGroup = vi.spyOn(device, 'createBindGroup');
        const bloom = new BloomEffect();

        bloom.init(device, FORMAT, DISPLAY_SIZE);
        createBindGroup.mockClear();

        const source = { label: 'source' } as unknown as GPUTextureView;
        const dest = { label: 'dest' } as unknown as GPUTextureView;

        bloom.encodePass(device.createCommandEncoder(), source, dest);
        bloom.encodePass(device.createCommandEncoder(), source, dest);

        expect(createBindGroup).toHaveBeenCalledTimes(1);
    });
});

describe('dispose()', () => {
    it('destroys the uniform buffer', () => {
        const device = createMockGPUDevice();
        const createBuffer = vi.spyOn(device, 'createBuffer');
        const bloom = new BloomEffect();

        bloom.init(device, FORMAT, DISPLAY_SIZE);

        const buffer = createBuffer.mock.results[0]?.value as GPUBuffer;
        const destroySpy = vi.spyOn(buffer, 'destroy');

        bloom.dispose();

        expect(destroySpy).toHaveBeenCalled();
    });
});

// #region Stacking smoke test

describe('CRT + Bloom stacking through PostProcessChain', () => {
    it('drives both effects in registration order', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        const crt = new PipBoyEffect();
        const bloom = new BloomEffect();

        const crtEncode = vi.spyOn(crt, 'encodePass');
        const bloomEncode = vi.spyOn(bloom, 'encodePass');

        chain.add(crt);
        chain.add(bloom);

        const swapView = { label: 'swap' } as unknown as GPUTextureView;
        chain.encode(device.createCommandEncoder(), 16, swapView);

        expect(crtEncode).toHaveBeenCalledTimes(1);
        expect(bloomEncode).toHaveBeenCalledTimes(1);

        // CRT runs first into the offscreen ping-pong buffer; Bloom runs last
        // and writes into the swap-chain view.
        const crtArgs = crtEncode.mock.calls[0];
        const bloomArgs = bloomEncode.mock.calls[0];

        expect(crtArgs?.[2]).not.toBe(swapView);
        expect(bloomArgs?.[2]).toBe(swapView);
        expect(bloomArgs?.[1]).toBe(crtArgs?.[2]);
    });

    it('removing one of two stacked effects keeps the chain active', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        const crt = new PipBoyEffect();
        const bloom = new BloomEffect();

        chain.add(crt);
        chain.add(bloom);

        chain.remove(bloom);

        expect(chain.isActive()).toBe(true);
    });
});

// #endregion
