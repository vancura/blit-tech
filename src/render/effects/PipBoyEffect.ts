import type { Vector2i } from '../../utils/Vector2i';
import type { Effect } from './Effect';
import { FULLSCREEN_VS_WGSL } from './fullscreenVS';

// #region Configuration

/**
 * Uniform block size in bytes.
 *
 * 19 active fields plus one trailing pad slot, all f32:
 * `vec2<f32>` resolution (8 bytes) + 18 f32 (72 bytes) = 80 bytes. Already a
 * multiple of 16, satisfying the WGSL uniform-buffer stride rule.
 */
const UNIFORM_BYTES = 80;

/** Number of f32 slots backing {@link UNIFORM_BYTES}. */
const UNIFORM_FLOATS = UNIFORM_BYTES / 4;

// #endregion

/**
 * Faux-CRT post-processing effect with a Fallout-PipBoy look.
 *
 * Stacks scanlines, an RGB shadow mask, chromatic aberration, screen
 * curvature, vignette, noise, a moving roll line, and a glitch path that the
 * caller drives via {@link glitchIntensity}, {@link glitchSeed},
 * {@link flickerAmount}, and {@link time}. Every parameter is a plain field on
 * the instance and may be mutated each frame from demo code; defaults match
 * the PipBoy reference snippet.
 *
 * The shader name is `PipBoyEffect` (rather than the more generic
 * `CRTEffect`) so future CRT-flavoured effects with different looks - cgwg,
 * fakelottes, slot-mask, aperture grille - can ship as their own classes
 * without name conflicts.
 *
 * **Attribution**
 *
 * The core CRT helper functions (`fetchPixel` / `dist` / `gaus` / `horz3` /
 * `scan` / `tri` / `warp`) are direct ports of Timothy Lottes's
 * `crt-lottes.glsl` from the
 * [libretro/glsl-shaders](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl)
 * collection. That shader is released into the public domain by the author
 * ("PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes"), so no
 * license restrictions apply downstream.
 *
 * The glitch / flicker / roll-line / chromatic-aberration extensions and the
 * uniform set this implementation replicates come from a community PipBoy
 * fork written for p5.js's `createFilterShader`. The fork's source URL and
 * author are **unknown** to us at the time of writing, and **no license has
 * been confirmed** - the only header it carried was a Fallout-themed
 * "RobCo Industries (Unlicensed Wasteland Fork)" comment, which is character
 * flavour rather than a license grant. Treat the upstream provenance as
 * unverified; do not assume permissive rights for the borrowed extensions
 * until the upstream source and license have been identified.
 *
 * The individual building blocks (hash-based pseudo-random, sin/cos roll
 * line, band-noise glitch shifts, chromatic aberration via offset sampling)
 * are common shader patterns and not original to any one author, but the
 * specific composition here mirrors the PipBoy fork. The Blit-Tech port is
 * original WGSL. If you can identify the upstream fork, please open a PR to
 * add a verifiable author / URL / license header.
 */
export class PipBoyEffect implements Effect {
    // #region Look (PipBoy reference defaults)

    /** Pincushion strength applied to UVs. */
    public screenCurvature: number = 0.02;

    /** Mix amount for the scanline tri-sampler. 0 disables scanlines entirely. */
    public scanLineAmount: number = 0.6;

    /** Negative gaussian falloff parameter for individual scanlines. */
    public scanLineStrength: number = -8.0;

    /** Negative gaussian falloff parameter for sub-pixel sample weighting. */
    public pixelStrength: number = -1.5;

    /** Brightness mix applied by the RGB shadow mask. 0 hides the mask. */
    public maskIntensity: number = 0.1;

    /** Mask cell pitch in pixels. */
    public maskSize: number = 6.0;

    /** Border darkening within each mask cell. */
    public maskBorder: number = 0.5;

    /** Chromatic aberration offset in pixels. */
    public aberration: number = 1.0;

    /** Vignette darkening exponent. Higher = stronger vignette. */
    public vignetteAmount: number = 0.2;

    /** Per-fetch additive noise scale. 0 disables noise. */
    public noiseAmount: number = 0.015;

    /** Horizontal scanline interference amplitude. */
    public interferenceAmount: number = 0.06;

    /** Roll line amplitude. */
    public rollLineAmount: number = 0.1;

    /** Roll line scroll speed (multiplied by {@link time}). */
    public rollSpeed: number = 1.0;

    // #endregion

    // #region Animation (driven by demo code)

    /**
     * Wall-clock seconds for time-driven effects (roll line, noise, glitch).
     * Demos typically set this to `BT.ticks() / BT.fps()`.
     */
    public time: number = 0;

    /**
     * Glitch strength in `[0, 1]`. 0 disables the glitch path entirely.
     * Drive this from a demo-side state machine for animated glitches.
     */
    public glitchIntensity: number = 0;

    /**
     * Per-glitch random seed. Change between glitches to vary the band noise.
     */
    public glitchSeed: number = 0;

    /**
     * Brightness multiplier applied to the final color. 1.0 is unmodulated;
     * lower values darken (use to simulate flicker).
     */
    public flickerAmount: number = 1;

    // #endregion

    // #region GPU State

    private device: GPUDevice | null = null;
    private pipeline: GPURenderPipeline | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private sampler: GPUSampler | null = null;
    private bindGroupLayout: GPUBindGroupLayout | null = null;
    private readonly uniformData = new Float32Array(UNIFORM_FLOATS);

    /**
     * Per-source-view bind group cache. The post-process chain feeds either
     * `texA` or `texB` as the sampled source; both views are stable for the
     * lifetime of the chain so a `WeakMap` keyed by view is safe.
     */
    private readonly bindGroups = new WeakMap<GPUTextureView, GPUBindGroup>();

    // #endregion

    // #region Effect lifecycle

    /**
     * Creates the GPU pipeline, uniform buffer, and sampler.
     *
     * @param device - WebGPU device used for resource creation.
     * @param format - Color attachment format (matches the chain swap chain).
     * @param _displaySize - Source render target resolution. Unused at init; the
     *   per-frame `sourceSize` from {@link updateUniforms} drives the resolution
     *   uniform.
     */
    init(device: GPUDevice, format: GPUTextureFormat, _displaySize: Vector2i): void {
        this.device = device;

        const module = device.createShaderModule({
            label: 'PipBoyEffect Shader',
            code: FULLSCREEN_VS_WGSL + PIPBOY_FRAGMENT_WGSL,
        });

        this.pipeline = device.createRenderPipeline({
            label: 'PipBoyEffect Pipeline',
            layout: 'auto',
            vertex: { module, entryPoint: 'vs_main' },
            fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
        });

        this.bindGroupLayout = this.pipeline.getBindGroupLayout(0);

        this.uniformBuffer = device.createBuffer({
            label: 'PipBoyEffect Uniform Buffer',
            size: UNIFORM_BYTES,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.sampler = device.createSampler({
            label: 'PipBoyEffect Sampler',
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
    }

    /**
     * Writes the per-frame uniform block (resolution + look + animation) to
     * the GPU. Reuses a single backing `Float32Array` to avoid per-frame
     * allocations.
     *
     * @param _deltaMs - Wall-clock milliseconds since the previous frame. Unused;
     *   demos drive {@link time} directly.
     * @param sourceSize - Pixel dimensions of the source texture for this pass.
     */
    updateUniforms(_deltaMs: number, sourceSize: Vector2i): void {
        if (!this.device || !this.uniformBuffer) {
            return;
        }

        const u = this.uniformData;

        // Layout (in f32 slots):
        // 0..1   resolution.xy
        // 2      time
        // 3      glitchIntensity
        // 4      glitchSeed
        // 5      flickerAmount
        // 6      screenCurvature
        // 7      scanLineAmount
        // 8      scanLineStrength
        // 9      pixelStrength
        // 10     maskIntensity
        // 11     maskSize
        // 12     maskBorder
        // 13     aberration
        // 14     vignetteAmount
        // 15     noiseAmount
        // 16     interferenceAmount
        // 17     rollLineAmount
        // 18     rollSpeed
        // 19     pad
        u[0] = sourceSize.x;
        u[1] = sourceSize.y;
        u[2] = this.time;
        u[3] = this.glitchIntensity;
        u[4] = this.glitchSeed;
        u[5] = this.flickerAmount;
        u[6] = this.screenCurvature;
        u[7] = this.scanLineAmount;
        u[8] = this.scanLineStrength;
        u[9] = this.pixelStrength;
        u[10] = this.maskIntensity;
        u[11] = this.maskSize;
        u[12] = this.maskBorder;
        u[13] = this.aberration;
        u[14] = this.vignetteAmount;
        u[15] = this.noiseAmount;
        u[16] = this.interferenceAmount;
        u[17] = this.rollLineAmount;
        u[18] = this.rollSpeed;
        u[19] = 0;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, u);
    }

    /**
     * Encodes the fullscreen CRT pass. Samples {@link sourceView} and writes
     * the post-processed result into {@link destView}.
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
            label: 'PipBoyEffect Pass',
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
            throw new Error('PipBoyEffect.encodePass: effect was not initialized.');
        }

        const bindGroup = this.device.createBindGroup({
            label: 'PipBoyEffect Bind Group',
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

/**
 * Faux-CRT fragment stage. WGSL port of the PipBoy GLSL ES 1.00 shader, whose
 * core helpers (`fetchPixel` / `dist` / `gaus` / `horz3` / `scan` / `tri` /
 * `warp`) trace back to Timothy Lottes's public-domain `crt-lottes.glsl`.
 * See the {@link PipBoyEffect} class JSDoc for full attribution.
 *
 * GLSL → WGSL conversions worth flagging:
 *  - `texture2D(src, uv)` becomes `textureSample(src, samp, uv)`; only valid
 *    in fragment.
 *  - `vec2/vec3/vec4` become `vec2<f32>/vec3<f32>/vec4<f32>`.
 *  - `mod(a, b)` differs from `%` for negative values; ported as
 *    `a - b * floor(a / b)`.
 *  - `gl_FragColor = ...` becomes a `@fragment` return.
 *  - GLSL ternaries inside `vec3(...)` become `select(falseVal, trueVal, cond)`.
 *  - Helper names with WGSL collisions (`dist`, `scan`, `tri`) get `_` suffix.
 *  - `textureSample` requires uniform control flow; `fetchPixel` uses
 *    `textureSampleLevel(..., 0.0)` to bypass that constraint when sampling
 *    inside the data-dependent bounds check.
 *
 * The fragment uses {@link FULLSCREEN_VS_WGSL} as its vertex stage; the host
 * concatenates the two before shader module creation.
 */
const PIPBOY_FRAGMENT_WGSL = `
struct Params {
    resolution: vec2<f32>,
    time: f32,
    glitchIntensity: f32,
    glitchSeed: f32,
    flickerAmount: f32,
    screenCurvature: f32,
    scanLineAmount: f32,
    scanLineStrength: f32,
    pixelStrength: f32,
    maskIntensity: f32,
    maskSize: f32,
    maskBorder: f32,
    aberration: f32,
    vignetteAmount: f32,
    noiseAmount: f32,
    interferenceAmount: f32,
    rollLineAmount: f32,
    rollSpeed: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

fn random(uv: vec2<f32>) -> f32 {
    return fract(cos(uv.x * 83.4827 + uv.y * 92.2842) * 43758.5453);
}

fn warp(uv: vec2<f32>) -> vec2<f32> {
    let delta = uv - vec2<f32>(0.5);
    let d2 = dot(delta, delta);
    return uv + delta * d2 * params.screenCurvature;
}

fn fetchPixel(uv: vec2<f32>, off: vec2<f32>, res: vec2<f32>) -> vec3<f32> {
    let pos = floor(uv * res + off) / res + vec2<f32>(0.5) / res;
    let inside = max(abs(pos.x - 0.5), abs(pos.y - 0.5)) <= 0.5;
    var n: f32 = 0.0;
    if (params.noiseAmount > 0.0) {
        n = random(pos + vec2<f32>(fract(params.time))) * params.noiseAmount;
    }
    let sampled = textureSampleLevel(src, samp, pos, 0.0).rgb + vec3<f32>(n);
    return select(vec3<f32>(0.0), sampled, inside);
}

fn dist_(pos: vec2<f32>, res: vec2<f32>) -> vec2<f32> {
    let p = pos * res;
    return -(p - floor(p) - vec2<f32>(0.5));
}

fn gaus(pos: f32, scale: f32) -> f32 {
    return exp2(scale * pos * pos);
}

fn horz3(pos: vec2<f32>, off: f32, res: vec2<f32>) -> vec3<f32> {
    let b = fetchPixel(pos, vec2<f32>(-1.0, off), res);
    let c = fetchPixel(pos, vec2<f32>( 0.0, off), res);
    let d = fetchPixel(pos, vec2<f32>( 1.0, off), res);
    let dst = dist_(pos, res).x;
    let scale = params.pixelStrength;
    let wb = gaus(dst - 1.0, scale);
    let wc = gaus(dst + 0.0, scale);
    let wd = gaus(dst + 1.0, scale);
    return (b * wb + c * wc + d * wd) / (wb + wc + wd);
}

fn scan_(pos: vec2<f32>, off: f32, res: vec2<f32>) -> f32 {
    return gaus(dist_(pos, res).y + off, params.scanLineStrength);
}

fn tri_(pos: vec2<f32>, res: vec2<f32>) -> vec3<f32> {
    var clr = fetchPixel(pos, vec2<f32>(0.0), res);
    if (params.scanLineAmount > 0.0) {
        let a = horz3(pos, -1.0, res);
        let b = horz3(pos,  0.0, res);
        let c = horz3(pos,  1.0, res);
        let wa = scan_(pos, -1.0, res);
        let wb = scan_(pos,  0.0, res);
        let wc = scan_(pos,  1.0, res);
        clr = mix(clr, a * wa + b * wb + c * wc, vec3<f32>(params.scanLineAmount));
    }
    return clr;
}

fn rollLine(uv: vec2<f32>) -> f32 {
    let x = uv.y * 3.0 - params.time * params.rollSpeed;
    let f = cos(x) * cos(x * 2.35 + 1.1) * cos(x * 4.45 + 2.3);
    return smoothstep(0.5, 0.9, f) * params.rollLineAmount;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let uv = in.uv;
    let res = params.resolution;

    var pos = warp(uv);
    let line = rollLine(pos);

    let sqPix = floor(pos * res) / res + vec2<f32>(0.5) / res;
    let interference = random(sqPix.yy + vec2<f32>(fract(params.time)));
    pos.x = pos.x + (interference * (params.interferenceAmount + line * 6.0)) / res.x;

    if (params.glitchIntensity > 0.0) {
        let band = floor(pos.y * 30.0);
        let bandNoise = fract(sin(band * 43.758 + params.glitchSeed) * 43758.5453);
        if (bandNoise > 0.85) {
            pos.x = pos.x + (bandNoise - 0.5) * params.glitchIntensity * 0.08;
        }
    }

    let chromatic = params.aberration + line * 2.0;
    var chromX = vec2<f32>(chromatic, 0.0) / res;
    if (params.glitchIntensity > 0.0) {
        chromX = chromX * (1.0 + params.glitchIntensity * 4.0);
    }
    let r = tri_(pos - chromX, res).r;
    let g = tri_(pos, res).g;
    let b = tri_(pos + chromX, res).b;
    var clr = vec3<f32>(r, g, b);

    let pixel = pos * res;
    let coord = pixel / params.maskSize;
    let subcoord = coord * vec2<f32>(3.0, 1.0);
    let cellOffset = vec2<f32>(0.0, fract(floor(coord.x) * 0.5));
    let subFloor = floor(subcoord.x);
    let ind = subFloor - 3.0 * floor(subFloor / 3.0);
    var maskColor = vec3<f32>(
        select(0.0, 1.0, ind < 0.5),
        select(0.0, 1.0, ind >= 0.5 && ind < 1.5),
        select(0.0, 1.0, ind >= 1.5),
    ) * 3.0;
    let cellUV = fract(subcoord + cellOffset) * 2.0 - vec2<f32>(1.0);
    let border = vec2<f32>(1.0) - cellUV * cellUV * params.maskBorder;
    maskColor = maskColor * (border.x * border.y);
    clr = clr * (1.0 + (maskColor - vec3<f32>(1.0)) * params.maskIntensity);

    clr = clr * (1.0 + params.scanLineAmount * 0.3 + line * 1.5 + params.maskIntensity * 0.2);

    let edgeRaw = vec2<f32>(1.0) - (pos * 2.0 - vec2<f32>(1.0)) * (pos * 2.0 - vec2<f32>(1.0));
    let edge = max(edgeRaw, vec2<f32>(0.0));
    clr = clr * pow(edge.x * edge.y, params.vignetteAmount);

    if (params.glitchIntensity > 0.0) {
        let nBand = step(0.92, fract(sin(floor(pos.y * 20.0 + params.time * 5.0) * 45.23) * 12345.6));
        let noise = random(uv * params.time * 100.0);
        clr = mix(clr, vec3<f32>(noise), vec3<f32>(nBand * params.glitchIntensity * 0.5));
    }

    clr = clr * params.flickerAmount;

    if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
        clr = vec3<f32>(0.0);
    }

    return vec4<f32>(clr, 1.0);
}
`;

// #endregion
