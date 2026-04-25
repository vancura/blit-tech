# Post-Process Effects

Blit-Tech ships a small **post-process chain** that runs between the scene render pass and the swap-chain present. It is
opt-in and adds zero cost while no effect is registered. The first registered effect routes the scene into an offscreen
color texture; the last effect in the chain writes to the swap chain.

This guide covers the public API, the two built-in effects (`PipBoyEffect`, `BloomEffect`), how to write a custom
effect, and the upstream attribution.

---

## Quick start

```ts
import { BT, BloomEffect, PipBoyEffect } from 'blit-tech';

const pipboy = new PipBoyEffect();
const bloom = new BloomEffect();

// Order of add() = render order
BT.effectAdd(pipboy);
BT.effectAdd(bloom);

// Drive animated uniforms each frame
pipboy.time = BT.ticks() / BT.fps();
pipboy.glitchIntensity = currentGlitch;
pipboy.flickerAmount = 0.95 + Math.random() * 0.1;

// Remove individually or clear the whole chain
BT.effectRemove(bloom);
BT.effectClear();
```

The chain is **stable across frames**: effects retain their state until removed. Mutate fields directly on the instance
each frame; the chain re-uploads the uniform block before its `encodePass`.

---

## API

### `BT.effectAdd(effect: Effect): void`

Appends an effect to the end of the chain. The first call allocates the offscreen render target; the second call
allocates a second target for ping-pong. Throws if the engine has not been initialized.

### `BT.effectRemove(effect: Effect): void`

Removes a previously registered instance and calls its optional `dispose()` hook. Removing an effect that was never
added is a no-op. When the last effect is removed, the offscreen textures are destroyed and the renderer reverts to
drawing directly to the swap chain on the next frame.

### `BT.effectClear(): void`

Removes every effect and destroys all offscreen GPU resources. Symmetric to
[`BT.paletteClearEffects()`](../README.md#palette-effects).

### `Effect` interface

Implement this to write a custom fullscreen pass.

```ts
import type { Effect, Vector2i } from 'blit-tech';

export class MyEffect implements Effect {
  init(device: GPUDevice, format: GPUTextureFormat, displaySize: Vector2i): void {
    // Create pipeline, uniform buffer, sampler
  }

  updateUniforms(deltaMs: number, sourceSize: Vector2i): void {
    // Write per-frame uniform data to the GPU
  }

  encodePass(encoder: GPUCommandEncoder, sourceView: GPUTextureView, destView: GPUTextureView): void {
    // Begin a render pass against destView, sample sourceView, draw fullscreen triangle
  }

  dispose?(): void {
    // Optional: destroy GPU buffers
  }
}
```

The chain calls `init` once when the effect is added, `updateUniforms` + `encodePass` once per frame, and `dispose` once
when removed.

---

## How the chain works

```text
no effects:   scene -> swap-chain
1 effect:     scene -> texA -> [effect] -> swap-chain
2 effects:    scene -> texA -> [a] -> texB -> [b] -> swap-chain
N effects:    scene -> texA -> [a] -> texB -> [b] -> texA -> ... -> [n] -> swap-chain
```

- The scene render pass is automatically routed to the chain's offscreen view when at least one effect is registered
  (see [`Renderer.endFrame`](../src/render/Renderer.ts)).
- Single-effect chains skip ping-pong: `texA -> swap-chain` in one pass.
- The **last** effect always writes to the swap chain regardless of which buffer it sampled from.
- Frame capture (`BT.captureFrame()`) reads the swap-chain texture, so screenshots reflect the post-processed output.
- The CRT mask granularity matches `displaySize` (the pixel-art resolution), not the canvas display size. This is the
  intentional retro look on hi-DPI displays. A future option may add hi-res post-processing.

---

## Built-in effects

### `PipBoyEffect` — faux-CRT

A Fallout-PipBoy-flavoured CRT shader: scanlines, RGB shadow mask, screen curvature, chromatic aberration, vignette,
noise, a moving roll line, and a demo-driven glitch path.

**Look parameters** (all match the PipBoy reference defaults):

| Field                | Default | Purpose                                                |
| -------------------- | ------- | ------------------------------------------------------ |
| `screenCurvature`    | `0.02`  | Pincushion strength applied to UVs                     |
| `scanLineAmount`     | `0.6`   | Mix amount for the scanline tri-sampler. 0 disables    |
| `scanLineStrength`   | `-8.0`  | Negative gaussian falloff for individual scanlines     |
| `pixelStrength`      | `-1.5`  | Negative gaussian falloff for sub-pixel sample weights |
| `maskIntensity`      | `0.1`   | Brightness mix applied by the RGB shadow mask. 0 hides |
| `maskSize`           | `6.0`   | Mask cell pitch in pixels                              |
| `maskBorder`         | `0.5`   | Border darkening within each mask cell                 |
| `aberration`         | `1.0`   | Chromatic aberration offset in pixels                  |
| `vignetteAmount`     | `0.2`   | Vignette darkening exponent (higher = stronger)        |
| `noiseAmount`        | `0.015` | Per-fetch additive noise scale. 0 disables             |
| `interferenceAmount` | `0.06`  | Horizontal scanline interference amplitude             |
| `rollLineAmount`     | `0.1`   | Roll line amplitude                                    |
| `rollSpeed`          | `1.0`   | Roll line scroll speed (multiplied by `time`)          |

**Animation parameters** (drive these from your demo each frame):

| Field             | Default | Purpose                                                                |
| ----------------- | ------- | ---------------------------------------------------------------------- |
| `time`            | `0`     | Wall-clock seconds for time-driven effects (roll line, noise, glitch)  |
| `glitchIntensity` | `0`     | Glitch strength in `[0, 1]`. 0 disables the glitch path                |
| `glitchSeed`      | `0`     | Per-glitch random seed; change between glitches to vary the band noise |
| `flickerAmount`   | `1`     | Brightness multiplier applied to the final color. 1.0 is unmodulated   |

The effect ships **without** a JS-side glitch state machine — drive `glitchIntensity` and `glitchSeed` from your demo
(typical pattern: random cooldowns + short glitch bursts of 5-30 frames). See the demo gallery in `blit-tech-demos` for
a worked example.

### `BloomEffect` — single-pass box blur

A simple bloom pass: 5×5 box blur (25 taps) mixed with the original color.

| Field         | Default | Purpose                                                  |
| ------------- | ------- | -------------------------------------------------------- |
| `bloomSpread` | `3.0`   | Texel offset multiplier for the box-blur kernel          |
| `bloomGlow`   | `0.12`  | Mix factor between original sample and blurred neighbors |

A future optimisation would be a 2-pass separable Gaussian (5+5 = 10 taps); we will revisit when GPU perf tests demand
it. The current implementation matches the PipBoy reference.

---

## Writing a custom effect

The `Effect` interface is intentionally minimal. A typical fragment-shader effect looks like:

```ts
import type { Effect, Vector2i } from 'blit-tech';

const SHADER = /* wgsl */ `
struct Params { resolution: vec2<f32>, intensity: f32, _pad: f32 }

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VsOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> }

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
    var verts = array<vec2<f32>, 3>(vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
    var out: VsOut;
    out.pos = vec4(verts[vid], 0., 1.);
    out.uv = vec2((verts[vid].x + 1.) * 0.5, 1.0 - (verts[vid].y + 1.) * 0.5);
    return out;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let c = textureSample(src, samp, in.uv);
    return vec4(c.rgb * params.intensity, 1.0);
}
`;

export class GammaEffect implements Effect {
  public intensity = 1.2;

  private device!: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private uniforms!: GPUBuffer;
  private sampler!: GPUSampler;
  private layout!: GPUBindGroupLayout;
  private cache = new WeakMap<GPUTextureView, GPUBindGroup>();
  private writer = new Float32Array(4);

  init(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;
    const module = device.createShaderModule({ code: SHADER });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.layout = this.pipeline.getBindGroupLayout(0);
    this.uniforms = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  }

  updateUniforms(_dt: number, sourceSize: Vector2i) {
    this.writer[0] = sourceSize.x;
    this.writer[1] = sourceSize.y;
    this.writer[2] = this.intensity;
    this.writer[3] = 0;
    this.device.queue.writeBuffer(this.uniforms, 0, this.writer);
  }

  encodePass(encoder: GPUCommandEncoder, src: GPUTextureView, dest: GPUTextureView) {
    let bg = this.cache.get(src);
    if (!bg) {
      bg = this.device.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: this.uniforms } },
          { binding: 1, resource: src },
          { binding: 2, resource: this.sampler },
        ],
      });
      this.cache.set(src, bg);
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: dest, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bg);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  dispose() {
    this.uniforms.destroy();
  }
}
```

**Tips**

- Use `'auto'` pipeline layout for small effects. The bind group layout is then derived from the WGSL bindings — your
  bind group must include exactly the bindings the shader actually uses or WebGPU rejects the bind group.
- Cache bind groups per source `GPUTextureView` (the chain's `texA`/`texB` views are stable for the chain's lifetime).
- If you call `textureSample` inside data-dependent control flow, switch to `textureSampleLevel(..., 0.0)` — WGSL
  forbids `textureSample` outside uniform control flow because of mip derivative requirements.
- Reuse a single `Float32Array` writer for uniforms — never allocate per frame.
- The vertex stage in `src/render/effects/fullscreenVS.ts` (`FULLSCREEN_VS_WGSL`) draws a 3-vert fullscreen triangle and
  flips Y for top-left UV origin. Concatenate it with your fragment WGSL via string concatenation in `init`.

---

## Attribution

The core CRT helper functions (`fetchPixel`, `dist`, `gaus`, `horz3`, `scan`, `tri`, `warp`) used in `PipBoyEffect` are
direct ports of Timothy Lottes's
[`crt-lottes.glsl`](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl) from the libretro
shader collection. The original header reads:

> PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER by Timothy Lottes

so no license restrictions apply downstream.

The glitch / flicker / roll-line / chromatic-aberration extensions and the uniform set this implementation replicates
come from a community PipBoy fork written for p5.js's `createFilterShader`. The fork's source URL and author are
**unknown** to us at the time of writing, and **no license has been confirmed**. The only header the fork carried was a
Fallout-themed "RobCo Industries (Unlicensed Wasteland Fork)" comment, which is character flavour rather than a license
grant. Treat the upstream provenance as unverified; do not assume permissive rights for the borrowed extensions until
the upstream source and license have been identified.

The individual building blocks (hash-based pseudo-random, sin/cos roll line, band-noise glitch shifts, chromatic
aberration via offset sampling) are common shader patterns not original to any one author, but the specific composition
here mirrors the PipBoy fork. The Blit-Tech port is original WGSL.

If you intend to reuse `PipBoyEffect` in a context with stricter licensing requirements, confirm provenance first. If
you can identify the upstream PipBoy fork, please open a PR to add a verifiable author / URL / license header.
