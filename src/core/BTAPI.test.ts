/**
 * Unit tests for {@link BTAPI}.
 *
 * Covers the public engine facade exposed to demos:
 * - singleton lifecycle and version constants
 * - safe accessor behavior before initialization
 * - no-op drawing and camera APIs before renderer setup
 * - initialization failure cases for invalid hardware settings and WebGPU setup
 * - successful initialization, accessor population, and loop startup
 *
 * The suite isolates global browser and singleton state with WebGPU mocks,
 * stubbed animation-frame scheduling, and per-test singleton reset helpers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createMockGPUCanvasContext,
    installMockNavigatorGPU,
    uninstallMockNavigatorGPU,
} from '../__test__/webgpu-mock';
import type { BitmapFont } from '../assets/BitmapFont';
import { Palette } from '../assets/Palette';
import type { SpriteSheet } from '../assets/SpriteSheet';
import type { Effect } from '../render/effects/Effect';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { BTAPI } from './BTAPI';
import type { IBlitTechDemo } from './IBlitTechDemo';

// #region Helpers

function resetSingleton(): void {
    // BTAPI._instance is private; the cast is intentional — there is no public
    // reset API, and this is the least-invasive way to isolate singleton state
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

        it('getPalette should return null before palette is set', () => {
            expect(BTAPI.instance.getPalette()).toBeNull();
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
            expect(() => BTAPI.instance.setClearColor(1)).not.toThrow();
        });

        it('clearRect should not throw before init', () => {
            expect(() => BTAPI.instance.clearRect(new Rect2i(0, 0, 10, 10), 1)).not.toThrow();
        });

        it('drawPixel should not throw before init', () => {
            expect(() => BTAPI.instance.drawPixel(new Vector2i(0, 0), 2)).not.toThrow();
        });

        it('drawLine should not throw before init', () => {
            expect(() => BTAPI.instance.drawLine(new Vector2i(0, 0), new Vector2i(10, 10), 3)).not.toThrow();
        });

        it('drawRect should not throw before init', () => {
            expect(() => BTAPI.instance.drawRect(new Rect2i(0, 0, 10, 10), 4)).not.toThrow();
        });

        it('drawRectFill should not throw before init', () => {
            expect(() => BTAPI.instance.drawRectFill(new Rect2i(0, 0, 10, 10), 5)).not.toThrow();
        });

        it('drawSystemText should not throw before init', () => {
            expect(() => BTAPI.instance.drawSystemText(new Vector2i(0, 0), 8, 'test')).not.toThrow();
        });

        it('drawSprite should not throw before init', () => {
            const mockSheet = { isIndexized: () => true } as unknown as SpriteSheet;
            expect(() =>
                BTAPI.instance.drawSprite(mockSheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0)),
            ).not.toThrow();
        });

        it('drawSprite should throw when sprite sheet is not indexized', () => {
            const mockSheet = { isIndexized: () => false } as unknown as SpriteSheet;
            expect(() => BTAPI.instance.drawSprite(mockSheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0))).toThrow(
                '[BT] drawSprite: sprite sheet has not been indexized.',
            );
        });

        it('drawSprite should register the sheet for spritesRefresh tracking', () => {
            const palette = new Palette(16);
            const reindexize = vi.fn();
            const mockSheet = { isIndexized: () => true, reindexize } as unknown as SpriteSheet;

            BTAPI.instance.setPalette(palette);
            BTAPI.instance.drawSprite(mockSheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));
            BTAPI.instance.spritesRefresh();

            expect(reindexize).toHaveBeenCalledWith(palette);
        });

        it('drawBitmapText should not throw before init', () => {
            const mockSheet = { isIndexized: () => true } as unknown as SpriteSheet;
            const mockFont = { getSpriteSheet: () => mockSheet } as unknown as BitmapFont;
            expect(() => BTAPI.instance.drawBitmapText(mockFont, new Vector2i(0, 0), 'hi')).not.toThrow();
        });

        it('drawBitmapText should throw when font sprite sheet is not indexized', () => {
            const mockSheet = { isIndexized: () => false } as unknown as SpriteSheet;
            const mockFont = { getSpriteSheet: () => mockSheet } as unknown as BitmapFont;
            expect(() => BTAPI.instance.drawBitmapText(mockFont, new Vector2i(0, 0), 'hi')).toThrow(
                '[BT] drawBitmapText: font sprite sheet has not been indexized.',
            );
        });

        it('drawBitmapText should register the font sheet for spritesRefresh tracking', () => {
            const palette = new Palette(16);
            const reindexize = vi.fn();
            const mockSheet = { isIndexized: () => true, reindexize } as unknown as SpriteSheet;
            const mockFont = { getSpriteSheet: () => mockSheet } as unknown as BitmapFont;

            BTAPI.instance.setPalette(palette);
            BTAPI.instance.drawBitmapText(mockFont, new Vector2i(0, 0), 'hi');
            BTAPI.instance.spritesRefresh();

            expect(reindexize).toHaveBeenCalledWith(palette);
        });

        it('setCameraOffset should not throw before init', () => {
            expect(() => BTAPI.instance.setCameraOffset(new Vector2i(10, 20))).not.toThrow();
        });

        it('resetCamera should not throw before init', () => {
            expect(() => BTAPI.instance.resetCamera()).not.toThrow();
        });

        it('setPalette should store the provided palette before init', () => {
            const palette = new Palette(16);

            BTAPI.instance.setPalette(palette);

            expect(BTAPI.instance.getPalette()).toBe(palette);
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
                                    throw new Error("GPU isn't available");
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

        it('captureFrame returns a blob after successful initialization', async () => {
            await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());

            const renderer = BTAPI.instance.getRenderer();

            expect(renderer).not.toBeNull();

            const mockBlob = new Blob(['test'], { type: 'image/png' });

            vi.spyOn(renderer as NonNullable<typeof renderer>, 'captureFrame').mockResolvedValue(mockBlob);

            const result = await BTAPI.instance.captureFrame();

            expect(result).toBe(mockBlob);
        });
    });

    // #endregion

    // #region assertPaletteIndex

    describe('assertPaletteIndex', () => {
        it('throws when index is negative (no palette set)', () => {
            expect(() => BTAPI.instance.drawPixel(new Vector2i(0, 0), -1)).toThrow(
                'is not a valid non-negative integer',
            );
        });

        it('throws when index is out of range for the active palette', () => {
            const palette = new Palette(16);

            BTAPI.instance.setPalette(palette);

            expect(() => BTAPI.instance.drawPixel(new Vector2i(0, 0), 20)).toThrow(
                'Palette index 20 out of range for palette of size 16.',
            );
        });
    });

    // #endregion

    // #region Post-Process Effects API

    describe('post-process effects', () => {
        function makeStubEffect(): Effect {
            return {
                tier: 'pixel',
                init: vi.fn(),
                updateUniforms: vi.fn(),
                encodePass: vi.fn(),
                dispose: vi.fn(),
            };
        }

        it('effectAdd throws before initialize', () => {
            expect(() => BTAPI.instance.effectAdd(makeStubEffect())).toThrow('renderer not initialized');
        });

        it('effectRemove throws before initialize', () => {
            expect(() => BTAPI.instance.effectRemove(makeStubEffect())).toThrow('renderer not initialized');
        });

        it('effectClear throws before initialize', () => {
            expect(() => BTAPI.instance.effectClear()).toThrow('renderer not initialized');
        });

        it('effectAdd / effectClear delegate to the renderer after initialize', async () => {
            await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());

            const renderer = BTAPI.instance.getRenderer();
            expect(renderer).not.toBeNull();

            const addSpy = vi.spyOn(renderer as NonNullable<typeof renderer>, 'addEffect');
            const clearSpy = vi.spyOn(renderer as NonNullable<typeof renderer>, 'clearEffects');

            const effect = makeStubEffect();
            BTAPI.instance.effectAdd(effect);

            expect(addSpy).toHaveBeenCalledWith(effect);

            BTAPI.instance.effectClear();

            expect(clearSpy).toHaveBeenCalled();
        });

        it('effectRemove delegates to the renderer after initialize', async () => {
            await BTAPI.instance.initialize(makeMockDemo(), makeMockCanvas());

            const renderer = BTAPI.instance.getRenderer();
            const removeSpy = vi.spyOn(renderer as NonNullable<typeof renderer>, 'removeEffect');

            const effect = makeStubEffect();
            BTAPI.instance.effectAdd(effect);
            BTAPI.instance.effectRemove(effect);

            expect(removeSpy).toHaveBeenCalledWith(effect);
        });
    });

    // #endregion
});
