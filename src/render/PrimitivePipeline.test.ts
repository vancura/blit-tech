import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
    createMockGPUDevice,
    createMockRenderPassEncoder,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { PrimitivePipeline } from './PrimitivePipeline';

// #region Constructor

describe('PrimitivePipeline constructor', () => {
    it('creates an instance without error', () => {
        const pipeline = new PrimitivePipeline();
        expect(pipeline).toBeDefined();
        expect(pipeline).toBeInstanceOf(PrimitivePipeline);
    });
});

// #endregion

// #region Pre-initialization Safety

describe('pre-initialization safety', () => {
    it('reset() can be called multiple times safely', () => {
        const pipeline = new PrimitivePipeline();
        expect(() => {
            pipeline.reset();
            pipeline.reset();
            pipeline.reset();
        }).not.toThrow();
    });

    it('setCameraOffset() accepts a Vector2i', () => {
        const pipeline = new PrimitivePipeline();
        expect(() => {
            pipeline.setCameraOffset(new Vector2i(10, 20));
        }).not.toThrow();
    });

    it('setCameraOffset() accepts zero vector', () => {
        const pipeline = new PrimitivePipeline();
        expect(() => {
            pipeline.setCameraOffset(Vector2i.zero());
        }).not.toThrow();
    });

    it('drawRectFill() does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const rect = new Rect2i(0, 0, 10, 10);
        const color = Color32.red();
        expect(() => {
            pipeline.drawRectFill(rect, color);
        }).not.toThrow();
    });

    it('drawPixel() does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const pos = new Vector2i(5, 5);
        const color = Color32.green();
        expect(() => {
            pipeline.drawPixel(pos, color);
        }).not.toThrow();
    });

    it('drawPixelXY() does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const color = Color32.blue();
        expect(() => {
            pipeline.drawPixelXY(3, 7, color);
        }).not.toThrow();
    });

    it('drawLine() with horizontal line does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const p0 = new Vector2i(0, 10);
        const p1 = new Vector2i(100, 10);
        const color = Color32.white();
        expect(() => {
            pipeline.drawLine(p0, p1, color);
        }).not.toThrow();
    });

    it('drawLine() with vertical line does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const p0 = new Vector2i(10, 0);
        const p1 = new Vector2i(10, 100);
        const color = Color32.yellow();
        expect(() => {
            pipeline.drawLine(p0, p1, color);
        }).not.toThrow();
    });

    it('drawLine() with diagonal line does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const p0 = new Vector2i(0, 0);
        const p1 = new Vector2i(50, 30);
        const color = Color32.cyan();
        expect(() => {
            pipeline.drawLine(p0, p1, color);
        }).not.toThrow();
    });

    it('drawRect() does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const rect = new Rect2i(5, 5, 20, 20);
        const color = Color32.magenta();
        expect(() => {
            pipeline.drawRect(rect, color);
        }).not.toThrow();
    });

    it('clearRect() does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const rect = new Rect2i(0, 0, 100, 100);
        const color = Color32.black();
        expect(() => {
            pipeline.clearRect(color, rect);
        }).not.toThrow();
    });

    it('drawText() does not throw before initialize', () => {
        const pipeline = new PrimitivePipeline();
        const pos = new Vector2i(10, 10);
        const color = Color32.white();
        expect(() => {
            pipeline.drawText(pos, color, 'Hello');
        }).not.toThrow();
    });
});

// #endregion

// #region Initialized Pipeline

describe('with initialized pipeline', () => {
    const device = createMockGPUDevice();
    const pipeline = new PrimitivePipeline();

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

    it('encodePass after drawing primitives completes without error', () => {
        pipeline.reset();
        const rect = new Rect2i(0, 0, 10, 10);
        pipeline.drawRectFill(rect, Color32.red());
        pipeline.drawPixel(new Vector2i(5, 5), Color32.green());
        pipeline.drawLine(new Vector2i(0, 0), new Vector2i(20, 0), Color32.blue());

        const renderPass = createMockRenderPassEncoder();
        expect(() => {
            pipeline.encodePass(renderPass);
        }).not.toThrow();
    });

    it('reset followed by encodePass produces no draw calls', () => {
        pipeline.reset();
        pipeline.drawRectFill(new Rect2i(0, 0, 5, 5), Color32.white());
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

    it('encodePass calls draw on render pass when vertices exist', () => {
        pipeline.reset();
        pipeline.drawRectFill(new Rect2i(10, 10, 20, 20), Color32.red());

        let drawCalled = false;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: () => {
                drawCalled = true;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(drawCalled).toBe(true);
    });

    it('multiple begin/end frame cycles work without error', () => {
        expect(() => {
            for (let i = 0; i < 5; i++) {
                pipeline.reset();
                pipeline.drawPixel(new Vector2i(i, i), Color32.white());
                pipeline.encodePass(createMockRenderPassEncoder());
                pipeline.reset();
            }
        }).not.toThrow();
    });

    it('setCameraOffset affects subsequent draws without error', () => {
        pipeline.reset();
        pipeline.setCameraOffset(new Vector2i(100, 50));
        expect(() => {
            pipeline.drawRectFill(new Rect2i(0, 0, 10, 10), Color32.red());
            pipeline.encodePass(createMockRenderPassEncoder());
        }).not.toThrow();
        pipeline.setCameraOffset(Vector2i.zero());
    });
});

// #endregion

// #region Vertex Count Verification

describe('vertex count verification', () => {
    const device = createMockGPUDevice();
    const pipeline = new PrimitivePipeline();

    beforeAll(async () => {
        installMockNavigatorGPU();
        await pipeline.initialize(device, new Vector2i(320, 240));
    });

    afterAll(() => {
        uninstallMockNavigatorGPU();
    });

    it('drawRectFill produces 6 vertices (two triangles)', () => {
        pipeline.reset();
        pipeline.drawRectFill(new Rect2i(0, 0, 10, 10), Color32.red());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(totalVertices).toBe(6);
    });

    it('drawPixel produces 6 vertices (1x1 filled rect)', () => {
        pipeline.reset();
        pipeline.drawPixel(new Vector2i(5, 5), Color32.green());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(totalVertices).toBe(6);
    });

    it('horizontal line uses a single quad (6 vertices)', () => {
        pipeline.reset();
        pipeline.drawLine(new Vector2i(0, 10), new Vector2i(100, 10), Color32.white());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(totalVertices).toBe(6);
    });

    it('vertical line uses a single quad (6 vertices)', () => {
        pipeline.reset();
        pipeline.drawLine(new Vector2i(10, 0), new Vector2i(10, 50), Color32.white());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(totalVertices).toBe(6);
    });

    it('diagonal line uses 6 vertices per pixel (Bresenham)', () => {
        pipeline.reset();
        // A 45-degree diagonal from (0,0) to (4,4) = 5 pixels
        pipeline.drawLine(new Vector2i(0, 0), new Vector2i(4, 4), Color32.white());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(totalVertices).toBe(5 * 6); // 5 pixels * 6 vertices each
    });

    it('drawRect with height <= 2 skips vertical side lines', () => {
        pipeline.reset();
        // height=2 means y1-y0 = 1, which is NOT > 1, so no vertical sides
        pipeline.drawRect(new Rect2i(0, 0, 10, 2), Color32.red());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        // Only top + bottom lines = 2 quads = 12 vertices (no left/right)
        expect(totalVertices).toBe(12);
    });

    it('drawRect with height > 2 includes all four sides', () => {
        pipeline.reset();
        pipeline.drawRect(new Rect2i(0, 0, 10, 10), Color32.red());

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        // 4 sides = 4 quads = 24 vertices
        expect(totalVertices).toBe(24);
    });

    it('drawText produces 6 vertices per character', () => {
        pipeline.reset();
        pipeline.drawText(new Vector2i(0, 0), Color32.white(), 'Hi');

        let totalVertices = 0;
        const renderPass = {
            ...createMockRenderPassEncoder(),
            draw: (vertexCount: number) => {
                totalVertices += vertexCount;
            },
        } as unknown as GPURenderPassEncoder;

        pipeline.encodePass(renderPass);
        expect(totalVertices).toBe(2 * 6); // 2 characters * 6 vertices each
    });

    it('buffer overflow triggers console.warn and does not crash', () => {
        pipeline.reset();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            // Fill buffer: 50000 max vertices, each drawRectFill uses 6 vertices
            // ~8333 rects fill the buffer; drawing more should trigger warn
            for (let i = 0; i < 8400; i++) {
                pipeline.drawRectFill(new Rect2i(0, 0, 1, 1), Color32.white());
            }

            expect(warnSpy).toHaveBeenCalled();
            const msg = warnSpy.mock.calls.find((c) => String(c[0]).includes('capacity exceeded'));
            expect(msg).toBeDefined();

            // encodePass should still work without crashing
            expect(() => {
                pipeline.encodePass(createMockRenderPassEncoder());
            }).not.toThrow();
        } finally {
            warnSpy.mockRestore();
        }
    });
});

// #endregion
