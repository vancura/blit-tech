import type { Vector2i } from '../../../utils/Vector2i';
import type { EffectSamplerFilter } from '../FullscreenEffect';
import { FullscreenEffect } from '../FullscreenEffect';

/**
 * Chunky pixel-aligned horizontal glitch: every Nth row of source pixels gets
 * a random horizontal shift. Shifts snap to integer source-pixel offsets so
 * the result still looks like palette pixel art (no inter-color blending).
 *
 * Pixel-tier: lives at logical resolution where blocks are pixel-perfect. The
 * decomposition successor of the `glitchIntensity` parameter on the original
 * PipBoy effect.
 */
export class PixelGlitch extends FullscreenEffect {
    public readonly tier = 'pixel' as const;

    /**
     * Glitch strength in `[0, 1]`. Drives both the per-band shift magnitude
     * and the probability that a band is shifted at all. `0` disables.
     */
    public intensity: number = 0;

    /**
     * Height of each glitch band in source pixels. Each band gets a single
     * shift value, so larger bands produce chunkier glitches.
     */
    public bandHeight: number = 4;

    /**
     * Per-glitch random seed. Change between glitches to vary the band noise
     * pattern.
     */
    public seed: number = 0;

    /** Nearest filtering preserves palette colors; pixel-tier defaults. */
    protected override readonly samplerFilter: EffectSamplerFilter = 'nearest';

    protected readonly label = 'PixelGlitch';

    /** vec2 resolution + intensity + bandHeight + seed + 1 pad = 32 bytes. */
    protected readonly uniformBytes = 32;

    protected readonly fragmentShader = GLITCH_FRAGMENT_WGSL;

    /**
     * Writes resolution, intensity, bandHeight, and seed into the uniform block.
     * @param _deltaMs
     * @param sourceSize
     */
    protected writeUniforms(_deltaMs: number, sourceSize: Vector2i): void {
        const u = this.uniformData;

        if (!u) {
            return;
        }

        u[0] = sourceSize.x;
        u[1] = sourceSize.y;
        u[2] = this.intensity;
        u[3] = this.bandHeight;
        u[4] = this.seed;
        // u[5..7] padding
    }
}

const GLITCH_FRAGMENT_WGSL = `
struct Params {
    resolution: vec2<f32>,
    intensity: f32,
    bandHeight: f32,
    seed: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    if (params.intensity <= 0.0) {
        return textureSample(src, samp, in.uv);
    }

    let bandHeight = max(params.bandHeight, 1.0);
    let band = floor(in.uv.y * params.resolution.y / bandHeight);
    let bandHash = hash(band * 43.758 + params.seed);

    var off = vec2<f32>(0.0);

    if (bandHash > 0.85) {
        // Shift in source pixels, quantized to integer texel offsets so
        // palette colors are preserved through nearest sampling.
        let shiftPx = floor((bandHash - 0.5) * params.intensity * params.resolution.x * 0.16);
        off = vec2<f32>(shiftPx / params.resolution.x, 0.0);
    }

    return textureSample(src, samp, in.uv + off);
}
`;
