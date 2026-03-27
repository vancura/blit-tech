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
- **Primitive drawing**: pixels, lines, rectangles (outline and filled)
- **Sprite system**: sprite sheets, color tinting, transparency, automatic texture batching
- **Bitmap fonts**: variable-width font rendering with color support and text measurement
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
  - Firefox Nightly (with `dom.webgpu.enabled` in `about:config`)
  - Safari 18+ (macOS/iOS)

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

## Scripts

| Command                   | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `pnpm build`              | Build the library for npm distribution                                   |
| `pnpm lint`               | Run ESLint                                                               |
| `pnpm lint:fix`           | Run ESLint with auto-fix                                                 |
| `pnpm format`             | Format all code (Biome + Prettier)                                       |
| `pnpm format:check`       | Check all formatting without changes                                     |
| `pnpm format:biome`       | Format TS/JS/JSON/CSS only (Biome)                                       |
| `pnpm format:prettier`    | Format Markdown/YAML/HTML/HBS (Prettier)                                 |
| `pnpm typecheck`          | Run TypeScript type checking                                             |
| `pnpm spellcheck`         | Check spelling in source files                                           |
| `pnpm test`               | Run all unit tests (alias for `test:unit`)                               |
| `pnpm test:unit`          | Run all unit tests                                                       |
| `pnpm test:unit:watch`    | Run unit tests in watch mode                                             |
| `pnpm test:unit:coverage` | Run unit tests with coverage report (80% threshold)                      |
| `pnpm test:visual`        | Playwright visual regression tests (requires Chrome with WebGPU)         |
| `pnpm test:visual:update` | Update visual test baseline screenshots                                  |
| `pnpm preflight`          | Run all quality checks (format, lint, typecheck, spellcheck, knip, test) |
| `pnpm knip`               | Find unused exports and dependencies                                     |
| `pnpm clean`              | Remove dist and cache directories                                        |
| `pnpm release`            | Build library and publish to npm                                         |
| `pnpm convert-font`       | Convert BMFont to .btfont format                                         |
| `pnpm security:audit`     | Run dependency security audit                                            |

## Quick Start

Create a demo by implementing the `IBlitTechDemo` interface:

```ts
import { bootstrap, BT, Color32, Rect2i, Vector2i, type HardwareSettings, type IBlitTechDemo } from '../src/BlitTech';

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
   *
   * @returns Promise resolving to true when initialization succeeds.
   */
  async initialize(): Promise<boolean> {
    // Load assets here (sprites, fonts, etc.)
    // Example: const spriteSheet = await SpriteSheet.load('assets/sprites.png');
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
    BT.clear(new Color32(20, 30, 40)); // Custom colors
    BT.drawRectFill(new Rect2i(100, 100, 50, 50), new Color32(255, 100, 50));
    // Use cached colors when possible: Color32.white(), Color32.red(), etc.
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
  displayError('WebGPU Not Supported', 'Please use Chrome 113+ or Safari 18+');
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
│   │   └── SpriteSheet.ts      # GPU texture wrapper
│   ├── core/
│   │   ├── BTAPI.ts            # Internal API singleton
│   │   ├── GameLoop.ts         # Fixed-timestep game loop
│   │   ├── IBlitTechDemo.ts    # Demo interface + HardwareSettings
│   │   └── WebGPUContext.ts    # WebGPU adapter/device/context setup
│   ├── render/
│   │   ├── Renderer.ts         # High-level renderer (coordinates pipelines)
│   │   ├── PrimitivePipeline.ts # Batched colored geometry
│   │   └── SpritePipeline.ts   # Batched textured quads
│   ├── utils/
│   │   ├── Bootstrap.ts        # Demo bootstrap utilities
│   │   ├── BootstrapHelpers.ts # WebGPU detection, error display
│   │   ├── Color32.ts          # 32-bit RGBA color
│   │   ├── FrameCapture.ts     # GPU readback + PNG export
│   │   ├── Rect2i.ts           # Integer rectangle
│   │   └── Vector2i.ts         # Integer 2D vector
│   └── __test__/
│       ├── webgpu-mock.ts      # WebGPU mock factories
│       └── setup.ts            # Vitest global setup
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

### Drawing Primitives

```ts
BT.clear(color); // Clear screen
BT.clearRect(color, rect); // Clear rectangular region
BT.drawPixel(pos, color); // Draw single pixel
BT.drawLine(p0, p1, color); // Draw line
BT.drawRect(rect, color); // Draw rectangle outline
BT.drawRectFill(rect, color); // Draw filled rectangle
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

```ts
BT.drawSprite(sheet, srcRect, destPos, tint?); // Draw sprite from sprite sheet
BT.printFont(font, pos, text, color?); // Draw text using bitmap font
BT.print(pos, color, text); // Draw placeholder text (colored blocks)
```

**Note:** `BT.print()` renders text as colored blocks and is intended as a placeholder. Use `BT.printFont()` with a
`BitmapFont` for proper text rendering.

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

// Colors
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

| Browser     | Version | Status                      |
| ----------- | ------- | --------------------------- |
| Chrome/Edge | 113+    | Enabled by default          |
| Firefox     | Nightly | Enable `dom.webgpu.enabled` |
| Safari      | 18+     | Enabled by default          |

The engine displays an error message if the browser doesn’t support WebGPU.

## Technologies

- **WebGPU** — Modern GPU API for the web
- **TypeScript** — Type-safe JavaScript
- **Vite** — Fast build tool with HMR
- **WGSL** — WebGPU Shading Language
- **Biome** — Fast formatter and linter

## Assets & Fonts

### Sprite Sheets

Load sprite sheets from PNG images:

```ts
const spriteSheet = await SpriteSheet.load('assets/sprites.png');
BT.drawSprite(spriteSheet, new Rect2i(0, 0, 32, 32), new Vector2i(100, 100));
```

### Bitmap Fonts

Blit-Tech uses a custom `.btfont` JSON format for bitmap fonts. The format supports:

- Variable-width glyphs with per-character offsets
- Unicode character support
- Embedded or external textures (base64 or relative paths)

**Quick example:**

```ts
const font = await BitmapFont.load('fonts/MyFont.btfont');
BT.printFont(font, new Vector2i(10, 10), 'Hello World!', Color32.white());
const width = font.measureText('Hello'); // Measure text width
const size = font.measureTextSize('Hello'); // Get width and height
```

**Full documentation:** See [docs/bitmap-fonts.md](docs/bitmap-fonts.md) for:

- Complete `.btfont` format specification
- Converting from BMFont format using `pnpm convert-font`
- Font creation tips and tools
- API reference and examples

The bitmap font demos use **PragmataPro** by Fabrizio Schiavi, available at
[https://fsd.it/shop/fonts/pragmatapro/](https://fsd.it/shop/fonts/pragmatapro/).

## Documentation

Additional documentation is available in the `docs/` directory:

- **[Performance Best Practices](docs/performance-best-practices.md)** — Optimization guidelines and performance tips
- **[Bitmap Fonts](docs/bitmap-fonts.md)** — Complete guide to creating and using bitmap fonts
- **[Testing](docs/testing.md)** — Testing infrastructure, tiers, and WebGPU mocks
- **[Developer Experience Guide](docs/developer-experience-guide.md)** — Development workflow and tooling (roadmap)

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
