# Blit-Tech

[![CI](https://github.com/vancura/blit-tech/actions/workflows/ci.yml/badge.svg)](https://github.com/vancura/blit-tech/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
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

- **WebGPU rendering** with dual-pipeline architecture (primitives + sprites)
- **Palette system**: 256-entry indexed color palette with built-in presets (VGA, CGA, C64, Game Boy, PICO-8, NES)
- **Palette effects**: cycling, fade, flash, swap with easing functions -- animated color manipulation each frame
- **Primitive drawing**: pixels, lines, rectangles (outline and filled)
- **Sprite system**: sprite sheets, palette-indexed textures, palette offset for color variations, automatic texture
  batching
- **Bitmap fonts**: variable-width font rendering with palette offset support
- **Camera system**: scrolling with offset and reset
- **Asset loading**: sprite sheets and bitmap fonts from images with automatic caching
- **Fixed timestep**: deterministic 60 FPS loop with tick counter
- **Clean API**: all engine access through the `BT` namespace
- **Display scaling**: optional CSS upscaling via `canvasDisplaySize` for crisp pixel art

## Prerequisites

- **Node.js** v20 or higher (LTS)
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
- **[Bitmap Fonts Guide](docs/bitmap-fonts.md)** — Built-in system font, `.btfont` format spec, BMFont conversion, and
  font rendering API
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
| `pnpm test:perf`            | Run Tier 2 browser/GPU frame-time benchmarks (Playwright)                |
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

Create a demo by implementing the `IBlitTechDemo` interface:

```ts
import {
  bootstrap,
  BT,
  Color32,
  Palette,
  Rect2i,
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
   * Configures hardware settings for this demo.
   * Sets up a 320×240 internal resolution with optional CSS upscaling.
   *
   * @returns Hardware configuration specifying display size and target FPS.
   */
  queryHardware(): HardwareSettings {
    return {
      displaySize: new Vector2i(320, 240), // Internal rendering resolution
      canvasDisplaySize: new Vector2i(640, 480), // Optional: CSS display size (2× upscale)
      targetFPS: 60,
    };
  }

  /**
   * Initializes demo state after the engine is ready.
   * A palette must be set before any drawing calls are made.
   *
   * @returns Promise resolving to true when initialization succeeds.
   */
  async initialize(): Promise<boolean> {
    // Define the palette — all rendering uses indices into this table.
    const palette = new Palette(16);
    palette.set(BG, new Color32(20, 30, 40, 255));
    palette.set(RED, new Color32(255, 100, 50, 255));
    palette.set(BLUE, new Color32(50, 100, 255, 255));
    BT.paletteSet(palette);

    // Load assets here (sprites, fonts, etc.)
    // Example: const spriteSheet = await SpriteSheet.load('assets/sprites.png');
    // After loading: spriteSheet.indexize(palette);
    return true;
  }

  /**
   * Updates animation state based on ticks.
   */
  update(): void {
    // Demo logic at fixed timestep (60 FPS)
    // Note: Keyboard input (BT.keyDown, BT.keyPressed) is planned but not yet implemented
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

// One-liner bootstrap - handles WebGPU detection, DOM ready, and error display
bootstrap(MyDemo);
```

For more control over initialization:

```ts
import { BT, checkWebGPUSupport, displayError, getCanvas } from '../src/BlitTech';

// Manual initialization with custom error handling
if (!checkWebGPUSupport()) {
  displayError(
    'WebGPU Not Supported',
    'Please use a WebGPU-compatible browser (Chrome/Edge 113+, Firefox 141+ on Windows, Safari 18+ with Feature Flags or Safari 26+).',
  );
} else {
  const canvas = getCanvas('my-canvas-id');
  if (canvas) {
    await BT.initialize(new MyDemo(), canvas);
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
│   │   └── palettes/           # Built-in preset palette data (VGA, CGA, C64, etc.)
│   ├── core/
│   │   ├── BTAPI.ts            # Internal API singleton
│   │   ├── GameLoop.ts         # Fixed-timestep game loop
│   │   ├── IBlitTechDemo.ts    # Demo interface + HardwareSettings
│   │   └── WebGPUContext.ts    # WebGPU adapter/device/context setup
│   ├── render/
│   │   ├── Renderer.ts         # High-level renderer (coordinates pipelines)
│   │   ├── PrimitivePipeline.ts # Batched palette-indexed geometry
│   │   └── SpritePipeline.ts   # Batched palette-indexed textured quads
│   ├── utils/
│   │   ├── Bootstrap.ts        # Demo bootstrap utilities
│   │   ├── BootstrapHelpers.ts # WebGPU detection, error display
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

The bootstrap utilities provide a streamlined way to initialize demos with automatic WebGPU detection and error
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
checkWebGPUSupport(); // Returns true if WebGPU is available
displayError(title, message, containerId?); // Show styled error in DOM
getCanvas(canvasId?); // Get canvas element safely
```

### Initialization

```ts
BT.initialize(demo, canvas); // Start the engine (low-level)
BT.displaySize(); // Get display resolution
BT.fps(); // Get target FPS
BT.ticks(); // Get current tick count
BT.ticksReset(); // Reset tick counter
```

A palette must be set via `BT.paletteSet()` before any draw calls are made. The recommended place is `initialize()` in
the demo, before loading any sprite sheets.

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

// Built-in retro presets
Palette.vga(); // VGA 256-color
Palette.cga(); // CGA 16-color
Palette.c64(); // Commodore 64 16-color
Palette.gameboy(); // Game Boy 4-shade
Palette.pico8(); // PICO-8 16-color
Palette.nes(); // NES 64-color

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

Sprites use a palette-first rendering model. Every sprite sheet must be converted to palette indices before drawing:

```ts
// Convert RGBA pixels to palette indices (call once after paletteSet).
spriteSheet.indexize(palette);

BT.drawSprite(sheet, srcRect, destPos); // Draw with original palette colors
BT.drawSprite(sheet, srcRect, destPos, 16); // Draw with paletteOffset=16 (color variation)
BT.printFont(font, pos, text); // Draw text using bitmap font
BT.printFont(font, pos, text, 8); // Draw text with paletteOffset=8
BT.systemPrint(pos, paletteIndex, text); // Draw text with the built-in 6x14 system font
BT.systemPrintMeasure(text); // Measure system font text dimensions
BT.spritesRefresh(); // Re-index all loaded sheets after palette swap
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
BT.cameraReset(); // Reset to (0, 0)
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

// Assets
SpriteSheet.load(url); // Load sprite sheet (static method)
BitmapFont.load(url); // Load bitmap font (static method)
```

### Input

**Note:** Keyboard and gamepad input methods (`BT.keyDown()`, `BT.keyPressed()`, `BT.buttonDown()`, etc.) are planned
but not yet implemented. They currently return `false`. Button constants (`BT.BTN_UP`, `BT.BTN_A`, etc.) are defined for
future use. See the Blit-Tech Demos repository for workarounds using browser APIs directly.

## Browser Compatibility

WebGPU support varies by browser:

| Browser     | Version        | Status                                                           |
| ----------- | -------------- | ---------------------------------------------------------------- |
| Chrome/Edge | 113+           | Enabled by default                                               |
| Firefox     | 141+ (Windows) | Enabled by default; 145+/147+ on macOS; Nightly on Linux/Android |
| Safari      | 26+            | Enabled by default; Safari 18–25 available via Feature Flags     |

The engine displays an error message if the browser doesn’t support WebGPU.

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
