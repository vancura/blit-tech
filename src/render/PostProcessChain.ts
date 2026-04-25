import type { Vector2i } from '../utils/Vector2i';
import type { Effect } from './effects/Effect';

// #region Configuration

/**
 * Texture usage flags for offscreen color targets.
 *
 * `RENDER_ATTACHMENT` allows the scene to draw into the texture.
 * `TEXTURE_BINDING` allows post-process effects to sample from it.
 */
const OFFSCREEN_USAGE = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

// #endregion

/**
 * Stackable post-processing effect chain that runs between the scene render
 * pass and swap-chain present.
 *
 * The chain owns the offscreen color texture(s) and the shared sampler that
 * effects sample from. Resources are allocated lazily: nothing is touched on
 * the GPU until an effect is added, and everything is destroyed when the chain
 * empties via {@link clear} or the last {@link remove}.
 *
 * Texture model:
 * - Zero effects: no textures allocated, {@link isActive} returns `false`.
 * - One effect: only `texA` exists. The scene renders into `texA`; the effect
 *   samples `texA` and writes directly to the swap-chain view.
 * - N >= 2 effects: `texB` is also allocated. The scene renders into `texA`;
 *   intermediate effects ping-pong between `texA` and `texB`; the final effect
 *   writes to the swap-chain view regardless of which buffer it sampled from.
 *
 * Effect ordering is the order of {@link add} calls.
 */
export class PostProcessChain {
    // #region State

    /** WebGPU device used for resource creation. */
    private readonly device: GPUDevice;

    /** Swap-chain color format; offscreen textures match for one shared pipeline per effect. */
    private readonly format: GPUTextureFormat;

    /** Source render resolution in pixels. */
    private readonly displaySize: Vector2i;

    /** Effects in execution order. */
    private effects: Effect[] = [];

    /** Primary offscreen color attachment, allocated on first {@link add}. */
    private texA: GPUTexture | null = null;

    /** Cached view for {@link texA}, regenerated when the texture is recreated. */
    private texAView: GPUTextureView | null = null;

    /**
     * Secondary offscreen color attachment for chains with two or more effects.
     * Allocated lazily on the second {@link add}.
     */
    private texB: GPUTexture | null = null;

    /** Cached view for {@link texB}, regenerated when the texture is recreated. */
    private texBView: GPUTextureView | null = null;

    // #endregion

    // #region Constructor

    /**
     * Creates a chain bound to a device, swap-chain format, and display size.
     *
     * No GPU resources are created until the first effect is registered.
     *
     * @param device - WebGPU device used for resource creation.
     * @param format - Swap-chain color format. Offscreen textures use the same
     *   format so each effect can share one render pipeline across passes.
     * @param displaySize - Source render target resolution in pixels.
     */
    constructor(device: GPUDevice, format: GPUTextureFormat, displaySize: Vector2i) {
        this.device = device;
        this.format = format;
        this.displaySize = displaySize.clone();
    }

    // #endregion

    // #region Public API

    /**
     * Returns `true` when at least one effect is registered.
     *
     * The renderer uses this to decide whether to route the scene render into
     * an offscreen texture instead of the swap chain.
     *
     * @returns `true` when the chain has at least one effect.
     */
    isActive(): boolean {
        return this.effects.length > 0;
    }

    /**
     * Registers an effect at the end of the chain.
     *
     * The effect's {@link Effect.init} is called immediately. GPU resources for
     * the chain itself are allocated lazily here: {@link texA} and the shared
     * sampler on the first call, {@link texB} on the second.
     *
     * @param effect - Effect to append to the chain.
     */
    add(effect: Effect): void {
        if (this.effects.length === 0) {
            this.allocatePrimary();
        } else if (this.effects.length === 1) {
            this.allocateSecondary();
        }

        effect.init(this.device, this.format, this.displaySize);
        this.effects = [...this.effects, effect];
    }

    /**
     * Removes a previously registered effect.
     *
     * Calls the effect's {@link Effect.dispose} hook if defined. When the last
     * effect is removed, the offscreen textures are destroyed and the chain
     * reverts to its inactive state.
     *
     * Removing an effect that was never added is a no-op.
     *
     * @param effect - Effect instance to remove.
     */
    remove(effect: Effect): void {
        const index = this.effects.indexOf(effect);

        if (index === -1) {
            return;
        }

        effect.dispose?.();
        this.effects = [...this.effects.slice(0, index), ...this.effects.slice(index + 1)];

        if (this.effects.length === 0) {
            this.releaseTextures();
        }
    }

    /**
     * Removes every registered effect and destroys all offscreen textures.
     *
     * Disposes each effect in registration order. After this call the chain is
     * inactive again and a subsequent {@link add} will reallocate textures
     * from scratch.
     */
    clear(): void {
        if (this.effects.length === 0) {
            return;
        }

        for (const effect of this.effects) {
            effect.dispose?.();
        }

        this.effects = [];
        this.releaseTextures();
    }

    /**
     * Returns the texture view the renderer should use as the scene's color
     * attachment when {@link isActive} is `true`.
     *
     * The same view is returned across consecutive frames until the chain is
     * cleared or disposed; the renderer can cache it without invalidation
     * tracking.
     *
     * @returns Stable view of the chain's primary offscreen color texture.
     * @throws If the chain is inactive (no effects registered).
     */
    getSceneTargetView(): GPUTextureView {
        if (!this.texAView) {
            throw new Error('PostProcessChain: getSceneTargetView() called with no active post-process effects.');
        }

        return this.texAView;
    }

    /**
     * Encodes the post-process passes for this frame.
     *
     * Walks the effect chain in registration order:
     *
     * - Single-effect chain: source = `texA`, dest = `swapChainView` (one pass,
     *   no ping-pong, no extra blit).
     * - Multi-effect chain: each pass reads from the previous pass's output and
     *   writes into the other offscreen texture; the **last** pass always
     *   writes to `swapChainView`.
     *
     * Each effect's {@link Effect.updateUniforms} is called immediately before
     * its {@link Effect.encodePass}.
     *
     * No-op when no effects are registered.
     *
     * @param encoder - Active command encoder.
     * @param deltaMs - Wall-clock milliseconds since the previous frame.
     * @param swapChainView - View of the swap-chain texture; the final effect
     *   writes to this view.
     */
    encode(encoder: GPUCommandEncoder, deltaMs: number, swapChainView: GPUTextureView): void {
        if (this.effects.length === 0 || !this.texAView) {
            return;
        }

        let read: GPUTextureView = this.texAView;
        const effectCount = this.effects.length;

        for (let i = 0; i < effectCount; i++) {
            const isLast = i === effectCount - 1;
            const write: GPUTextureView = isLast ? swapChainView : this.pickOffscreenView(read);
            // Safe: bounds checked by loop variable; the read makes the array
            // entry non-null for tsc. Index is a loop counter, not user input.
            // eslint-disable-next-line security/detect-object-injection
            const effect = this.effects[i] as Effect;

            effect.updateUniforms(deltaMs, this.displaySize);
            effect.encodePass(encoder, read, write);

            read = write;
        }
    }

    /**
     * Releases every GPU resource owned by the chain.
     *
     * Disposes each registered effect, destroys the offscreen textures, and
     * empties the effect list. Safe to call multiple times.
     */
    dispose(): void {
        this.clear();
    }

    // #endregion

    // #region Private Helpers

    /** Allocates {@link texA}. */
    private allocatePrimary(): void {
        this.texA = this.device.createTexture({
            label: 'PostProcessChain texA',
            size: { width: this.displaySize.x, height: this.displaySize.y, depthOrArrayLayers: 1 },
            format: this.format,
            usage: OFFSCREEN_USAGE,
        });
        this.texAView = this.texA.createView();
    }

    /** Allocates {@link texB} for chains with two or more effects. */
    private allocateSecondary(): void {
        this.texB = this.device.createTexture({
            label: 'PostProcessChain texB',
            size: { width: this.displaySize.x, height: this.displaySize.y, depthOrArrayLayers: 1 },
            format: this.format,
            usage: OFFSCREEN_USAGE,
        });
        this.texBView = this.texB.createView();
    }

    /**
     * Returns the ping-pong partner of the supplied source view.
     *
     * `texAView` partners with `texBView`; called only on multi-effect chains
     * where `texBView` is guaranteed to be allocated.
     *
     * @param read - View currently being sampled by the effect.
     * @returns The opposite offscreen view to write into next.
     */
    private pickOffscreenView(read: GPUTextureView): GPUTextureView {
        if (!this.texBView || !this.texAView) {
            throw new Error('PostProcessChain.encode: ping-pong texture not allocated.');
        }
        return read === this.texAView ? this.texBView : this.texAView;
    }

    /** Destroys both offscreen textures and clears their cached views. */
    private releaseTextures(): void {
        this.texA?.destroy();
        this.texB?.destroy();
        this.texA = null;
        this.texB = null;
        this.texAView = null;
        this.texBView = null;
    }

    // #endregion
}
