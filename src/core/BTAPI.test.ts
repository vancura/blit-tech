import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createMockGPUCanvasContext,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import type { BitmapFont } from '../assets/BitmapFont';
import type { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { BTAPI } from './BTAPI';
import type { IBlitTechDemo } from './IBlitTechDemo';

// #region Helpers

function resetSingleton(): void {
    // BTAPI._instance is private; the cast is intentional — there is no public
    // reset API and this is the least-invasive way to isolate singleton state
    // between tests without modifying production code.
    (BTAPI as unknown as { _instance: BTAPI | null })._instance = null;
}

function makeMockDemo(targetFPS = 60, initResult = true): IBlitTechDemo {
    return {
        queryHardware: vi.fn().mockReturnValue({
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            targetFPS,
        }),
        initialize: vi.fn().mockResolvedValue(initResult),
        update: vi.fn(),
        render: vi.fn(),
    };
}

function makeMockCanvas(): HTMLCanvasElement {
    return {
        width: 0,
        height: 0,
        style: { width: '', height: '' },
        getContext: (type: string) => (type === 'webgpu' ? createMockGPUCanvasContext() : null),
    } as unknown as HTMLCanvasElement;
}

// #endregion

describe('BTAPI', () => {
    beforeEach(() => {
        resetSingleton();
        vi.resetAllMocks();
        vi.stubGlobal('requestAnimationFrame', vi.fn());
        installMockNavigatorGPU();
    });

    afterEach(() => {
        resetSingleton();
        uninstallMockNavigatorGPU();
        vi.unstubAllGlobals();
    });

    // #region Version constants

    describe('version constants', () => {
        it('should expose VERSION_MAJOR as a number', () => {
            expect(typeof BTAPI.VERSION_MAJOR).toBe('number');
        });

        it('should expose VERSION_MINOR as a number', () => {
            expect(typeof BTAPI.VERSION_MINOR).toBe('number');
        });

        it('should expose VERSION_PATCH as a number', () => {
            expect(typeof BTAPI.VERSION_PATCH).toBe('number');
        });
    });

    // #endregion

    // #region Singleton

    describe('singleton', () => {
        it('should return the same instance on multiple accesses', () => {
            const a = BTAPI.instance;
            const b = BTAPI.instance;
            expect(a).toBe(b);
        });

        it('should create a new instance after singleton reset', () => {
            const a = BTAPI.instance;
            resetSingleton();
            const b = BTAPI.instance;
            expect(a).not.toBe(b);
        });
    });

    // #endregion

    // #region Pre-init null-state accessors

    describe('pre-initialization accessors', () => {
        it('getTicks should return 0 before init', () => {
            expect(BTAPI.instance.getTicks()).toBe(0);
        });

        it('resetTicks should not throw before init', () => {
            expect(() => BTAPI.instance.resetTicks()).not.toThrow();
        });

        it('getDevice should return null before init', () => {
            expect(BTAPI.instance.getDevice()).toBeNull();
        });

        it('getContext should return null before init', () => {
            expect(BTAPI.instance.getContext()).toBeNull();
        });

        it('getCanvas should return null before init', () => {
            expect(BTAPI.instance.getCanvas()).toBeNull();
        });

        it('getRenderer should return null before init', () => {
            expect(BTAPI.instance.getRenderer()).toBeNull();
        });

        it('getHardwareSettings should return null before init', () => {
            expect(BTAPI.instance.getHardwareSettings()).toBeNull();
        });

        it('getCameraOffset should return a zero vector before init', () => {
            const offset = BTAPI.instance.getCameraOffset();
            expect(offset.x).toBe(0);
            expect(offset.y).toBe(0);
        });
    });

    // #endregion

    // #region Pre-init no-ops

    describe('pre-initialization drawing no-ops', () => {
        it('stop should not throw before init', () => {
            expect(() => BTAPI.instance.stop()).not.toThrow();
        });

        it('setClearColor should not throw before init', () => {
            expect(() => BTAPI.instance.setClearColor(Color32.red())).not.toThrow();
        });

        it('clearRect should not throw before init', () => {
            expect(() => BTAPI.instance.clearRect(Color32.red(), new Rect2i(0, 0, 10, 10))).not.toThrow();
        });

        it('drawPixel should not throw before init', () => {
            expect(() => BTAPI.instance.drawPixel(new Vector2i(0, 0), Color32.red())).not.toThrow();
        });

        it('drawLine should not throw before init', () => {
            expect(() =>
                BTAPI.instance.drawLine(new Vector2i(0, 0), new Vector2i(10, 10), Color32.red()),
            ).not.toThrow();
        });

        it('drawRect should not throw before init', () => {
            expect(() => BTAPI.instance.drawRect(new Rect2i(0, 0, 10, 10), Color32.red())).not.toThrow();
        });

        it('drawRectFill should not throw before init', () => {
            expect(() => BTAPI.instance.drawRectFill(new Rect2i(0, 0, 10, 10), Color32.red())).not.toThrow();
        });

        it('drawText should not throw before init', () => {
            expect(() => BTAPI.instance.drawText(new Vector2i(0, 0), Color32.white(), 'test')).not.toThrow();
        });

        it('drawSprite should not throw before init', () => {
            const mockSheet = {} as unknown as SpriteSheet;
            expect(() =>
                BTAPI.instance.drawSprite(mockSheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0)),
            ).not.toThrow();
        });

        it('drawBitmapText should not throw before init', () => {
            const mockFont = {} as unknown as BitmapFont;
            expect(() => BTAPI.instance.drawBitmapText(mockFont, new Vector2i(0, 0), 'hi')).not.toThrow();
        });

        it('setCameraOffset should not throw before init', () => {
            expect(() => BTAPI.instance.setCameraOffset(new Vector2i(10, 20))).not.toThrow();
        });

        it('resetCamera should not throw before init', () => {
            expect(() => BTAPI.instance.resetCamera()).not.toThrow();
        });
    });

    // #endregion

    // #region initialize()

    describe('initialize', () => {
        it('should return false for NaN targetFPS', async () => {
            const result = await BTAPI.instance.initialize(makeMockDemo(NaN), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return false for zero targetFPS', async () => {
            const result = await BTAPI.instance.initialize(makeMockDemo(0), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return false for negative targetFPS', async () => {
            const result = await BTAPI.instance.initialize(makeMockDemo(-30), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return false when navigator.gpu is absent', async () => {
            uninstallMockNavigatorGPU();
            const result = await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return false when WebGPU adapter is unavailable', async () => {
            Object.defineProperty(globalThis, 'navigator', {
                value: {
                    gpu: {
                        requestAdapter: async () => null,
                        getPreferredCanvasFormat: () => 'bgra8unorm' as GPUTextureFormat,
                    },
                    userAgent: 'test',
                },
                writable: true,
                configurable: true,
            });
            const result = await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return false when renderer initialization fails', async () => {
            // Provide an adapter that returns a device broken for shader compilation.
            Object.defineProperty(globalThis, 'navigator', {
                value: {
                    gpu: {
                        requestAdapter: async () => ({
                            requestDevice: async () => ({
                                createShaderModule: () => {
                                    throw new Error('GPU not available');
                                },
                            }),
                        }),
                        getPreferredCanvasFormat: () => 'bgra8unorm' as GPUTextureFormat,
                    },
                    userAgent: 'test',
                },
                writable: true,
                configurable: true,
            });
            const result = await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return false when demo.initialize() returns false', async () => {
            const result = await BTAPI.instance.initialize(makeMockDemo(60, false), makeMockCanvas());
            expect(result).toBe(false);
        });

        it('should return true and populate accessors on success', async () => {
            const canvas = makeMockCanvas();
            const result = await BTAPI.instance.initialize(makeMockDemo(), canvas);

            expect(result).toBe(true);
            expect(BTAPI.instance.getDevice()).not.toBeNull();
            expect(BTAPI.instance.getContext()).not.toBeNull();
            expect(BTAPI.instance.getCanvas()).toBe(canvas);
            expect(BTAPI.instance.getRenderer()).not.toBeNull();
            expect(BTAPI.instance.getHardwareSettings()).not.toBeNull();
        });

        it('should start the game loop on success', async () => {
            await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());
            expect(requestAnimationFrame).toHaveBeenCalled();
        });

        it('stop should not throw after successful initialization', async () => {
            await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());
            expect(() => BTAPI.instance.stop()).not.toThrow();
        });
    });

    // #endregion
});
