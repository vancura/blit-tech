import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    createMockGPUDevice,
    createMockRenderPassEncoder,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import { Vector2i } from '../utils/Vector2i';
import { SpritePipeline } from './SpritePipeline';

// #region Constructor

describe('SpritePipeline constructor', () => {
    it('creates an instance without error', () => {
        const pipeline = new SpritePipeline();
        expect(pipeline).toBeDefined();
        expect(pipeline).toBeInstanceOf(SpritePipeline);
    });
});

// #endregion

// #region Pre-initialization Safety

describe('pre-initialization safety', () => {
    it('reset() can be called multiple times safely', () => {
        const pipeline = new SpritePipeline();
        expect(() => {
            pipeline.reset();
            pipeline.reset();
            pipeline.reset();
        }).not.toThrow();
    });

    it('setCameraOffset() accepts a Vector2i', () => {
        const pipeline = new SpritePipeline();
        expect(() => {
            pipeline.setCameraOffset(new Vector2i(10, 20));
        }).not.toThrow();
    });

    it('setCameraOffset() accepts zero vector', () => {
        const pipeline = new SpritePipeline();
        expect(() => {
            pipeline.setCameraOffset(Vector2i.zero());
        }).not.toThrow();
    });
});

// #endregion

// #region Initialized Pipeline

describe('with initialized pipeline', () => {
    const device = createMockGPUDevice();
    const pipeline = new SpritePipeline();

    beforeAll(async () => {
        installMockNavigatorGPU();
        await pipeline.initialize(device, new Vector2i(320, 240));
    });

    afterAll(() => {
        uninstallMockNavigatorGPU();
    });

    it('encodePass with empty buffer is a no-op', () => {
        pipeline.reset();
        const renderPass = createMockRenderPassEncoder();
        expect(() => {
            pipeline.encodePass(renderPass);
        }).not.toThrow();
    });

    it('reset followed by encodePass produces no draw calls', () => {
        pipeline.reset();

        let drawCalled = false;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCalled = true;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCalled).toBe(false);
    });

    it('multiple reset cycles work without error', () => {
        expect(() => {
            for (let i = 0; i < 5; i++) {
                pipeline.reset();
                pipeline.encodePass(createMockRenderPassEncoder());
                pipeline.reset();
            }
        }).not.toThrow();
    });

    it('setCameraOffset affects subsequent state without error', () => {
        pipeline.reset();
        pipeline.setCameraOffset(new Vector2i(100, 50));
        expect(() => {
            pipeline.encodePass(createMockRenderPassEncoder());
        }).not.toThrow();
        pipeline.setCameraOffset(Vector2i.zero());
    });
});

// #endregion
