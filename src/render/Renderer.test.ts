import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

// #region Frame Capture

describe('frame capture', () => {
    it('captureFrame returns a promise', async () => {
        const device = createMockGPUDevice();
        const context = createMockGPUCanvasContext();
        const renderer = new Renderer(device, context, new Vector2i(320, 240));

        installMockNavigatorGPU();
        await renderer.initialize();

        const promise = renderer.captureFrame();
        expect(promise).toBeInstanceOf(Promise);

        uninstallMockNavigatorGPU();
    });

    it('endFrame triggers capture when pending', async () => {
        const copyTextureToBufferFn = vi.fn();
        const device = createMockGPUDevice();

        // Override createCommandEncoder to include copyTextureToBuffer.
        const originalCreate = device.createCommandEncoder.bind(device);
        vi.spyOn(device, 'createCommandEncoder').mockImplementation(() => {
            const encoder = originalCreate();
            (encoder as unknown as Record<string, unknown>).copyTextureToBuffer = copyTextureToBufferFn;

            return encoder;
        });

        const context = createMockGPUCanvasContext();
        const renderer = new Renderer(device, context, new Vector2i(4, 4));

        installMockNavigatorGPU();
        await renderer.initialize();

        // Stub browser APIs for PNG conversion.
        vi.stubGlobal(
            'ImageData',
            class MockImageData {
                constructor(
                    public data: Uint8ClampedArray,
                    public width: number,
                    public height: number,
                ) {}
            },
        );

        vi.stubGlobal(
            'OffscreenCanvas',
            class MockOffscreenCanvas {
                getContext(): { putImageData: ReturnType<typeof vi.fn> } {
                    return { putImageData: vi.fn() };
                }
                async convertToBlob(): Promise<Blob> {
                    return new Blob(['test'], { type: 'image/png' });
                }
            },
        );

        const capturePromise = renderer.captureFrame();

        renderer.beginFrame();
        renderer.endFrame();

        const blob = await capturePromise;

        expect(copyTextureToBufferFn).toHaveBeenCalledOnce();
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('image/png');

        vi.unstubAllGlobals();
        uninstallMockNavigatorGPU();
    });

    it('endFrame does not call copyTextureToBuffer without pending capture', async () => {
        const copyTextureToBufferFn = vi.fn();
        const device = createMockGPUDevice();

        const originalCreate = device.createCommandEncoder.bind(device);
        vi.spyOn(device, 'createCommandEncoder').mockImplementation(() => {
            const encoder = originalCreate();
            (encoder as unknown as Record<string, unknown>).copyTextureToBuffer = copyTextureToBufferFn;

            return encoder;
        });

        const context = createMockGPUCanvasContext();
        const renderer = new Renderer(device, context, new Vector2i(320, 240));

        installMockNavigatorGPU();
        await renderer.initialize();

        renderer.beginFrame();
        renderer.endFrame();

        expect(copyTextureToBufferFn).not.toHaveBeenCalled();

        uninstallMockNavigatorGPU();
    });
});

// #endregion

// #region Error Paths

describe('endFrame error paths', () => {
    it('recovers gracefully when getCurrentTexture throws', async () => {
        const device = createMockGPUDevice();
        const throwingContext = {
            ...createMockGPUCanvasContext(),
            getCurrentTexture: () => {
                throw new Error('Context lost');
            },
        } as unknown as GPUCanvasContext;

        const renderer = new Renderer(device, throwingContext, new Vector2i(320, 240));
        installMockNavigatorGPU();
        await renderer.initialize();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            renderer.beginFrame();
            renderer.drawRectFill(new Rect2i(0, 0, 10, 10), Color32.red());
            expect(() => {
                renderer.endFrame();
            }).not.toThrow();

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to get current texture'),
                expect.any(Error),
            );

            // Should be able to start a new frame after error
            expect(() => {
                renderer.beginFrame();
            }).not.toThrow();
        } finally {
            errorSpy.mockRestore();
            uninstallMockNavigatorGPU();
        }
    });

    it('skips frame when texture has zero dimensions', async () => {
        const device = createMockGPUDevice();
        const zeroTextureContext = {
            ...createMockGPUCanvasContext(),
            getCurrentTexture: () => ({
                width: 0,
                height: 0,
                createView: () => ({ label: 'MockView' }),
            }),
        } as unknown as GPUCanvasContext;

        const renderer = new Renderer(device, zeroTextureContext, new Vector2i(320, 240));
        installMockNavigatorGPU();
        await renderer.initialize();

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            renderer.beginFrame();
            expect(() => {
                renderer.endFrame();
            }).not.toThrow();

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('zero dimensions'));
        } finally {
            warnSpy.mockRestore();
            uninstallMockNavigatorGPU();
        }
    });
});

describe('initialize error paths', () => {
    it('returns false when pipeline creation throws', async () => {
        const throwingDevice = {
            ...createMockGPUDevice(),
            createShaderModule: () => {
                throw new Error('Shader compilation failed');
            },
        } as unknown as GPUDevice;

        const renderer = new Renderer(throwingDevice, createMockGPUCanvasContext(), new Vector2i(320, 240));
        installMockNavigatorGPU();

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const result = await renderer.initialize();
            expect(result).toBe(false);
            expect(errorSpy).toHaveBeenCalled();
        } finally {
            errorSpy.mockRestore();
            uninstallMockNavigatorGPU();
        }
    });
});

// #endregion
