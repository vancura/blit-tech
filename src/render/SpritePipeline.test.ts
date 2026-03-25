import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    createMockGPUDevice,
    createMockRenderPassEncoder,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
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

// #region Sprite Drawing

describe('drawSprite', () => {
    const device = createMockGPUDevice();
    const pipeline = new SpritePipeline();
    const mockImage = { width: 64, height: 64 } as HTMLImageElement;

    beforeAll(async () => {
        installMockNavigatorGPU();
        await pipeline.initialize(device, new Vector2i(320, 240));
    });

    afterAll(() => {
        uninstallMockNavigatorGPU();
    });

    it('does not throw with valid arguments', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        expect(() => {
            pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(10, 20));
        }).not.toThrow();
    });

    it('with explicit tint color does not throw', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        expect(() => {
            pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0), Color32.red());
        }).not.toThrow();
    });

    it('with fully transparent tint does not throw', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        expect(() => {
            pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0), new Color32(255, 255, 255, 0));
        }).not.toThrow();
    });

    it('causes a draw call in encodePass', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));

        let drawCallCount = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCallCount++;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCallCount).toBe(1);
    });

    it('multiple calls from the same sheet produce one draw call', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));
        pipeline.drawSprite(sheet, new Rect2i(16, 0, 16, 16), new Vector2i(20, 0));
        pipeline.drawSprite(sheet, new Rect2i(32, 0, 16, 16), new Vector2i(40, 0));

        let drawCallCount = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCallCount++;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCallCount).toBe(1);
    });

    it('calls from different sheets produce separate draw calls', () => {
        pipeline.reset();
        const sheetA = new SpriteSheet({ width: 64, height: 64 } as HTMLImageElement);
        const sheetB = new SpriteSheet({ width: 128, height: 128 } as HTMLImageElement);
        pipeline.drawSprite(sheetA, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));
        pipeline.drawSprite(sheetB, new Rect2i(0, 0, 16, 16), new Vector2i(20, 0));

        let drawCallCount = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCallCount++;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCallCount).toBe(2);
    });

    it('interleaved sheets produce one draw call per texture switch', () => {
        pipeline.reset();
        const sheetA = new SpriteSheet({ width: 64, height: 64 } as HTMLImageElement);
        const sheetB = new SpriteSheet({ width: 128, height: 128 } as HTMLImageElement);
        pipeline.drawSprite(sheetA, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));
        pipeline.drawSprite(sheetB, new Rect2i(0, 0, 16, 16), new Vector2i(20, 0));
        pipeline.drawSprite(sheetA, new Rect2i(0, 0, 16, 16), new Vector2i(40, 0));

        let drawCallCount = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCallCount++;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCallCount).toBe(3);
    });

    it('after reset produces no draw calls', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));
        pipeline.reset();

        let drawCallCount = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCallCount++;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCallCount).toBe(0);
    });

    it('with camera offset does not throw', () => {
        pipeline.reset();
        pipeline.setCameraOffset(new Vector2i(50, 50));
        const sheet = new SpriteSheet(mockImage);
        expect(() => {
            pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(10, 10));
            pipeline.encodePass(createMockRenderPassEncoder());
        }).not.toThrow();
        pipeline.setCameraOffset(Vector2i.zero());
    });

    it('a single-pixel srcRect does not throw', () => {
        pipeline.reset();
        const sheet = new SpriteSheet(mockImage);
        expect(() => {
            pipeline.drawSprite(sheet, new Rect2i(0, 0, 1, 1), new Vector2i(5, 5));
            pipeline.encodePass(createMockRenderPassEncoder());
        }).not.toThrow();
    });

    it('multiple frame cycles work without error', () => {
        const sheet = new SpriteSheet(mockImage);
        expect(() => {
            for (let i = 0; i < 5; i++) {
                pipeline.reset();
                pipeline.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(i * 16, 0));
                pipeline.encodePass(createMockRenderPassEncoder());
            }
        }).not.toThrow();
    });
});

// #endregion
