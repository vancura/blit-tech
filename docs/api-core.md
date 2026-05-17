# API: Core

Bootstrap, initialization, game loop timing, camera, and core types.

---

## Bootstrap

The `bootstrap()` function is the recommended entry point. It handles DOM ready, canvas lookup, backend selection
(WebGPU or software fallback), and error display automatically.

```ts
import { bootstrap, type BootstrapOptions } from 'blit-tech';

// One-liner — canvas id defaults to 'blit-tech-canvas', container to 'canvas-container'
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
| `onSuccess`       | `() => void`             | —                    | Called after successful init   |
| `onError`         | `(error: Error) => void` | —                    | Called on any init failure     |
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
BT.displaySize; // Vector2i — configured logical resolution (clone per read)
BT.canvasDisplaySize; // Vector2i | null — output buffer when set in configure()
BT.outputSize; // Vector2i — effective drawing-buffer size (clone per read)
BT.targetFPS; // number — target updates per second
BT.activeBackend; // 'webgpu' | 'software' | null
```

`BT.init()` selects WebGPU or falls back to the Canvas 2D software renderer automatically. When not using `bootstrap()`,
set `canvas.tabIndex = 0` and call `canvas.focus()` so keyboard events reach the canvas.

**`HardwareSettings`** (returned from `configure()`):

| Field                  | Type                     | Default     | Description                                   |
| ---------------------- | ------------------------ | ----------- | --------------------------------------------- |
| `displaySize`          | `Vector2i`               | `320×240`   | Logical render resolution                     |
| `canvasDisplaySize`    | `Vector2i`               | `640×480`   | CSS/output size; enables display-tier effects |
| `maxCanvasDisplaySize` | `Vector2i`               | `960×720`   | Maximum on-screen canvas CSS size             |
| `targetFPS`            | `number`                 | `60`        | Fixed-update rate                             |
| `renderer`             | `'webgpu' \| 'software'` | `'webgpu'`  | Force backend                                 |
| `outputUpscaleFilter`  | `'nearest' \| 'linear'`  | `'nearest'` | Upscale filter                                |
| `detectDroppedFrames`  | `boolean`                | `false`     | Log a console warning on missed vsync         |

`displaySize`, `canvasDisplaySize`, and `maxCanvasDisplaySize` must be positive whole-number pixel dimensions. Each size
is capped at `8192×8192` per axis and `16,777,216` total pixels. Invalid sizes make initialization fail before the
engine applies canvas layout or allocates renderer buffers. In WebGPU mode, the requested logical and output sizes must
also fit the active adapter/device `maxTextureDimension2D` limit.

**`BT` getters vs `configure()` fields:** `displaySize`, `canvasDisplaySize`, and `targetFPS` on `BT` mirror the same
names on `HardwareSettings`. `outputSize` is the effective drawing-buffer size (`canvasDisplaySize ?? displaySize`).
`activeBackend` is the backend that actually started (after fallback), not the `renderer` value from `configure()`.

---

## Game Loop Timing

```ts
BT.deltaSeconds; // seconds per fixed tick (1 / BT.targetFPS)
BT.timeSeconds; // elapsed seconds since init (ticks × deltaSeconds)
BT.ticks; // current tick counter (increments each update)
BT.ticksReset(); // reset tick counter to 0
```

### Timer

`Timer` fires once per fixed interval. Use it for periodic events: particle spawns, score ticks, palette swaps.

```ts
const spawn = new Timer(180); // fires every 180 ticks (3 s at 60 FPS)

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

The camera applies a global pixel offset to all subsequent draw calls. Integer only — pass `Vector2i`, never floats.

```ts
BT.cameraSet(new Vector2i(scrollX, scrollY)); // apply offset
BT.camera; // Vector2i — current offset
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
Vector2i.zero(); // (0, 0) — cached frozen singleton
Vector2i.one(); // (1, 1) — cached frozen singleton
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
Rect2i.zero(); // (0,0,0,0) — cached frozen singleton
Rect2i.fromMinMax(min, max); // from corner vectors
Rect2i.fromMinMaxXY(minX, minY, maxX, maxY); // zero-allocation variant
Rect2i.fromCenterSize(center, size); // centered rectangle
Rect2i.fromCenterSizeXY(cx, cy, w, h); // zero-allocation variant

// Instance methods
r.contains(point); // boolean — point inside rect
r.intersects(other); // boolean — rects overlap
r.intersection(other); // Rect2i | null — overlap area
r.center; // Vector2i getter
r.min; // Vector2i getter (top-left)
r.max; // Vector2i getter (bottom-right)
```

### Color32

32-bit RGBA color (channels 0–255).

```ts
const c = new Color32(r, g, b, a);

// Cached color constants (static getters; frozen singletons)
Color32.white       Color32.black       Color32.transparent
Color32.red         Color32.green       Color32.blue
Color32.yellow      Color32.cyan        Color32.magenta
Color32.gray(value)   // grayscale, value 0–255

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
