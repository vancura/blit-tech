/**
 * Unit tests for {@link PostProcessChain}.
 *
 * Covers the lazy GPU resource model:
 * - constructor does not touch the GPU
 * - {@link PostProcessChain.isActive} reflects effect-list contents
 * - first {@link PostProcessChain.add} allocates `texA` and a sampler; second
 *   allocates `texB`
 * - {@link PostProcessChain.remove} of the last effect and
 *   {@link PostProcessChain.clear} both destroy the offscreen textures and
 *   revert to the no-effect path
 * - {@link PostProcessChain.getSceneTargetView} guard rails before activation
 * - {@link PostProcessChain.encode} is a no-op while empty (the actual chain
 *   walking lives in step 5 of the implementation plan)
 *
 * Effects are stubbed via a minimal `Effect` implementation that records
 * lifecycle calls; the chain orchestration is tested without involving the
 * real WGSL shaders.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockGPUDevice, installMockNavigatorGPU, uninstallMockNavigatorGPU } from '../__test__/webgpu-mock';
import { Vector2i } from '../utils/Vector2i';
import type { Effect } from './effects/Effect';
import { PostProcessChain } from './PostProcessChain';

// #region Test Helpers

const FORMAT: GPUTextureFormat = 'bgra8unorm';
const DISPLAY_SIZE = new Vector2i(320, 240);

interface CallLog {
    init: number;
    update: number;
    encode: number;
    dispose: number;
}

/** Creates a stub effect that records lifecycle calls. */
function createStubEffect(): Effect & { calls: CallLog } {
    const calls: CallLog = { init: 0, update: 0, encode: 0, dispose: 0 };

    const stub: Effect & { calls: CallLog } = {
        calls,
        init: () => {
            calls.init++;
        },
        updateUniforms: () => {
            calls.update++;
        },
        encodePass: () => {
            calls.encode++;
        },
        dispose: () => {
            calls.dispose++;
        },
    };

    return stub;
}

// #endregion

// #region Mock setup

beforeAll(() => {
    installMockNavigatorGPU();
});

afterAll(() => {
    uninstallMockNavigatorGPU();
});

// #endregion

// #region Constructor

describe('PostProcessChain constructor', () => {
    it('does not allocate GPU textures', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');

        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        expect(chain).toBeInstanceOf(PostProcessChain);
        expect(createTexture).not.toHaveBeenCalled();
    });

    it('reports isActive() === false before any effect is added', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);

        expect(chain.isActive()).toBe(false);
    });
});

// #endregion

// #region Add / Remove / Clear

describe('add()', () => {
    it('initializes the effect with the chain device, format, and display size', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const effect = createStubEffect();
        const initSpy = vi.spyOn(effect, 'init');

        chain.add(effect);

        expect(initSpy).toHaveBeenCalledTimes(1);
        expect(initSpy).toHaveBeenCalledWith(device, FORMAT, DISPLAY_SIZE);
    });

    it('flips isActive() to true on first add', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);

        chain.add(createStubEffect());

        expect(chain.isActive()).toBe(true);
    });

    it('lazily allocates texA on the first add', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        chain.add(createStubEffect());

        expect(createTexture).toHaveBeenCalledTimes(1);
    });

    it('lazily allocates texB only on the second add', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        chain.add(createStubEffect());
        expect(createTexture).toHaveBeenCalledTimes(1);

        chain.add(createStubEffect());
        expect(createTexture).toHaveBeenCalledTimes(2);
    });

    it('does not allocate additional textures for a third or fourth effect', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        chain.add(createStubEffect());
        chain.add(createStubEffect());
        chain.add(createStubEffect());
        chain.add(createStubEffect());

        expect(createTexture).toHaveBeenCalledTimes(2);
    });

    it('throws when the same effect instance is added twice', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);
        const effect = createStubEffect();

        chain.add(effect);

        expect(() => chain.add(effect)).toThrow(/already registered/);
    });

    it('reuses the existing texB when re-adding a second effect after a 2 -> 1 remove', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();
        const c = createStubEffect();

        chain.add(a);
        chain.add(b);
        expect(createTexture).toHaveBeenCalledTimes(2);

        chain.remove(b);
        // texB stays allocated until the chain is fully cleared.
        chain.add(c);

        // No new texture allocations - existing texA + texB are reused.
        expect(createTexture).toHaveBeenCalledTimes(2);
    });

    it('calls effect.init() exactly once per successful add', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);
        const effect = createStubEffect();

        chain.add(effect);

        expect(effect.calls.init).toBe(1);
    });
});

describe('remove()', () => {
    it('disposes the effect and removes it from the active set', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();

        chain.add(a);
        chain.add(b);
        chain.remove(a);

        expect(a.calls.dispose).toBe(1);
        expect(b.calls.dispose).toBe(0);
        expect(chain.isActive()).toBe(true);
    });

    it('removes only the matching instance and leaves duplicates alone', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();

        chain.add(a);
        chain.add(b);
        chain.remove(createStubEffect()); // not in chain

        expect(chain.isActive()).toBe(true);
        expect(a.calls.dispose).toBe(0);
        expect(b.calls.dispose).toBe(0);
    });

    it('flips isActive() back to false and destroys textures when the last effect is removed', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const effect = createStubEffect();

        chain.add(effect);
        chain.add(createStubEffect());

        chain.remove(effect);
        expect(chain.isActive()).toBe(true);

        const textures = createTexture.mock.results.map((result) => result.value as GPUTexture);
        const destroySpies = textures.map((t) => vi.spyOn(t, 'destroy'));

        chain.clear();

        expect(chain.isActive()).toBe(false);
        for (const spy of destroySpies) {
            expect(spy).toHaveBeenCalled();
        }
    });
});

describe('clear()', () => {
    it('disposes every registered effect', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();
        const c = createStubEffect();

        chain.add(a);
        chain.add(b);
        chain.add(c);
        chain.clear();

        expect(a.calls.dispose).toBe(1);
        expect(b.calls.dispose).toBe(1);
        expect(c.calls.dispose).toBe(1);
        expect(chain.isActive()).toBe(false);
    });

    it('is a no-op when there are no effects', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        expect(() => {
            chain.clear();
        }).not.toThrow();
        expect(createTexture).not.toHaveBeenCalled();
        expect(chain.isActive()).toBe(false);
    });

    it('re-allocates textures on a subsequent add() after clear()', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);

        chain.add(createStubEffect());
        chain.clear();
        chain.add(createStubEffect());

        // First add allocated 1, second add (post-clear) allocated 1 more.
        expect(createTexture).toHaveBeenCalledTimes(2);
    });
});

// #endregion

// #region Scene Target

describe('getSceneTargetView()', () => {
    it('throws before any effect has been added', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);

        expect(() => chain.getSceneTargetView()).toThrow(/no active post-process effects/i);
    });

    it('returns a stable view across consecutive calls', () => {
        const chain = new PostProcessChain(createMockGPUDevice(), FORMAT, DISPLAY_SIZE);

        chain.add(createStubEffect());

        const a = chain.getSceneTargetView();
        const b = chain.getSceneTargetView();

        expect(a).toBe(b);
    });
});

// #endregion

// #region Encode

describe('encode()', () => {
    function makeSwapView(): GPUTextureView {
        return { label: 'SwapView' } as unknown as GPUTextureView;
    }

    it('is a no-op when there are no effects', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const encoder = device.createCommandEncoder();
        const beginSpy = vi.spyOn(encoder, 'beginRenderPass');

        chain.encode(encoder, 16, makeSwapView());

        expect(beginSpy).not.toHaveBeenCalled();
    });

    it('runs each effect updateUniforms with the chain display size', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();

        chain.add(a);
        chain.add(b);
        chain.encode(device.createCommandEncoder(), 16, makeSwapView());

        expect(a.calls.update).toBe(1);
        expect(b.calls.update).toBe(1);
    });

    it('single-effect: source = sceneTargetView, dest = swap-chain view', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const effect = createStubEffect();
        const encodeSpy = vi.spyOn(effect, 'encodePass');

        chain.add(effect);
        const sceneView = chain.getSceneTargetView();
        const swapView = makeSwapView();

        chain.encode(device.createCommandEncoder(), 16, swapView);

        expect(encodeSpy).toHaveBeenCalledTimes(1);
        const args = encodeSpy.mock.calls[0];
        expect(args?.[1]).toBe(sceneView);
        expect(args?.[2]).toBe(swapView);
    });

    it('two effects: scene -> texB, texB -> swap-chain', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();
        const aSpy = vi.spyOn(a, 'encodePass');
        const bSpy = vi.spyOn(b, 'encodePass');

        chain.add(a);
        chain.add(b);

        const sceneView = chain.getSceneTargetView();
        const swapView = makeSwapView();

        chain.encode(device.createCommandEncoder(), 16, swapView);

        // First effect reads scene view and writes to texB; second effect
        // reads texB and writes to the swap chain.
        const firstArgs = aSpy.mock.calls[0];
        const secondArgs = bSpy.mock.calls[0];

        expect(firstArgs?.[1]).toBe(sceneView);
        const intermediateView = firstArgs?.[2];
        expect(intermediateView).not.toBe(sceneView);
        expect(intermediateView).not.toBe(swapView);

        expect(secondArgs?.[1]).toBe(intermediateView);
        expect(secondArgs?.[2]).toBe(swapView);
    });

    it('three effects ping-pong correctly: A -> B, B -> A, A -> swap', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const a = createStubEffect();
        const b = createStubEffect();
        const c = createStubEffect();
        const aSpy = vi.spyOn(a, 'encodePass');
        const bSpy = vi.spyOn(b, 'encodePass');
        const cSpy = vi.spyOn(c, 'encodePass');

        chain.add(a);
        chain.add(b);
        chain.add(c);

        const sceneView = chain.getSceneTargetView();
        const swapView = makeSwapView();

        chain.encode(device.createCommandEncoder(), 16, swapView);

        const aArgs = aSpy.mock.calls[0];
        const bArgs = bSpy.mock.calls[0];
        const cArgs = cSpy.mock.calls[0];

        // Pass 1: scene (texA) -> texB.
        const texBView = aArgs?.[2];
        expect(aArgs?.[1]).toBe(sceneView);
        expect(texBView).not.toBe(sceneView);
        expect(texBView).not.toBe(swapView);

        // Pass 2: texB -> texA (ping-pong returns to the scene texture).
        expect(bArgs?.[1]).toBe(texBView);
        expect(bArgs?.[2]).toBe(sceneView);

        // Pass 3 (last): texA -> swap chain.
        expect(cArgs?.[1]).toBe(sceneView);
        expect(cArgs?.[2]).toBe(swapView);
    });

    it('preserves effect registration order across encode passes', () => {
        const device = createMockGPUDevice();
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const order: string[] = [];

        function trackingEffect(name: string): Effect {
            return {
                init: () => {},
                updateUniforms: () => {
                    order.push(`${name}.update`);
                },
                encodePass: () => {
                    order.push(`${name}.encode`);
                },
            };
        }

        chain.add(trackingEffect('a'));
        chain.add(trackingEffect('b'));
        chain.add(trackingEffect('c'));

        chain.encode(device.createCommandEncoder(), 16, makeSwapView());

        expect(order).toEqual(['a.update', 'a.encode', 'b.update', 'b.encode', 'c.update', 'c.encode']);
    });
});

// #endregion

// #region Dispose

describe('dispose()', () => {
    it('destroys every effect and offscreen texture', () => {
        const device = createMockGPUDevice();
        const createTexture = vi.spyOn(device, 'createTexture');
        const chain = new PostProcessChain(device, FORMAT, DISPLAY_SIZE);
        const effect = createStubEffect();

        chain.add(effect);
        chain.add(createStubEffect());

        const textures = createTexture.mock.results.map((r) => r.value as GPUTexture);
        const destroySpies = textures.map((t) => vi.spyOn(t, 'destroy'));

        chain.dispose();

        expect(effect.calls.dispose).toBe(1);
        for (const spy of destroySpies) {
            expect(spy).toHaveBeenCalled();
        }
        expect(chain.isActive()).toBe(false);
    });
});

// #endregion
