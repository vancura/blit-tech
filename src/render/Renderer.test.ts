import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    createMockGPUCanvasContext,
    createMockGPUDevice,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { Renderer } from './Renderer';

// #region Constructor

describe('Renderer constructor', () => {
    it('creates an instance with mock objects', () => {
        const device = createMockGPUDevice();
        const context = createMockGPUCanvasContext();
        const displaySize = new Vector2i(320, 240);

        const renderer = new Renderer(device, context, displaySize);
        expect(renderer).toBeDefined();
        expect(renderer).toBeInstanceOf(Renderer);
    });
});

// #endregion

// #region Pre-initialization Methods

describe('pre-initialization methods', () => {
    it('setClearColor does not throw', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        expect(() => {
            renderer.setClearColor(Color32.blue());
        }).not.toThrow();
    });

    it('setCameraOffset does not throw', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        expect(() => {
            renderer.setCameraOffset(new Vector2i(10, 20));
        }).not.toThrow();
    });

    it('getCameraOffset returns a zero vector initially', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        const offset = renderer.getCameraOffset();
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(0);
    });

    it('resetCamera sets camera back to zero', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        renderer.setCameraOffset(new Vector2i(50, 75));
        renderer.resetCamera();
        const offset = renderer.getCameraOffset();
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(0);
    });

    it('beginFrame does not throw before initialize', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        expect(() => {
            renderer.beginFrame();
        }).not.toThrow();
    });
});

// #endregion

// #region Camera

describe('camera operations', () => {
    it('getCameraOffset returns a copy, not the internal reference', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        renderer.setCameraOffset(new Vector2i(42, 84));
        const offset = renderer.getCameraOffset();
        expect(offset.x).toBe(42);
        expect(offset.y).toBe(84);

        // Modifying the returned copy should not change the internal state.
        offset.set(999, 999);
        const offsetAgain = renderer.getCameraOffset();
        expect(offsetAgain.x).toBe(42);
        expect(offsetAgain.y).toBe(84);
    });

    it('setCameraOffset stores the offset correctly', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        renderer.setCameraOffset(new Vector2i(100, 200));
        const offset = renderer.getCameraOffset();
        expect(offset.x).toBe(100);
        expect(offset.y).toBe(200);
    });

    it('setCameraOffset clones the input vector', () => {
        const renderer = new Renderer(createMockGPUDevice(), createMockGPUCanvasContext(), new Vector2i(320, 240));
        const input = new Vector2i(30, 60);
        renderer.setCameraOffset(input);

        // Modifying the input vector should not affect the renderer.
        input.set(999, 999);
        const offset = renderer.getCameraOffset();
        expect(offset.x).toBe(30);
        expect(offset.y).toBe(60);
    });
});

// #endregion

// #region Initialized Renderer

describe('with initialized renderer', () => {
    const device = createMockGPUDevice();
    const context = createMockGPUCanvasContext();
    const displaySize = new Vector2i(320, 240);
    const renderer = new Renderer(device, context, displaySize);

    beforeAll(async () => {
        installMockNavigatorGPU();
        const result = await renderer.initialize();
        expect(result).toBe(true);
    });

    afterAll(() => {
        uninstallMockNavigatorGPU();
    });

    it('initialize returns true on success', async () => {
        const r = new Renderer(device, context, displaySize);
        installMockNavigatorGPU();
        const result = await r.initialize();
        expect(result).toBe(true);
    });

    it('endFrame completes without error', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.endFrame();
        }).not.toThrow();
    });

    it('beginFrame + endFrame cycle works', () => {
        expect(() => {
            renderer.beginFrame();
            renderer.endFrame();
        }).not.toThrow();
    });

    it('multiple frame cycles work without error', () => {
        expect(() => {
            for (let i = 0; i < 5; i++) {
                renderer.beginFrame();
                renderer.endFrame();
            }
        }).not.toThrow();
    });

    it('drawPixel delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.drawPixel(new Vector2i(10, 10), Color32.red());
        }).not.toThrow();
        renderer.endFrame();
    });

    it('drawPixelXY delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.drawPixelXY(15, 25, Color32.green());
        }).not.toThrow();
        renderer.endFrame();
    });

    it('drawRectFill delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.drawRectFill(new Rect2i(5, 5, 20, 20), Color32.blue());
        }).not.toThrow();
        renderer.endFrame();
    });

    it('drawLine delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.drawLine(new Vector2i(0, 0), new Vector2i(50, 50), Color32.yellow());
        }).not.toThrow();
        renderer.endFrame();
    });

    it('drawRect delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.drawRect(new Rect2i(10, 10, 30, 30), Color32.cyan());
        }).not.toThrow();
        renderer.endFrame();
    });

    it('clearRect delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.clearRect(Color32.black(), new Rect2i(0, 0, 320, 240));
        }).not.toThrow();
        renderer.endFrame();
    });

    it('drawText delegates without throwing', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.drawText(new Vector2i(10, 10), Color32.white(), 'Test');
        }).not.toThrow();
        renderer.endFrame();
    });

    it('setClearColor works within a frame', () => {
        renderer.beginFrame();
        expect(() => {
            renderer.setClearColor(new Color32(64, 128, 192, 255));
        }).not.toThrow();
        renderer.endFrame();
    });

    it('camera operations work within a frame cycle', () => {
        renderer.beginFrame();
        renderer.setCameraOffset(new Vector2i(50, 50));
        renderer.drawRectFill(new Rect2i(0, 0, 10, 10), Color32.red());
        renderer.resetCamera();
        expect(() => {
            renderer.endFrame();
        }).not.toThrow();
    });
});

// #endregion
