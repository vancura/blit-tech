import type { Vector2i } from '../../../utils/Vector2i';
import type { EffectSamplerFilter } from '../FullscreenEffect';
import { FullscreenEffect } from '../FullscreenEffect';

/**
 * Block down-quantize: every {@link blockSize}x{@link blockSize} group of
 * source pixels is replaced with a single sample from the block's top-left,
 * producing a chunky pixelation effect.
 *
 * Pixel-tier: nearest sampling preserves palette colors (no inter-color
 * blending). Useful for transitions, dream sequences, or "low-res mode"
 * effects.
 */
export class PixelMosaic extends FullscreenEffect {
    public readonly tier = 'pixel' as const;

    /**
     * Block side length in source pixels. `1` is a no-op; `2` halves
     * effective resolution; `8` produces very chunky blocks.
     */
    public blockSize: number = 4;

    /** Nearest filtering preserves palette colors. */
    protected override readonly samplerFilter: EffectSamplerFilter = 'nearest';

    protected readonly label = 'PixelMosaic';

    /** vec2 resolution + blockSize + 1 pad = 16 bytes. */
    protected readonly uniformBytes = 16;

    protected readonly fragmentShader = MOSAIC_FRAGMENT_WGSL;

    /**
     * Writes resolution and blockSize into the uniform block.
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
        u[2] = this.blockSize;
        u[3] = 0;
    }
}

const MOSAIC_FRAGMENT_WGSL = `
struct Params {
    resolution: vec2<f32>,
    blockSize: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let block = max(params.blockSize, 1.0);
    let pixel = in.uv * params.resolution;
    let snapped = (floor(pixel / block) * block + vec2<f32>(0.5)) / params.resolution;
    return textureSample(src, samp, snapped);
}
`;
