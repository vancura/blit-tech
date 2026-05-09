# Blit-Tech

[![CI](https://github.com/vancura/blit-tech/actions/workflows/ci.yml/badge.svg)](https://github.com/vancura/blit-tech/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-blue.svg)](https://www.typescriptlang.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Enabled-green.svg)](https://www.w3.org/TR/webgpu/)
[![pnpm](https://img.shields.io/badge/pnpm-10.26.2-yellow.svg)](https://pnpm.io/)

A lightweight WebGPU retro engine for TypeScript, inspired by [RetroBlit](https://badcastle.itch.io/retroblit). Build
pixel-perfect 2D demos with a clean, fantasy-console-style API.

![Blit-Tech logo](assets/logo.png)

## Inspiration

Blit-Tech draws heavy inspiration from [RetroBlit](https://www.badcastle.com/retroblit/docs/doc/index.html), a retro
pixel demo framework for Unity created by Martin Cietwierkowski ([@daafu](https://github.com/daafu)). RetroBlit provides
an ideal environment for making pixel-perfect retro demos through a traditional demo loop and code-only development,
discarding the Unity Editor in favor of a clean, low-level API.

Blit-Tech brings a similar philosophy to the web using WebGPU: no scene graphs, no complex frameworks – just sprites,
primitives, and fonts.

## Features

- **WebGPU rendering** with dual-pipeline architecture (primitives + sprites); **Canvas 2D software fallback** that
  activates automatically when WebGPU is unavailable — or force it via `HardwareSettings.renderer: 'software'` or
  `?renderer=software` URL param. A dismissible in-canvas "SOFTWARE RENDERER" banner confirms fallback mode is active
- **Palette system**: 256-entry indexed color palette with built-in presets (VGA, CGA, C64, Game Boy, PICO-8, NES)
- **Palette effects**: cycling, fade, flash, swap with easing functions -- animated color manipulation each frame
- **Post-process effects**: two-tier system — **pixel tier** runs on the logical **`r8uint`** framebuffer (palette
  indices per pixel); the engine then **palette-LUT resolves and upscales** to RGBA at `canvasDisplaySize`; **display
  tier** runs on that RGBA (CRT scanlines, barrel curvature, RGB shadow mask, bloom, etc.). Both chains add zero cost
  when empty. Bundled `BT.preset.crtPipBoy()` / `amber()` / `green()` for one-line setup
- **Primitive drawing**: pixels, lines, rectangles (outline and filled)
- **Sprite system**: sprite sheets, palette-indexed textures, palette offset for color variations, automatic texture
  batching
- **Bitmap fonts**: variable-width font rendering with palette offset support
- **Camera system**: scrolling with offset/reset plus world clamping via `BT.cameraClamp` (all demo code must use the
  `BT` namespace exclusively; `clampCameraToWorld` is a low-level internal helper)
- **Asset loading**: sprite sheets and bitmap fonts from images with automatic caching
- **Pointer input**: mouse, touch, and pen unified under four pointer slots (`BT.pointerPos`, `BT.pointerDelta`,
  `BT.buttonDown` with `BTN_POINTER_A..D`); scroll delta, cursor hide/show, display-space coordinates
- **Keyboard input**: raw keys (`BT.keyDown`, `BT.keyPressed`, `BT.keyReleased` using `KeyboardEvent.code`), virtual
  face buttons (`BT.buttonDown` with `BTN_UP`…`BTN_SELECT`) with keyboard+gamepad merge for players 0–1, built-in
  default maps, remapping via `BT.inputMap` / `BT.inputMapReset`, and text accumulation via `BT.inputString`
- **Gamepad input**: up to four players via standard Gamepad API (`BT.gamepadConnected`, `BT.gamepadCount`,
  `BT.getAxis`), with stick dead zone and face-button support through `BT.button*`
- **Fixed timestep**: deterministic update loop with tick counter and timing helpers (`BT.deltaSeconds`,
  `BT.timeSeconds`, `Timer`)
- **Clean API**: all engine access through the `BT` namespace
- **Display scaling**: `canvasDisplaySize` drives the WebGPU drawing buffer and CSS size; logical draws stay
  index-native (`r8uint` at `displaySize`) until resolve/upscale. Engine `defaultConfig()` pairs `320x240` logical with
  `640x480` output (2x nearest) when a demo omits `configure()`

## Prerequisites

- **Node.js** v22 or higher (LTS)
- **pnpm** v10.26.2 or higher
- A **WebGPU-compatible browser**:
  - Chrome/Edge 113+ (Windows, macOS, Linux, Android)
  - Firefox 141+ on Windows; 145+/147+ on macOS; Nightly on Linux and Android
  - Safari 26+ (macOS Tahoe / iOS 26); or Safari 18–25 with WebGPU enabled via Feature Flags

## Installation

**Note:** Blit-Tech is currently in development and not yet published to npm. Clone the repository to use it:

```bash
git clone https://github.com/vancura/blit-tech.git
cd blit-tech
pnpm install
```

## Examples & Demos

For interactive examples and demos, visit the [Blit-Tech Demos repository](https://github.com/vancura/blit-tech-demos).
The demos showcase all engine features with a guided learning path from basic concepts to advanced techniques.

## Documentation

Additional documentation is available in the `docs/` directory:

- **[Testing Guide](docs/testing.md)** — Testing infrastructure, tiers, and WebGPU mocks
- **[Performance Testing Guide](docs/performance-testing.md)** — CPU benchmarks, browser frame-time tests, and CI perf
  workflows
- **[Performance Best Practices](docs/performance-best-practices.md)** — Optimization guidelines and performance tips
- **[Post-Process Effects Guide](docs/post-process-effects.md)** — Two-tier chains (pixel indices vs display RGBA),
  `PaletteResolveUpscalePass`, built-in effects and presets, writing custom effects, and shader attribution
- **[Bitmap Fonts Guide](docs/bitmap-fonts.md)** — Built-in system font, `.btfont` format spec, BMFont conversion, and
  font rendering API
- **[Input Guide](docs/input.md)** — Pointer, keyboard, and gamepad input; slot model; button masks; remapping; axis
  constants; scroll delta; and cursor control
- **[Developer Experience Guide](docs/developer-experience-guide.md)** — Development workflow and tooling (roadmap)

## Scripts

| Command                     | Description                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| `pnpm build`                | Build the library for npm distribution                                   |
| `pnpm lint`                 | Run ESLint                                                               |
| `pnpm lint:fix`             | Run ESLint with auto-fix                                                 |
| `pnpm format`               | Format all code (Biome + Prettier)                                       |
| `pnpm format:check`         | Check all formatting without changes                                     |
| `pnpm format:biome`         | Format TS/JS/JSON/CSS only (Biome)                                       |
| `pnpm format:prettier`      | Format Markdown/YAML/HTML/HBS (Prettier)                                 |
| `pnpm typecheck`            | Run TypeScript type checking                                             |
| `pnpm spellcheck`           | Check spelling in source files                                           |
| `pnpm test`                 | Run all unit tests (alias for `test:unit`)                               |
| `pnpm test:unit`            | Run all unit tests                                                       |
| `pnpm test:unit:watch`      | Run unit tests in watch mode                                             |
| `pnpm test:unit:coverage`   | Run unit tests with coverage report (80% threshold)                      |
| `pnpm test:visual`          | Playwright visual regression tests (requires Chrome with WebGPU)         |
| `pnpm test:visual:update`   | Update visual test baseline screenshots                                  |
| `pnpm test:visual:coverage` | Run visual tests with Istanbul coverage report                           |
| `pnpm bench`                | Run Tier 1 CPU benchmarks (Vitest bench)                                 |
| `pnpm bench:json`           | Run Tier 1 benchmarks and write `benchmark-results.json`                 |
| `pnpm preflight`            | Run all quality checks (format, lint, typecheck, spellcheck, knip, test) |
| `pnpm knip`                 | Find unused exports and dependencies                                     |
| `pnpm knip:fix`             | Auto-fix unused exports and dependencies                                 |
| `pnpm clean`                | Remove dist and cache directories                                        |
| `pnpm release`              | Build library and publish to npm                                         |
| `pnpm convert-font`         | Convert BMFont to .btfont format                                         |
| `pnpm system-font:export`   | Export system font data to PNG atlas (`assets/system-font.png`)          |
| `pnpm system-font:convert`  | Regenerate `systemFontData.ts` from edited PNG atlas                     |
| `pnpm security:audit`       | Run dependency security audit                                            |
| `pnpm security:audit:fix`   | Run dependency security audit and auto-fix                               |

## Quick Start

Create a demo by implementing the `IBlitTechDemo` interface. The optional `configure()` hook overrides engine defaults
(`320x240` logical, `640x480` output, `60` FPS from `defaultConfig()`); omit it for minimal demos.

```ts
import {
  bootstrap,
  BT,
  Color32,
  Palette,
  Rect2i,
  SpriteSheet,
  Vector2i,
  type HardwareSettings,
  type IBlitTechDemo,
} from '../src/BlitTech';

// Palette indices — give each color a named constant for readability.
const BG = 1;
const RED = 2;
const BLUE = 3;

class MyDemo implements IBlitTechDemo {
  /**
   * Optional: configures hardware settings for this demo.
   * Sets up a 320×240 internal resolution with optional output upscaling.
   *
   * @returns Hardware configuration specifying display size and target FPS.
   */
  configure(): HardwareSettings {
    return {
      displaySize: new Vector2i(320, 240), // Internal rendering resolution
      canvasDisplaySize: new Vector2i(640, 480), // Optional: CSS display size (2× upscale)
      targetFPS: 60,
      // detectDroppedFrames: true, // Optional: log a console warning on missed vsync
    };
  }

  /**
   * Initializes demo state after the engine is ready.
   * A palette must be set before any drawing calls are made.
   *
   * @returns Promise resolving to true when initialization succeeds.
   */
  async init(): Promise<boolean> {
    // Define the palette — all rendering uses indices into this table.
    const palette = new Palette(16);
    palette.set(BG, new Color32(20, 30, 40, 255));
    palette.set(RED, new Color32(255, 100, 50, 255));
    palette.set(BLUE, new Color32(50, 100, 255, 255));
    BT.paletteSet(palette);

    // Load assets here (sprites, fonts, etc.)
    // Preferred sprite setup path:
    // const indexed = await SpriteSheet.loadIndexed('assets/sprites.png', palette, 10);
    // const spriteSheet = indexed.sheet;
    // const spriteRect = indexed.srcRect;
    return true;
  }

  /**
   * Updates animation state based on ticks.
   */
  update(): void {
    // Demo logic at fixed timestep (60 FPS)
    // Pointer: BT.pointerPos(), BT.buttonDown(BT.BTN_POINTER_A)
    // Keyboard: BT.keyDown('KeyW'), BT.buttonDown(BT.BTN_A), BT.inputMap(0, BT.BTN_A, 'Space')
  }

  /**
   * Renders demo graphics.
   */
  render(): void {
    BT.clear(BG);
    BT.drawRectFill(new Rect2i(100, 100, 50, 50), RED);
    BT.drawRect(new Rect2i(160, 100, 50, 50), BLUE);
  }
}

// One-liner bootstrap - handles DOM ready, canvas lookup, backend selection, and error display
bootstrap(MyDemo);
```

For more control over initialization (without `bootstrap`):

```ts
import { BT, displayError, getCanvas } from '../src/BlitTech';

// Manual initialization — BT.init selects WebGPU or software fallback automatically
const canvas = getCanvas('my-canvas-id');
if (canvas) {
  const success = await BT.init(new MyDemo(), canvas);
  if (success) {
    console.log('Backend:', BT.getActiveBackend()); // 'webgpu' or 'software'
  } else {
    displayError('Initialization Failed', 'Engine could not start.');
  }
}
```

## Project Structure

```text
blit-tech/
├── src/
│   ├── BlitTech.ts             # Main API (BT namespace)
│   ├── assets/
│   │   ├── AssetLoader.ts      # Image loading with caching
│   │   ├── BitmapFont.ts       # Bitmap font system (.btfont)
│   │   ├── Palette.ts          # 256-entry indexed color palette
│   │   ├── PaletteEffect.ts    # Palette effect system (cycle, fade, flash, swap)
│   │   ├── SpriteSheet.ts      # GPU texture wrapper with palette indexization
│   │   └── palettes/           # Built-in preset palette data (VGA, CGA, C64, etc.) + HUD UI preset
│   ├── core/
│   │   ├── BTAPI.ts            # Internal API singleton
│   │   ├── GameLoop.ts         # Fixed-timestep game loop
│   │   ├── IBlitTechDemo.ts    # Demo interface + HardwareSettings
│   │   └── WebGPUContext.ts    # WebGPU adapter/device/context setup
│   ├── render/
│   │   ├── IRenderer.ts        # Backend-agnostic renderer contract (interface)
│   │   ├── WebGpuRenderer.ts   # WebGPU concrete renderer implementing IRenderer
│   │   ├── SoftwareRenderer.ts # Canvas 2D software fallback implementing IRenderer
│   │   ├── PrimitivePipeline.ts # Batched palette-indexed geometry
│   │   ├── SpritePipeline.ts   # Batched palette-indexed textured quads
│   │   ├── PostProcessChain.ts # Tier-aware fullscreen effect chain
│   │   ├── UpscalePass.ts      # RGBA texture upscale helper (tests / utilities)
│   │   ├── PaletteResolveUpscalePass.ts # r8uint indices -> RGBA + upscale to output size
│   │   └── effects/
│   │       ├── Effect.ts        # Effect interface + EffectTier
│   │       ├── FullscreenEffect.ts # Base class for typical fullscreen effects
│   │       ├── FullscreenPixelEffect.ts # Pixel-tier base (r8uint + RGBA shader variants)
│   │       ├── pixel/           # Pixel-tier (PixelGlitch, PixelMosaic)
│   │       ├── display/         # Display-tier (BarrelDistortion, Scanlines, ...)
│   │       └── presets/         # crtPipBoy, amber, green
│   ├── input/
│   │   ├── PointerInput.ts        # DOM-backed pointer / mouse / touch / pen tracker
│   │   ├── KeyboardInput.ts       # Key codes, edges, repeat, text buffer
│   │   └── defaultKeyboardMap.ts   # Default face-button key tables (VV-435)
│   ├── utils/
│   │   ├── Bootstrap.ts        # Demo bootstrap utilities
│   │   ├── BootstrapHelpers.ts # Canvas lookup and error display utilities
│   │   ├── Color32.ts          # 32-bit RGBA color
│   │   ├── Easing.ts           # Easing functions for palette effects
│   │   ├── FrameCapture.ts     # GPU readback + PNG export
│   │   ├── Rect2i.ts           # Integer rectangle
│   │   └── Vector2i.ts         # Integer 2D vector
│   └── __test__/
│       ├── webgpu-mock.ts      # WebGPU mock factories
│       └── setup.ts            # Vitest global setup (GPU constants + OffscreenCanvas stub)
├── tests/
│   └── visual/                 # Playwright visual regression tests
├── dist/                       # Built library output
├── docs/                       # Library documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── eslint.config.js
```

## API Reference

### Bootstrap Utilities

The bootstrap utilities provide a streamlined way to initialize demos with automatic backend selection and error
handling:

```ts
// One-liner demo startup (recommended)
bootstrap(MyDemo); // Uses defaults: canvas='blit-tech-canvas', container='canvas-container'

// With custom options
bootstrap(MyDemo, {
  canvasId: 'custom-canvas',
  containerId: 'error-container',
  onSuccess: () => console.log('Demo started!'),
  onError: (err) => trackError(err),
});

// Individual utilities for manual control
displayError(title, message, containerId?); // Show styled error in DOM
getCanvas(canvasId?); // Get canvas element safely
```

### Initialization

```ts
BT.init(demo, canvas); // Start the engine (low-level)
BT.displaySize(); // Get display resolution
BT.fps(); // Get target FPS
BT.deltaSeconds(); // Fixed-step seconds per update
BT.timeSeconds(); // Fixed-step elapsed seconds
BT.ticks(); // Get current tick count
BT.ticksReset(); // Reset tick counter

// Optional helper for periodic update events.
const spawnTimer = new Timer(180); // fire every 180 ticks
if (spawnTimer.tick(BT.ticks())) {
  spawnParticle();
}
```

A palette must be set via `BT.paletteSet()` before any draw calls are made. The recommended place is `init()` in the
demo, after sprite setup and before first render.

### Palette

The palette is the color authority for all rendering. Index 0 is always transparent.

```ts
// Create a palette and populate it
const palette = new Palette(16); // 16-color palette (valid sizes: 2, 4, 16, 32, 64, 128, 256)
palette.set(1, new Color32(255, 0, 0, 255)); // red at index 1
palette.set(2, new Color32(0, 255, 0, 255)); // green at index 2
BT.paletteSet(palette); // activate for rendering
BT.paletteGet(); // retrieve the active palette

// Optional named aliases
palette.setNamed('player', 3);
palette.getNamed('player'); // returns 3

// Built-in retro presets (create a full palette from preset data)
Palette.vga(); // VGA 256-color
Palette.cga(); // CGA 16-color
Palette.c64(); // Commodore 64 16-color
Palette.gameboy(); // Game Boy 4-shade
Palette.pico8(); // PICO-8 16-color
Palette.nes(); // NES 64-color

// Built-in HUD preset (fill 6 common UI slots into an existing palette)
const palette = new Palette(256);
palette.applyHUD(1); // fills slots 1-6: white, bg, label, header, dim, code
// and registers hud_white / hud_bg / hud_label / hud_header / hud_dim / hud_code aliases
palette.set(2, new Color32(20, 16, 32)); // override bg with your own color
BT.paletteSet(palette);

// Serialization
const json = palette.toJSON();
const restored = Palette.fromJSON(json);
```

### Palette Effects

Animated palette effects run automatically each frame, modifying palette entries in place. The renderer picks up changes
via the dirty flag and re-uploads the palette to the GPU.

```ts
// Cycle a range of palette entries (creates flowing water, fire, etc.)
BT.paletteCycle(start, end, speed); // speed: steps/second (positive=forward, negative=backward)

// Smooth fade between palettes (day/night transitions, etc.)
BT.paletteFade(targetPalette, durationMs); // fade entire palette
BT.paletteFade(targetPalette, durationMs, 'ease-in-out'); // with easing
BT.paletteFadeRange(start, end, targetPalette, durationMs, 'ease-out'); // fade a sub-range only

// Flash all palette entries to a single color (lightning, damage, etc.)
BT.paletteFlash(Color32.white(), 200); // 200ms flash

// Swap two palette entries instantly
BT.paletteSwap(indexA, indexB);

// Remove all active effects
BT.paletteClearEffects();
```

Available easing functions: `'linear'`, `'ease-in'`, `'ease-out'`, `'ease-in-out'`.

Effects are processed after `demo.render()` but before the GPU upload in `Renderer.endFrame()`, so user code and effects
never conflict. Multiple effects can run simultaneously on different palette ranges.

### Post-Process Effects

Two-tier fullscreen post-process system that runs between the scene render and the swap-chain present. Effects are
organized into two chains by what they operate on:

- **Pixel tier** — runs at the logical render resolution on an **`r8uint` index framebuffer** (one byte per pixel:
  palette slot per logical pixel). Uses integer texture loads so effects stay palette-native (chunky glitch, mosaic,
  etc.).
- **Palette resolve + upscale** — `PaletteResolveUpscalePass` converts indices to RGBA through the active palette LUT
  and scales to `canvasDisplaySize` (`nearest` or `linear` per `outputUpscaleFilter`). **RGBA for the display chain
  exists only after this pass** (see `docs/post-process-effects.md`).
- **Display tier** — runs at the canvas output resolution on that RGBA image. Hosts CRT scanlines, barrel curvature, RGB
  shadow mask, vignette, chromatic aberration, bloom, etc. Operating at output resolution lets curved sampling (barrel)
  stay smooth without quantizing onto the logical index grid.

Both chains add zero cost when empty. Post-process effects are unsupported by the Canvas 2D software backend — calling
`BT.effectAdd` / `BT.effectRemove` / `BT.effectClear` in software mode throws a clear error directing you to the WebGPU
backend. The display tier is already enabled when you omit `configure()` because `defaultConfig()` sets
`canvasDisplaySize` (and related fields). Implement `configure()` and set `canvasDisplaySize` there only when you need
to override those defaults (for example a different output or logical resolution than `defaultConfig()` provides).

```ts
import { BT, Vector2i, BarrelDistortion, Scanlines, Bloom, PixelGlitch } from 'blit-tech';

// In configure(): unlock the display tier and pick an output size.
return {
  displaySize: new Vector2i(320, 240),
  canvasDisplaySize: new Vector2i(1280, 960), // 4x integer scale
  outputUpscaleFilter: 'nearest',
  targetFPS: 60,
};

// In init(): mix and match effects from both tiers.
BT.effectAdd(new PixelGlitch()); // tier='pixel' on the effect routes automatically
BT.effectAdd(new BarrelDistortion());
BT.effectAdd(new Scanlines());
BT.effectAdd(new Bloom());

// Or use a preset for the full CRT look in one line:
for (const fx of BT.preset.crtPipBoy()) BT.effectAdd(fx);

// Tear down
BT.effectClear(); // clears both chains
```

**Built-in effects (pixel tier):** `PixelGlitch`, `PixelMosaic`.

**Built-in effects (display tier):** `BarrelDistortion`, `Scanlines`, `RGBMask`, `Vignette`, `ChromaticAberration`,
`Flicker`, `RollLine`, `Interference`, `Noise`, `Bloom`.

**Bundled presets:** `BT.preset.crtPipBoy()`, `BT.preset.amber()`, `BT.preset.green()`.

See the [Post-Process Effects Guide](docs/post-process-effects.md) for parameter reference, the `Effect` interface, the
`FullscreenEffect` base class, and how to write a custom effect.

### Drawing Primitives

All drawing methods accept a palette index instead of a `Color32` directly.

```ts
BT.clear(paletteIndex); // Clear screen
BT.clearRect(rect, paletteIndex); // Clear rectangular region
BT.drawPixel(pos, paletteIndex); // Draw single pixel
BT.drawLine(p0, p1, paletteIndex); // Draw line
BT.drawRect(rect, paletteIndex); // Draw rectangle outline
BT.drawRectFill(rect, paletteIndex); // Draw filled rectangle
```

### Asset Loading

```ts
// Load sprite sheet from image (automatically cached)
const spriteSheet = await SpriteSheet.load('path/to/sprites.png');

// Preferred one-call palette-indexed setup path
const indexed = await SpriteSheet.loadIndexed('path/to/sprites.png', palette, 10);
BT.paletteSet(palette);
BT.drawSprite(indexed.sheet, indexed.srcRect, new Vector2i(20, 20));

// Load bitmap font from .btfont file (automatically cached)
const font = await BitmapFont.load('fonts/MyFont.btfont');

// Load multiple images in parallel
const images = await AssetLoader.loadImages(['sprite1.png', 'sprite2.png']);

// Check if asset is already cached
if (AssetLoader.isLoaded('path/to/sprites.png')) {
  // Asset already loaded
}
```

### Sprites and Text

Sprites use a palette-first rendering model. Recommended setup uses `SpriteSheet.loadIndexed(...)`:

```ts
const palette = BT.paletteCreate(256);
const indexed = await SpriteSheet.loadIndexed('sprites/hero.png', palette, 10);
BT.paletteSet(palette);

BT.drawSprite(indexed.sheet, indexed.srcRect, destPos); // Draw with original palette colors
BT.drawSprite(indexed.sheet, indexed.srcRect, destPos, 16); // Draw with paletteOffset=16 (color variation)
BT.printFont(font, pos, text); // Draw text using bitmap font
BT.printFont(font, pos, text, 8); // Draw text with paletteOffset=8
BT.systemPrint(pos, paletteIndex, text); // Draw text with the built-in 6x14 system font
BT.systemPrintMeasure(text); // Measure system font text dimensions
BT.spritesRefresh(); // Re-index all loaded sheets after palette swap
```

Low-level setup remains available when needed:

```ts
await SpriteSheet.loadColorsIntoPalette('sprites/hero.png', palette, 10);
const sheet = await SpriteSheet.load('sprites/hero.png');
sheet.indexize(palette);
```

**Palette offset:** The `paletteOffset` parameter shifts which palette range a sprite samples from at draw time. Useful
for team colors, damage flashes, or palette-swap effects without duplicate assets.

**System font:** `BT.systemPrint()` renders text using the built-in 6x14 bitmap font. See the
[Bitmap Fonts Guide](docs/bitmap-fonts.md) for editing instructions. For custom bitmap fonts with proportional glyphs,
use `BT.printFont()` with a loaded `BitmapFont`.

**Sprite Transforms:** Sprite transform flags (`BT.FLIP_H`, `BT.FLIP_V`, `BT.ROT_90_CW`, etc.) are defined but not yet
implemented in `drawSprite()`. They are planned for a future release.

### Camera

```ts
BT.cameraSet(offset); // Set camera offset
BT.cameraGet(); // Get current offset
BT.cameraClamp(camera, worldSize, viewSize?); // Returns a new clamped camera Vector2i (does not mutate `camera`)
BT.cameraReset(); // Reset to (0, 0)
```

`viewSize` defaults to `BT.displaySize()` when omitted.

```ts
const camera = new Vector2i(500, 300);
const world = new Vector2i(640, 480);

const clamped = BT.cameraClamp(camera, world); // uses BT.displaySize() when viewSize is omitted
BT.cameraSet(clamped); // apply returned value
// camera is unchanged; BT.cameraClamp returns a new Vector2i.

BT.cameraReset(); // reset global camera offset to (0, 0)
```

### Core Types

```ts
// Vectors and rectangles
Vector2i(x, y); // Integer 2D vector
Rect2i(x, y, width, height); // Integer rectangle

// Colors (used to populate palette entries)
new Color32(r, g, b); // Create color from RGB (0-255)
new Color32(r, g, b, a); // Create color with alpha (0-255)

// Cached color constants (recommended for common colors)
Color32.white();
Color32.black();
Color32.red();
Color32.green();
Color32.blue();
Color32.yellow();
Color32.cyan();
Color32.magenta();
Color32.transparent();

// String helpers
Color32.fromHex('#ff8800'); // Parse #RGB/#RGBA/#RRGGBB/#RRGGBBAA (leading # optional)
Color32.resolveNamedColor('cornflowerblue'); // Resolve named color singleton (case-insensitive)

// Named color registry extensions
Color32.registerColor('my-ui-accent', new Color32(64, 128, 255)); // Add new name, throws if duplicate
Color32.updateColor('my-ui-accent', new Color32(80, 180, 255)); // Replace existing name
Color32.unregisterColor('my-ui-accent'); // Remove existing name

// Assets
SpriteSheet.load(url); // Load sprite sheet (static method)
SpriteSheet.loadIndexed(url, palette, startSlot, options?); // Register colors + load + indexize
BitmapFont.load(url); // Load bitmap font (static method)

// Timing helper
new Timer(intervalTicks); // Fixed-tick interval helper for update loops
```

### Input

#### Pointer (mouse, touch, pen)

The engine tracks up to four pointer slots. Slot 0 is always the mouse; slots 1-3 are touch and pen contacts assigned in
arrival order. All coordinates are in logical display space (the `displaySize` from `configure()` or defaults).

```ts
// Position and movement
BT.pointerPos(); // mouse position (slot 0), returns Vector2i
BT.pointerPos(1); // first touch contact position
BT.pointerDelta(); // mouse movement since last frame
BT.pointerDelta(1); // first touch contact movement
BT.pointerPosValid(); // true while mouse is inside the canvas
BT.pointerPosValid(1); // true while touch slot 1 is in contact
BT.pointerScrollDelta(); // vertical wheel delta in pixels for this frame

// Buttons — use with BT.buttonDown / buttonPressed / buttonReleased
// Second argument is the pointer slot (0 = mouse, 1-3 = touch / pen)
BT.buttonDown(BT.BTN_POINTER_A); // mouse left button held
BT.buttonDown(BT.BTN_POINTER_B); // mouse right button held
BT.buttonDown(BT.BTN_POINTER_C); // mouse middle button held
BT.buttonDown(BT.BTN_POINTER_D); // mouse back / forward button held
BT.buttonDown(BT.BTN_POINTER_A, 1); // first touch contact down
BT.buttonPressed(BT.BTN_POINTER_A); // mouse left — frame of press only
BT.buttonReleased(BT.BTN_POINTER_A); // mouse left — frame of release only

// Cursor
BT.hideCursor(); // hide the OS cursor over the canvas (draw your own)
BT.showCursor(); // restore the OS cursor
```

Button mapping for slot 0 (mouse) follows the RetroBlit canonical order:

- `BTN_POINTER_A` — left button (DOM button 0)
- `BTN_POINTER_B` — right button (DOM button 2)
- `BTN_POINTER_C` — middle button (DOM button 1)
- `BTN_POINTER_D` — back / forward extra buttons (DOM buttons 3 and 4)

Touch and pen slots only report `BTN_POINTER_A` while in contact; B, C, and D always return `false`.

See the [Input Guide](docs/input.md) for the full slot model, frame-timing semantics, and scroll delta details.

#### Keyboard

Raw keys use `KeyboardEvent.code` strings (for example `'KeyW'`, `'Space'`):

```ts
BT.keyDown('KeyA'); // held
BT.keyPressed('ArrowUp', 8); // edge + optional tick repeat
BT.keyReleased('Escape'); // release edge
BT.inputString(); // text since last frame (filtered `beforeinput`)
```

Face buttons (`BT.BTN_UP` through `BT.BTN_SELECT`) are bit flags. For **players 0 and 1**, `BT.button*` merges keyboard
maps and gamepad state (OR semantics). For **players 2 and 3**, `BT.button*` uses gamepad state only. Defaults match
`BT.DEFAULT_KEYBOARD_PLAYER1` and `BT.DEFAULT_KEYBOARD_PLAYER2`. Remap at runtime:

```ts
BT.inputMap(0, BT.BTN_UP, 'ArrowUp', 'KeyW');
BT.inputMapReset(); // restore built-in defaults for both keyboard players
```

#### Gamepad

```ts
BT.gamepadConnected(BT.PLAYER_ONE);
BT.gamepadCount();

BT.getAxis(BT.AXIS_LEFT_X, BT.PLAYER_ONE); // -1.0..1.0 (dead-zone filtered)
BT.getAxis(BT.AXIS_TRIGGER_L, BT.PLAYER_ONE); // 0.0..1.0
```

## Browser Compatibility

WebGPU support varies by browser:

| Browser     | Version        | Status                                                           |
| ----------- | -------------- | ---------------------------------------------------------------- |
| Chrome/Edge | 113+           | Enabled by default                                               |
| Firefox     | 141+ (Windows) | Enabled by default; 145+/147+ on macOS; Nightly on Linux/Android |
| Safari      | 26+            | Enabled by default; Safari 18–25 available via Feature Flags     |

When WebGPU is unavailable the engine automatically falls back to the Canvas 2D software renderer — no error page, no
hard stop. A dismissible in-canvas "SOFTWARE RENDERER" banner appears at the top of the canvas to confirm the fallback
is active; click or tap it to dismiss. Use `BT.getActiveBackend()` (returns `’webgpu’` or `’software’`) to detect which
backend is running at runtime.

## Technologies

- **WebGPU** — Modern GPU API for the web
- **TypeScript** — Type-safe JavaScript
- **Vite** — Fast build tool with HMR
- **WGSL** — WebGPU Shading Language
- **Biome** — Fast formatter and linter

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Developer Certificate of Origin (DCO) requirements
- Commit message format (Conventional Commits)
- Code style guidelines
- Pull request process

All commits must be signed off with a DCO. Use `git commit -s` to automatically add the sign-off.

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating. To report a security vulnerability, follow
the process in [SECURITY.md](SECURITY.md).

## License

ISC
