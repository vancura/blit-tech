import type { Vector2i } from '../../utils/Vector2i';
import type { Effect } from './Effect';
import { FULLSCREEN_VS_WGSL } from './fullscreenVS';

// #region Configuration

/** Uniform block layout: vec2 resolution + 2 f32 = 16 bytes. */
const UNIFORM_BYTES = 16;

/** Number of f32 slots backing {@link UNIFORM_BYTES}. */
const UNIFORM_FLOATS = UNIFORM_BYTES / 4;

// #endregion

/**
 * Single-pass box-blur bloom ported from the PipBoy bloom shader.
 *
 * Samples a 5x5 neighborhood (25 taps) around each fragment, averages, and
 * mixes with the original color by {@link bloomGlow}. {@link bloomSpread}
 * scales the texel offset so the bloom radius can be tuned independently of
 * the source resolution.
 *
 * The implementation matches the PipBoy reference one-pass box. A future
 * optimisation would be a two-pass separable Gaussian (5 + 5 = 10 taps); add
 * it once a GPU perf test demands it.
 */
export class BloomEffect implements Effect {
    // #region Look (PipBoy reference defaults)

    /** Texel offset multiplier for the box-blur kernel. */
    public bloomSpread: number = 3.0;

    /** Mix factor between the original sample and the blurred neighborhood. */
    public bloomGlow: number = 0.12;

    // #endregion

    // #region GPU State

    private device: GPUDevice | null = null;
    private pipeline: GPURenderPipeline | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private sampler: GPUSampler | null = null;
    private bindGroupLayout: GPUBindGroupLayout | null = null;
    private readonly uniformData = new Float32Array(UNIFORM_FLOATS);
    private readonly bindGroups = new WeakMap<GPUTextureView, GPUBindGroup>();

    // #endregion

    // #region Effect lifecycle

    /**
     * Creates the GPU pipeline, uniform buffer, and sampler.
     *
     * @param device - WebGPU device used for resource creation.
     * @param format - Color attachment format (matches the chain swap chain).
     * @param _displaySize - Source render target resolution. Unused by bloom; the
     *   per-frame `sourceSize` from {@link updateUniforms} drives the texel size.
     */
    init(device: GPUDevice, format: GPUTextureFormat, _displaySize: Vector2i): void {
        this.device = device;

        const module = device.createShaderModule({
            label: 'BloomEffect Shader',
            code: FULLSCREEN_VS_WGSL + BLOOM_FRAGMENT_WGSL,
        });

        this.pipeline = device.createRenderPipeline({
            label: 'BloomEffect Pipeline',
            layout: 'auto',
            vertex: { module, entryPoint: 'vs_main' },
            fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
        });

        this.bindGroupLayout = this.pipeline.getBindGroupLayout(0);

        this.uniformBuffer = device.createBuffer({
            label: 'BloomEffect Uniform Buffer',
            size: UNIFORM_BYTES,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.sampler = device.createSampler({
            label: 'BloomEffect Sampler',
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
    }

    /**
     * Writes the per-frame uniform block (resolution + parameters) to the GPU.
     *
     * @param _deltaMs - Wall-clock milliseconds since the previous frame. Unused.
     * @param sourceSize - Pixel dimensions of the source texture for this pass.
     */
    updateUniforms(_deltaMs: number, sourceSize: Vector2i): void {
        if (!this.device || !this.uniformBuffer) {
            return;
        }

        const u = this.uniformData;

        u[0] = sourceSize.x;
        u[1] = sourceSize.y;
        u[2] = this.bloomSpread;
        u[3] = this.bloomGlow;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, u);
    }

    /**
     * Encodes a single render pass that samples {@link sourceView} and writes the
     * blurred + glow-mixed result into {@link destView}.
     *
     * @param encoder - Active command encoder owned by the renderer.
     * @param sourceView - View of the texture to sample from.
     * @param destView - View of the texture to render into.
     */
    encodePass(encoder: GPUCommandEncoder, sourceView: GPUTextureView, destView: GPUTextureView): void {
        if (!this.pipeline) {
            return;
        }

        const bindGroup = this.getOrCreateBindGroup(sourceView);
        const pass = encoder.beginRenderPass({
            label: 'BloomEffect Pass',
            colorAttachments: [
                {
                    view: destView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3, 1, 0, 0);
        pass.end();
    }

    /**
     * Destroys the uniform buffer and clears references to GPU resources.
     * Safe to call multiple times.
     */
    dispose(): void {
        this.uniformBuffer?.destroy();
        this.uniformBuffer = null;
        this.pipeline = null;
        this.bindGroupLayout = null;
        this.sampler = null;
        this.device = null;
    }

    // #endregion

    // #region Private Helpers

    /**
     * Returns the bind group for the supplied source view, creating one on
     * first use and caching by view identity for subsequent frames.
     *
     * @param sourceView - View of the source texture to sample.
     * @returns Cached or newly created bind group bound to {@link sourceView}.
     */
    private getOrCreateBindGroup(sourceView: GPUTextureView): GPUBindGroup {
        const cached = this.bindGroups.get(sourceView);

        if (cached) {
            return cached;
        }

        if (!this.device || !this.bindGroupLayout || !this.uniformBuffer || !this.sampler) {
            throw new Error('BloomEffect.encodePass: effect was not initialized.');
        }

        const bindGroup = this.device.createBindGroup({
            label: 'BloomEffect Bind Group',
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: sourceView },
                { binding: 2, resource: this.sampler },
            ],
        });

        this.bindGroups.set(sourceView, bindGroup);

        return bindGroup;
    }

    // #endregion
}

// #region WGSL fragment shader

const BLOOM_FRAGMENT_WGSL = `
struct Params {
    resolution: vec2<f32>,
    bloomSpread: f32,
    bloomGlow: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let texelSize = vec2<f32>(1.0) / params.resolution;
    var sum = vec4<f32>(0.0);

    // 5x5 box: 25 taps. Constant unroll keeps the GPU branch predictor happy.
    for (var x: i32 = -2; x <= 2; x = x + 1) {
        for (var y: i32 = -2; y <= 2; y = y + 1) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize * params.bloomSpread;
            sum = sum + textureSample(src, samp, in.uv + offset);
        }
    }

    sum = sum / 25.0;

    let orig = textureSample(src, samp, in.uv);
    return orig + (sum - orig) * params.bloomGlow;
}
`;

// #endregion
