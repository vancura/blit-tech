# Post-Process Effects

Blit-Tech ships a **two-tier post-process system** that runs between the scene render and the swap-chain present. It is
opt-in and adds zero cost while no effect is registered. Effects are organized into two chains by what they operate on:

- **Pixel tier** — runs at the logical render resolution (e.g. `320x240`) on the rendered palette pixels. Hosts effects
  that respect the pixel-art aesthetic: chunky glitch, block mosaic, palette-aware filters. Effects in this tier sample
  with `nearest` filtering by default so palette colors are preserved through the chain.
- **Display tier** — runs at the canvas output resolution (e.g. `1280x960`) on the upscaled image. Hosts effects that
  simulate the physical display: CRT scanlines, barrel curvature, RGB shadow mask, vignette, chromatic aberration,
  bloom, and so on. Operating at output resolution lets curved sampling (barrel) express smoothly without quantizing
  onto the source pixel grid.

This guide covers the public API, the two-tier architecture, every built-in effect, the `Effect` interface for writing
your own, the bundled presets, and the upstream attribution.

---

## Quick start

```ts
import { BT, Vector2i, BarrelDistortion, Scanlines, RGBMask, Bloom, PixelGlitch } from 'blit-tech';

class Demo {
  queryHardware() {
    return {
      displaySize: new Vector2i(320, 240), // logical pixel-art resolution
      canvasDisplaySize: new Vector2i(1280, 960), // output drawing-buffer size
      outputUpscaleFilter: 'nearest', // 'nearest' | 'linear'
      targetFPS: 60,
    };
  }

  async initialize() {
    // ... palette, sprites ...

    // Pixel tier: chunky glitch on the 320x240 framebuffer
    this.glitch = new PixelGlitch();
    this.glitch.bandHeight = 4;
    BT.effectAdd(this.glitch);

    // Display tier: a CRT look on the 1280x960 output
    for (const fx of BT.preset.crtPipBoy()) {
      BT.effectAdd(fx); // each effect declares its tier; engine routes automatically
    }

    return true;
  }
}
```

The chain is **stable across frames**: effects retain their state until removed. Mutate fields directly on the instance
each frame; the chain re-uploads the uniform block before its `encodePass`.

---

## Architecture

```text
[Demo render() draws into the logical framebuffer @ 320x240]
        ↓
[Pixel chain @ 320x240]      ← palette-friendly: PixelGlitch, PixelMosaic, ...
        ↓
[UpscalePass @ outputSize]   ← 'nearest' (crisp) or 'linear' (soft)
        ↓
[Display chain @ outputSize] ← screen sim: BarrelDistortion, Scanlines, RGBMask, ...
        ↓
[Swap chain]
```

Invariants:

- Both chains empty: scene renders directly to the swap chain (zero offscreen allocations).
- Only the pixel chain has effects: scene → pixel chain → upscale → swap chain.
- Only the display chain has effects: scene → upscale → display chain → swap chain.
- The last effect in the active chain writes to the swap chain.
- Adding a `tier='display'` effect when `canvasDisplaySize` is unset throws with a clear message — display effects need
  an output buffer larger than the logical framebuffer to operate.

---

## API

### `BT.effectAdd(effect: Effect): void`

Appends an effect to the chain matching its declared `tier`. Effects can be added at any time; the first add allocates
the chain's offscreen render targets, the second add allocates a second target for ping-pong. Throws if the engine has
not been initialized or if a `tier='display'` effect is added without `canvasDisplaySize`.

### `BT.effectRemove(effect: Effect): void`

Removes a previously registered effect. Searches both tiers and disposes the effect from whichever chain holds it.
Removing an effect that was never added is a no-op. When the last effect in either chain is removed, that chain's
offscreen textures are destroyed.

### `BT.effectClear(): void`

Removes every effect in both tiers and destroys all offscreen GPU resources.

### `Effect` interface

```ts
import type { Effect, EffectTier, Vector2i } from 'blit-tech';

export class MyEffect implements Effect {
  public readonly tier: EffectTier = 'display'; // or 'pixel'

  init(device: GPUDevice, format: GPUTextureFormat, displaySize: Vector2i): void {
    // Create pipeline, uniform buffer, sampler.
  }

  updateUniforms(deltaMs: number, sourceSize: Vector2i): void {
    // Write per-frame uniform data to the GPU.
  }

  encodePass(encoder: GPUCommandEncoder, sourceView: GPUTextureView, destView: GPUTextureView): void {
    // Begin a render pass against destView, sample sourceView, draw fullscreen triangle.
  }

  dispose?(): void {
    // Optional: destroy GPU buffers.
  }
}
```

The chain calls `init` once when the effect is added, `updateUniforms` + `encodePass` once per frame, and `dispose` once
when removed.

The base class `FullscreenEffect` handles 90% of the boilerplate (pipeline, sampler, uniform buffer, bind-group cache);
see [Writing a custom effect](#writing-a-custom-effect) below.

### `HardwareSettings`

```ts
interface HardwareSettings {
  displaySize: Vector2i;
  canvasDisplaySize?: Vector2i; // drives drawing buffer + CSS, enables display tier
  outputUpscaleFilter?: 'nearest' | 'linear'; // default 'nearest'
  targetFPS: number;
  detectDroppedFrames?: boolean;
}
```

When `canvasDisplaySize` is omitted, the WebGPU drawing buffer matches `displaySize`, no upscale pass exists, and the
display tier is unavailable (adding a display effect throws).

---

## Pixel-tier effects

### `PixelGlitch` — chunky band shift

Per-row horizontal glitch: every Nth row of source pixels gets a random horizontal shift, quantized to integer
source-pixel offsets so palette colors are preserved.

| Field        | Default | Purpose                                                             |
| ------------ | ------- | ------------------------------------------------------------------- |
| `intensity`  | `0`     | Glitch strength `[0, 1]`. Drives band-shift magnitude / probability |
| `bandHeight` | `4`     | Height of each glitch band in source pixels                         |
| `seed`       | `0`     | Per-glitch seed; change between bursts to vary the band noise       |

### `PixelMosaic` — block down-quantize

Replaces each `blockSize x blockSize` group of source pixels with a single sample. Useful for transitions, dream
sequences, and "low-res mode" effects.

| Field       | Default | Purpose                             |
| ----------- | ------- | ----------------------------------- |
| `blockSize` | `4`     | Side length of each block in pixels |

---

## Display-tier effects

### `BarrelDistortion` — pincushion curve

`warp(uv) = uv + delta * d2 * curvature`. Operates at output resolution so the curve has enough pixels to express
smoothly — no stepping artifacts on diagonals.

| Field       | Default | Purpose                                                             |
| ----------- | ------- | ------------------------------------------------------------------- |
| `curvature` | `0.05`  | Curve strength. `0.02` flat panel, `0.05` desktop, `0.10` pocket TV |

### `Scanlines` — bright/dark horizontal bands

Gaussian-weighted scanline pattern matched to source pixel rows.

| Field      | Default | Purpose                                                   |
| ---------- | ------- | --------------------------------------------------------- |
| `amount`   | `0.55`  | Mix factor `[0, 1]`. 0 disables                           |
| `strength` | `-8`    | Negative gaussian falloff; more negative = sharper bands  |
| `density`  | `240`   | Cycles per view (set to your logical vertical resolution) |

### `RGBMask` — CRT shadow mask

R/G/B vertical-stripe pattern with darkened cell borders, simulating an aperture-grille CRT.

| Field       | Default | Purpose                               |
| ----------- | ------- | ------------------------------------- |
| `intensity` | `0.18`  | Mask brightness mix `[0, 1]`. 0 hides |
| `size`      | `6`     | Mask cell pitch in source pixels      |
| `border`    | `0.5`   | Border darkening within each cell     |

### `Vignette` — edge darkening

Smooth radial fade. `pow(edge.x * edge.y, amount)`.

| Field    | Default | Purpose                                         |
| -------- | ------- | ----------------------------------------------- |
| `amount` | `0.35`  | Darkening exponent. Higher = stronger / sharper |

### `ChromaticAberration` — RGB channel offset

Red samples left of the fragment, blue samples right. Cheap CRT optics produce a tiny version of this naturally.

| Field        | Default | Purpose                         |
| ------------ | ------- | ------------------------------- |
| `aberration` | `1.0`   | Channel offset in source pixels |

### `Flicker` — brightness multiplier

The simplest CRT animation knob. `color *= amount`. Demo drives it per-frame.

| Field    | Default | Purpose                              |
| -------- | ------- | ------------------------------------ |
| `amount` | `1.0`   | Brightness multiplier. 1 unmodulated |

### `RollLine` — scrolling interference band

A horizontal bright stripe slowly scrolls down the screen.

| Field    | Default | Purpose                                         |
| -------- | ------- | ----------------------------------------------- |
| `amount` | `0.1`   | Strength of the bright band                     |
| `speed`  | `1.0`   | Scroll velocity multiplier                      |
| `time`   | `0`     | Wall-clock seconds; demos drive this each frame |

### `Interference` — per-row analog jitter

Each row gets a random horizontal offset reseeded each frame.

| Field    | Default | Purpose                                |
| -------- | ------- | -------------------------------------- |
| `amount` | `0.06`  | Maximum offset as a UV fraction        |
| `time`   | `0`     | Wall-clock seconds; reseeds each frame |

### `Noise` — additive pseudo-random noise

Per-pixel film grain. Reseeds each frame from `time`.

| Field    | Default | Purpose                                              |
| -------- | ------- | ---------------------------------------------------- |
| `amount` | `0.025` | Noise amplitude as `[-amount, +amount]` perturbation |
| `time`   | `0`     | Wall-clock seconds                                   |

### `Bloom` — soft phosphor glow

Single-pass 5x5 box blur (25 taps) mixed with the original color.

| Field    | Default | Purpose                                                  |
| -------- | ------- | -------------------------------------------------------- |
| `spread` | `3.0`   | Texel offset multiplier for the box-blur kernel          |
| `glow`   | `0.18`  | Mix factor between original sample and blurred neighbors |

A future optimisation would be a two-pass separable Gaussian (5+5 = 10 taps); we will revisit when GPU perf tests demand
it.

---

## Presets

Each preset is a function that returns a fresh array of pre-configured effects. Add them in order to the engine via
`BT.effectAdd`.

### `BT.preset.crtPipBoy()`

Recreates the original PipBoy CRT look:
`BarrelDistortion + ChromaticAberration + Interference + RollLine + Scanlines + RGBMask + Noise + Flicker + Bloom`.
Demos that want the full kitchen-sink effect should use this.

### `BT.preset.amber()`

Amber monochrome PC monitor (think IBM 5151 / Hercules). Currently ships as a parameter-only set — the actual amber tint
quantization will land with [VV-479](https://linear.app/vancura/issue/VV-479/monochrome-re-quantization-display-effect).

### `BT.preset.green()`

Green monochrome PC monitor (think IBM monochrome / VT100). Same caveat as `amber()`.

---

## Writing a custom effect

The simplest path is to extend `FullscreenEffect`, the base class that handles pipeline / sampler / uniform-buffer /
bind-group-cache boilerplate. Subclasses provide the WGSL fragment shader, declare a tier and uniform-buffer size, and
write per-frame uniforms.

```ts
import type { Vector2i } from 'blit-tech';
import { FullscreenEffect } from 'blit-tech/render/effects/FullscreenEffect';

export class GammaEffect extends FullscreenEffect {
  public readonly tier = 'display' as const;
  public intensity = 1.2;

  protected readonly label = 'GammaEffect';
  protected readonly uniformBytes = 16;
  protected readonly fragmentShader = `
struct Params {
    intensity: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let c = textureSample(src, samp, in.uv);
    return vec4<f32>(pow(c.rgb, vec3<f32>(params.intensity)), c.a);
}`;

  protected writeUniforms(_dt: number, _sourceSize: Vector2i): void {
    const u = this.uniformData;
    if (!u) return;
    u[0] = this.intensity;
    u[1] = u[2] = u[3] = 0;
  }
}
```

**Notes**

- The base class requires `tier`, `label`, `uniformBytes` (multiple of 16), and `fragmentShader`. Subclasses can also
  override `samplerFilter` (defaults to `'linear'`; pixel-tier effects typically override to `'nearest'` to preserve
  palette colors).
- The fragment shader sees `Params`, `src`, `samp` at `@group(0) @binding(0..2)`. The shared vertex stage in
  `src/render/effects/fullscreenVS.ts` is concatenated automatically, giving you
  `VsOut { pos: vec4<f32>, uv: vec2<f32> }`.
- For data-dependent control flow that calls `textureSample`, switch to `textureSampleLevel(..., 0.0)` — WGSL forbids
  `textureSample` outside uniform control flow because of mip derivative requirements.
- Reuse the inherited `uniformData` `Float32Array` — never allocate per frame.

---

## How the chain works internally

```text
no effects:                   scene -> swap-chain
pixel only:                   scene -> texA -> [px] -> swap-chain (no upscale needed)
display only:                 scene -> upscale -> texA' -> [dsp] -> swap-chain
both, single px + single dsp: scene -> texA -> [px] -> upscale -> texA' -> [dsp] -> swap-chain
N pixel + M display:          scene -> texA -> [px1] -> texB -> [px2] -> ... -> texA -> upscale ->
                              texA' -> [dsp1] -> texB' -> ... -> swap-chain
```

- Each chain (`pixel` and `display`) lazily allocates its own ping-pong textures `texA` and `texB` only when it has
  effects.
- The `UpscalePass` runs whenever `canvasDisplaySize` differs from `displaySize`, even when no display-tier effects are
  registered.
- Frame capture (`BT.captureFrame()`) reads the swap-chain texture, so screenshots reflect the post-processed output.

---

## Attribution

The core CRT helper functions (`fetchPixel`, `dist`, `gaus`, `horz3`, `scan`, `tri`, `warp`) used in the original
`PipBoyEffect` were direct ports of Timothy Lottes's
[`crt-lottes.glsl`](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl) from the libretro
shader collection. The original header reads:

> PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes

so no license restrictions apply downstream. The decomposed `BarrelDistortion`, `Scanlines`, `RGBMask` effects in this
codebase derive from the same shader.

The glitch / flicker / roll-line / chromatic-aberration extensions and the uniform set the pre-decomposition
`PipBoyEffect` replicated come from a community PipBoy fork written for p5.js's `createFilterShader`. The fork's source
URL and author are **unknown** to us at the time of writing, and **no license has been confirmed** — the only header it
carried was a Fallout-themed "RobCo Industries (Unlicensed Wasteland Fork)" comment, which is character flavour rather
than a license grant. Treat the upstream provenance as unverified; do not assume permissive rights for the borrowed
extensions until the upstream source and license have been identified.

The individual building blocks (hash-based pseudo-random, sin/cos roll line, band-noise glitch shifts, chromatic
aberration via offset sampling) are common shader patterns and not original to any one author, but the specific
composition mirrors the PipBoy fork. The Blit-Tech port is original WGSL.

If you intend to reuse `Interference`, `RollLine`, or `PixelGlitch` in a context with stricter licensing requirements,
confirm provenance first. The license audit is tracked in
[VV-480](https://linear.app/vancura/issue/VV-480/audit-and-resolve-pipboy-fork-licensing). If you can identify the
upstream PipBoy fork, please open a PR to add a verifiable author / URL / license header.
