# API: Core

Bootstrap, initialization, game loop timing, camera, and core types.

---

## Bootstrap

The `bootstrap()` function is the recommended entry point. It handles DOM ready, canvas lookup, backend selection
(WebGPU or software fallback), and error display automatically.

```ts
import { bootstrap, type BootstrapOptions } from 'blit-tech';

// One-liner - canvas id defaults to 'blit-tech-canvas', container to 'canvas-container'
bootstrap(MyDemo);

// With options
bootstrap(MyDemo, {
  canvasId: 'my-canvas',
  containerId: 'error-wrapper',
  onSuccess: () => console.log('started'),
  onError: (err) => trackError(err),
  waitForDOMReady: true, // default true; set false in Electron after DOMContentLoaded
});
```

**`BootstrapOptions` fields:**

| Field             | Type                     | Default              | Description                    |
| ----------------- | ------------------------ | -------------------- | ------------------------------ |
| `canvasId`        | `string`                 | `'blit-tech-canvas'` | Canvas element id              |
| `containerId`     | `string`                 | `'canvas-container'` | Container id for error display |
| `onSuccess`       | `() => void`             | -                    | Called after successful init   |
| `onError`         | `(error: Error) => void` | -                    | Called on any init failure     |
| `waitForDOMReady` | `boolean`                | `true`               | Wait for `DOMContentLoaded`    |

**Manual utilities** (for custom initialization flows):

```ts
import { displayError, getCanvas } from 'blit-tech';

const canvas = getCanvas('my-canvas'); // returns null on missing element
displayError('Init Failed', 'WebGPU unavailable.', 'my-container');
```

---

## Initialization

```ts
const ok = await BT.init(demo, canvas); // low-level init; prefer bootstrap()
BT.displaySize; // Vector2i - configured logical resolution (clone per read)
BT.canvasDisplaySize; // Vector2i | null - output buffer when set in configure()
BT.outputSize; // Vector2i - effective drawing-buffer size (clone per read)
BT.targetFPS; // number - fixed update() rate (simulation), not measured render FPS
BT.requestedBackend; // 'webgpu' | 'software' | null - resolved request (see below)
BT.activeBackend; // 'webgpu' | 'software' | null - backend that actually started
```

`BT.init()` selects WebGPU or falls back to the Canvas 2D software renderer automatically. When not using `bootstrap()`,
set `canvas.tabIndex = 0` and call `canvas.focus()` so keyboard events reach the canvas.

### Resolution model

Blit-Tech tracks several related pixel dimensions. The word **display** appears in several public names (`displaySize`,
`canvasDisplaySize`, display-tier effects); use the vocabulary below when you mean a specific layer.

| Term               | What it is                                                                                         | Configure field             | `BT` getter               |
| ------------------ | -------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------- |
| **Logical**        | Game/simulation coordinate space; where `render()` draws palette-indexed pixels                    | `displaySize`               | `BT.displaySize`          |
| **Drawing buffer** | GPU/canvas backing-store resolution; upscale target and display-tier post-process resolution       | `canvasDisplaySize`         | `BT.canvasDisplaySize`    |
| _(derived)_        | Effective drawing-buffer size (`canvasDisplaySize` when set, otherwise logical 1:1)                | —                           | `BT.outputSize`           |
| **CSS cap**        | Maximum on-screen canvas size in CSS pixels (layout scales to the viewport, not beyond this)       | `maxCanvasDisplaySize`      | _(no getter)_             |
| **Effect tier**    | Post-process chain stage: **pixel tier** at logical resolution; **display tier** at drawing buffer | _(requires drawing buffer)_ | _(see post-process docs)_ |

Typical WebGPU flow at default `320×240` logical with `640×480` drawing buffer:

```text
render() @ logical (320×240)
  → pixel-tier effects @ logical
  → palette resolve + upscale @ drawing buffer (640×480)  ← BT.outputSize
  → display-tier effects @ drawing buffer
  → swap chain → browser scales canvas (up to CSS cap 960×720)
```

**Which size for CRT?** CRT-style effects (scanlines, barrel distortion, RGB mask, bloom) are **display-tier**. They run
at the **drawing buffer** — use **`BT.outputSize`**, not `BT.displaySize`. Set `canvasDisplaySize` larger than
`displaySize` (for example `320×240` logical and `1280×960` buffer) so curvature and scanlines are not quantized onto
the logical pixel grid. Display-tier registration throws when `canvasDisplaySize` is unset. Pixel-native effects
(`PixelGlitch`, `PixelMosaic`) are **pixel-tier** and run at **`BT.displaySize`** (logical).

**What is `BT.outputSize`?** The effective **drawing-buffer** width and height in pixels:
`canvasDisplaySize ?? displaySize`. Palette resolve/upscale and the display-tier chain both operate at this size. When
`canvasDisplaySize` is omitted, logical and drawing buffer match (1:1). Each read returns a clone. There is no
`HardwareSettings.outputSize` field — only the runtime getter.

See [Post-Process Effects](post-process-effects.md) for tier routing and presets.

**`HardwareSettings`** (resolved after `configure()`; the hook may return a partial object):

`configure()` may return only the fields you want to override. The engine merges them with `defaultConfig()` via
`mergeHardwareSettings()` (also exported). Omit `displaySize` to inherit the full default resolution and `640×480`
output buffer. Include `displaySize` when you want a custom logical size; optional fields you omit then stay unset (for
example no `canvasDisplaySize` means a 1:1 drawing buffer).

| Field                  | Type                     | Default     | Description                                                        |
| ---------------------- | ------------------------ | ----------- | ------------------------------------------------------------------ |
| `displaySize`          | `Vector2i`               | `320×240`   | **Logical** render resolution                                      |
| `canvasDisplaySize`    | `Vector2i`               | `640×480`   | **Drawing buffer** size; enables **display-tier** effects when set |
| `maxCanvasDisplaySize` | `Vector2i`               | `960×720`   | **CSS cap** — maximum on-screen canvas size                        |
| `targetFPS`            | `number`                 | `60`        | Fixed `update()` rate (simulation ticks per second)                |
| `backend`              | `'webgpu' \| 'software'` | `'webgpu'`  | Force rendering backend                                            |
| `outputUpscaleFilter`  | `'nearest' \| 'linear'`  | `'nearest'` | Upscale filter                                                     |
| `detectDroppedFrames`  | `boolean`                | `false`     | Log a console warning on missed vsync                              |
| `statsOverlayEnabled`  | `boolean`                | `true`      | Engine stats HUD after each `render()`                             |
| `statsOverlayStyle`    | `StatsOverlayStyle`      | _unset_     | Optional bar/text palette indices for stats overlay                |

`displaySize`, `canvasDisplaySize`, and `maxCanvasDisplaySize` must be positive whole-number pixel dimensions. Each size
is capped at `8192×8192` per axis and `16,777,216` total pixels (`4096×4096`). Invalid sizes make initialization fail
before the engine applies canvas layout, sets canvas backing dimensions, or allocates renderer buffers. `BT.init()`
returns `false` and logs a specific `[BT]` message to the browser console (press F12); the on-canvas bootstrap error
stays a generic init failure message. In WebGPU mode, the requested logical and output sizes must also fit the active
adapter/device `maxTextureDimension2D` limit. GPU limit failures do not fall back to the software renderer.

**`BT` getters vs `configure()` fields:** `displaySize`, `canvasDisplaySize`, and `targetFPS` on `BT` mirror the same
names on `HardwareSettings`. `outputSize` is the derived drawing-buffer size — see
[Resolution model](#resolution-model). `requestedBackend` mirrors resolved `HardwareSettings.backend` (including URL
overrides). `activeBackend` is the backend that actually started and may differ after WebGPU fallback.

### Requested vs active backend

Two getters disambiguate **what you asked for** from **what is running**:

| Getter                | When set                                                                                         | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `BT.requestedBackend` | After hardware settings load (`configure()` merge + URL override), before or after renderer init | Backend the engine will try / tried to start (`'webgpu'` default when omitted) |
| `BT.activeBackend`    | After successful renderer init only                                                              | Backend that actually started (`null` before init or on init failure)          |

**`configure().backend`** and **`BT.requestedBackend`** both describe the request, but only the getter reflects
post-merge resolution:

- `demo.configure()` may return a partial object; the engine merges it with `defaultConfig()`.
- `?backend=software` mutates the resolved `HardwareSettings.backend` **before** `initRenderer()` runs (during
  `loadHardwareSettings()`). A page opened as `/demos/023-crt-pipboy.html?backend=software` therefore reports
  `BT.requestedBackend === 'software'` even when `configure()` asked for WebGPU.

**Fallback:** When `requestedBackend` is `'webgpu'` (explicit or default) and WebGPU init fails, the engine logs a
warning and starts the software renderer. Then `activeBackend === 'software'` while `requestedBackend` stays `'webgpu'`.

**Runtime checks (post-process, capture, etc.):** use `activeBackend`, not `requestedBackend`:

```ts
// Correct: gate on the backend that actually started; BT.effectAdd takes one effect
if (BT.activeBackend === 'webgpu') {
  for (const fx of BT.preset.crtPipBoy()) {
    BT.effectAdd(fx);
  }
}

// Misleading after fallback: requestedBackend may still be 'webgpu'
if (BT.requestedBackend === 'webgpu') {
  for (const fx of BT.preset.crtPipBoy()) {
    BT.effectAdd(fx); // throws once activeBackend is software
  }
}
```

Forcing software up front avoids the fallback path entirely:

```ts
configure() {
  return { backend: 'software', /* ... */ };
}
// requestedBackend === activeBackend === 'software' after init
```

### Stats overlay

When `statsOverlayEnabled` is `true` (default), the engine draws a screen-space HUD after each demo `render()` call, on
top of all demo content. Layout is computed once at init from `displaySize` and the system font metrics (no per-frame
size queries).

- **Top bar (left):** short demo title derived from `document.title` (registry pages titled `Blit-Tech Demo NNN - Topic`
  show as `Topic Demo`); **top bar (right):** active backend and logical resolution (for example `webgpu | 320x240`)
- **Bottom bar (left):** measured **render FPS** (`requestAnimationFrame` cadence) and configured **target FPS**
  (`update()` rate); **bottom bar (right):** `[HIDE ~]` hint
- **Custom rows (optional):** extra bars from `statsOverlayRows()` stacked above the bottom bar, **1 px** apart, each
  with left text and optional right text (same 16 px bar style as the built-in rows)

Demos may implement optional `statsOverlayRows()` on `IBlitTechDemo`. The engine calls it once per render frame after
`render()` when the overlay is enabled and visible (not hidden with Backquote or the corner toggle). Return `undefined`
or an empty array when no custom rows are needed. Reuse the same array and row objects when possible; update `leftText`
/ `rightText` in place to avoid per-frame allocations.

```ts
/** @implements {IBlitTechDemo} */
class Demo {
  readonly #overlayRows = [{ leftText: 'Position: 0, 0' }, { leftText: 'Score: 0', rightText: 'ready' }];

  statsOverlayRows() {
    this.#overlayRows[0].leftText = `Position: ${this.pos.x}, ${this.pos.y}`;
    this.#overlayRows[1].leftText = `Score: ${this.score}`;
    return this.#overlayRows;
  }
}
```

Toggle visibility at runtime with **Backquote** (`~`) or a primary pointer press in the **bottom-right 48x48 px**
corner. Set `statsOverlayEnabled: false` in `configure()` to disable the overlay and all toggle input (for example
release builds). On WebGPU, the stats overlay uses two late batches: {@link IRenderer.drawRectFillOnTop} for bar fills
above demo sprites, then {@link IRenderer.drawBitmapTextOnTop} for labels above those bars.

Overlay colors follow one path: use `statsOverlayStyle` when set, otherwise defaults `1` (bar) and `2` (text). You can
override globally in `configure()` with `statsOverlayStyle: { barPaletteIndex, textPaletteIndex }`, or per custom row on
`StatsOverlayRow` (`barPaletteIndex`, `textPaletteIndex`).

The overlay label `Render FPS: N` is **not** the same as `BT.targetFPS`: render FPS reflects how often `render()` runs
(browser refresh rate); target FPS is how often `update()` runs (fixed timestep). Do not use overlay render FPS for
simulation timing—use `BT.ticks`, `BT.deltaSeconds`, or `Timer` instead.

Demos should not duplicate FPS or page-title footer text; the overlay provides those. Reserve about **17 px** per custom
overlay row above the bottom bar (16 px bar + 1 px gap). When drawing custom top or bottom HUD panels, leave about **15
px** clear at each edge for the built-in overlay bars, or set `statsOverlayEnabled: false` for full-screen layouts (for
example terminal-style demos).

```ts
configure() {
  return {
    displaySize: new Vector2i(320, 240),
    statsOverlayEnabled: false, // release build or custom full-screen HUD
    statsOverlayStyle: { barPaletteIndex: 2, textPaletteIndex: 3 }, // optional palette indices
  };
}
```

---

## Game Loop Timing

Blit-Tech runs two independent cadences:

| Concept             | Where                                                      | Meaning                                                        |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| **Simulation rate** | `targetFPS`, `BT.targetFPS`, `BT.deltaSeconds`, `BT.ticks` | Fixed `update()` step; game logic and `Timer` use ticks        |
| **Render rate**     | Stats overlay `Render FPS: N`                              | Measured `requestAnimationFrame` cadence; `render()` runs here |

`render()` may run more or fewer times per second than `update()` (for example 120 Hz display with `targetFPS: 60`). Use
tick-based timing for gameplay; use overlay render FPS only to spot GPU or draw-call bottlenecks.

```ts
BT.deltaSeconds; // seconds per fixed tick (1 / BT.targetFPS)
BT.timeSeconds; // elapsed seconds since init (ticks × deltaSeconds)
BT.ticks; // current tick counter (increments each update)
BT.ticksReset(); // reset tick counter to 0
```

### Timer

`Timer` counts **fixed update ticks**, not render frames. Intervals are in ticks; convert to seconds with
`intervalTicks / BT.targetFPS`. Use it in `update()` for periodic events: particle spawns, score ticks, palette swaps.

```ts
const spawn = new Timer(180); // every 180 ticks (3 s when BT.targetFPS === 60)

// Inside update():
if (spawn.tick()) {
  spawnEnemy();
}

// Additional API:
spawn.reset(); // restart interval from now
spawn.elapsedTicks(); // ticks since last fire/reset
spawn.remainingTicks(); // ticks until next fire
spawn.intervalTicks; // readonly interval size
```

`Timer.tick()` advances the internal baseline on each true return. Pass `BT.ticks` explicitly only when you need a
specific snapshot; the default is the engine tick counter.

---

## Camera

The camera applies a global pixel offset to all subsequent draw calls. Integer only - pass `Vector2i`, never floats.

```ts
BT.cameraSet(new Vector2i(scrollX, scrollY)); // apply offset
BT.camera; // Vector2i - current offset
BT.cameraReset(); // set back to (0, 0)

// Clamp a camera origin so the viewport stays within a world:
const clamped = BT.cameraClamp(desired, worldSize);
// Optional third argument overrides the viewport size (default: BT.displaySize):
const clamped = BT.cameraClamp(desired, worldSize, new Vector2i(160, 120));
```

---

## Core Types

### Vector2i

Integer 2D vector. Constructor auto-truncates floats toward zero. Used for all positions, sizes, and camera offsets.

```ts
const v = new Vector2i(10, 20);
v.x;
v.y; // direct access
v.width;
v.height; // aliases for x / y (useful when treating the vector as a size)

// Static factories
Vector2i.zero(); // (0, 0) - cached frozen singleton
Vector2i.one(); // (1, 1) - cached frozen singleton
Vector2i.up(); // (0, -1)
Vector2i.down(); // (0, 1)
Vector2i.left(); // (-1, 0)
Vector2i.right(); // (1, 0)
Vector2i.fromFloat(x, y); // truncate floats → integer vector

// Math utilities
Vector2i.distance(a, b); // Euclidean distance (float)
Vector2i.sqrDistance(a, b); // squared distance (avoids sqrt)
Vector2i.dotProduct(a, b); // scalar dot product
Vector2i.lerp(a, b, t); // interpolate, t clamped [0,1], result truncated
Vector2i.lerpTo(a, b, t, out); // zero-allocation lerp into existing vector
```

Instance methods: `.add()`, `.sub()`, `.scale()`, `.dot()`, `.clone()`, `.equals()`, `.negate()`, `.abs()`, `.min()`,
`.max()`, etc. See `src/utils/Vector2i.ts` for the full list.

### Rect2i

Integer rectangle with `x, y, width, height` fields.

```ts
const r = new Rect2i(x, y, width, height);

// Static factories
Rect2i.zero(); // (0,0,0,0) - cached frozen singleton
Rect2i.fromMinMax(min, max); // from corner vectors
Rect2i.fromMinMaxXY(minX, minY, maxX, maxY); // zero-allocation variant
Rect2i.fromCenterSize(center, size); // centered rectangle
Rect2i.fromCenterSizeXY(cx, cy, w, h); // zero-allocation variant

// Instance methods
r.contains(point); // boolean - point inside rect
r.intersects(other); // boolean - rects overlap
r.intersection(other); // Rect2i | null - overlap area
r.center; // Vector2i getter
r.min; // Vector2i getter (top-left)
r.max; // Vector2i getter (bottom-right)
```

### Color32

32-bit RGBA color (channels 0-255).

```ts
const c = new Color32(r, g, b, a);

// Cached color constants (static getters; frozen singletons)
Color32.white       Color32.black       Color32.transparent
Color32.red         Color32.green       Color32.blue
Color32.yellow      Color32.cyan        Color32.magenta
Color32.gray(value)   // grayscale, value 0-255

// Hex parsing
Color32.fromHex('#ff8800')    // returns Color32

// Named color registry (global, case-insensitive)
Color32.registerColor('brand', new Color32(255, 128, 0, 255));
Color32.resolveNamedColor('brand');   // → Color32 | undefined
Color32.updateColor('brand', newColor);
Color32.unregisterColor('brand');

// Interpolation
Color32.lerp(a, b, t);       // blend a→b; t clamped [0,1]; RGBA independent; truncates like instance lerp
c.lerp(other, t);            // same semantics as static helper

// Conversion
c.toFloat32Array()            // [r/255, g/255, b/255, a/255]
c.luminance                   // perceived brightness: 0.299r + 0.587g + 0.114b
c.toHex()                     // '#rrggbb' string
```

---

## See Also

| Guide                              | What it covers                                         |
| ---------------------------------- | ------------------------------------------------------ |
| [API: Rendering](api-rendering.md) | primitives, sprites, text, post-process, frame capture |
| [API: Palette](api-palette.md)     | palette setup, presets, effects                        |
| [Palette Guide](palette-guide.md)  | palette-first workflow and practical patterns          |
| [API: Assets](api-assets.md)       | sprite sheets, bitmap fonts, asset loading             |
| [Input Guide](input.md)            | pointer, keyboard, gamepad                             |
| [Testing](testing.md)              | test tiers, WebGPU mocks                               |
