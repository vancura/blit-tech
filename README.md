# Blit-Tech

[![CI](https://github.com/vancura/blit-tech/actions/workflows/ci.yml/badge.svg)](https://github.com/vancura/blit-tech/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Enabled-green.svg)](https://www.w3.org/TR/webgpu/)
[![pnpm](https://img.shields.io/badge/pnpm-10.24.0-yellow.svg)](https://pnpm.io/)

A lightweight WebGPU retro game engine for TypeScript, inspired by [RetroBlit](https://badcastle.itch.io/retroblit).
Build pixel-perfect 2D games with a clean, fantasy-console-style API.

![Blit-Tech logo](assets/logo.png)

## Inspiration

Blit-Tech draws heavy inspiration from [RetroBlit](https://www.badcastle.com/retroblit/docs/doc/index.html), a retro
pixel game framework for Unity created by Martin Cietwierkowski ([@daafu](https://github.com/daafu)). RetroBlit provides
an ideal environment for making pixel-perfect retro games through a traditional game loop and code-only development,
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
- **Fixed timestep**: deterministic 60 FPS game loop with tick counter
- **Clean API**: all engine access through the `BT` namespace
- **Display scaling**: optional CSS upscaling via `canvasDisplaySize` for crisp pixel art

## Prerequisites

- **Node.js** v20 or higher (LTS)
- **pnpm** v10.24.0 or higher
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

For interactive examples and demos, visit the **[blit-tech-demos](../blit-tech-demos)** repository. The demos showcase
all engine features with a guided learning path from basic concepts to advanced techniques.

## Scripts

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `pnpm build`           | Build the library for npm distribution                       |
| `pnpm lint`            | Run ESLint                                                   |
| `pnpm lint:fix`        | Run ESLint with auto-fix                                     |
| `pnpm format`          | Format all code (Biome + Prettier)                           |
| `pnpm format:check`    | Check all formatting without changes                         |
| `pnpm format:biome`    | Format TS/JS/JSON/CSS only (Biome)                           |
| `pnpm format:prettier` | Format Markdown/YAML/HTML/HBS (Prettier)                     |
| `pnpm typecheck`       | Run TypeScript type checking                                 |
| `pnpm spellcheck`      | Check spelling in source files                               |
| `pnpm preflight`       | Run all quality checks (format, lint, typecheck, spellcheck) |
| `pnpm clean`           | Remove dist and cache directories                            |
| `pnpm changeset`       | Create a changeset for version bump                          |
| `pnpm changeset:check` | Check for pending changesets                                 |
| `pnpm version:bump`    | Bump version based on changesets                             |
| `pnpm release`         | Build library and publish to npm                             |
| `pnpm convert-font`    | Convert BMFont to .btfont format                             |
| `pnpm sync-rules`      | Sync AI assistant rules across files                         |

## Quick Start

Create a game by implementing the `IBlitTechGame` interface:

```typescript
import { bootstrap, BT, Color32, Rect2i, Vector2i, type HardwareSettings, type IBlitTechGame } from '../src/BlitTech';

class MyGame implements IBlitTechGame {
  /**
   * Configures hardware settings for this game.
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
   * Initializes game state after the engine is ready.
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
    // Game logic at fixed timestep (60 FPS)
    // Note: Keyboard input (BT.keyDown, BT.keyPressed) is planned but not yet implemented
  }

  /**
   * Renders game graphics.
   */
  render(): void {
    BT.clear(new Color32(20, 30, 40)); // Custom colors
    BT.drawRectFill(new Rect2i(100, 100, 50, 50), new Color32(255, 100, 50));
    // Use cached colors when possible: Color32.white(), Color32.red(), etc.
  }
}

// One-liner bootstrap - handles WebGPU detection, DOM ready, and error display
bootstrap(MyGame);
```

For more control over initialization:

```typescript
import { BT, checkWebGPUSupport, displayError, getCanvas } from '../src/BlitTech';

// Manual initialization with custom error handling
if (!checkWebGPUSupport()) {
  displayError('WebGPU Not Supported', 'Please use Chrome 113+ or Safari 18+');
} else {
  const canvas = getCanvas('my-canvas-id');
  if (canvas) {
    await BT.initialize(new MyGame(), canvas);
  }
}
```

## Project Structure

```text
blit-tech/
├── src/
│   ├── BlitTech.ts             # Main API (BT namespace)
│   ├── assets/
│   │   ├── AssetLoader.ts      # Image/asset loading
│   │   ├── BitmapFont.ts       # Bitmap font system
│   │   └── SpriteSheet.ts      # Sprite sheet handling
│   ├── core/
│   │   ├── BTAPI.ts            # Internal API implementation
│   │   └── IBlitTechGame.ts    # Game interface
│   ├── render/
│   │   └── Renderer.ts         # WebGPU renderer
│   └── utils/
│       ├── Bootstrap.ts        # Game bootstrap utilities
│       ├── Color32.ts          # 32-bit color type
│       ├── Rect2i.ts           # Integer rectangle
│       └── Vector2i.ts         # Integer 2D vector
├── dist/                       # Built library output
├── docs/                       # Library documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## API Reference

### Bootstrap Utilities

The bootstrap utilities provide a streamlined way to initialize games with automatic WebGPU detection and error
handling:

```typescript
// One-liner game startup (recommended)
bootstrap(MyGame); // Uses defaults: canvas='game-canvas', container='canvas-container'

// With custom options
bootstrap(MyGame, {
  canvasId: 'custom-canvas',
  containerId: 'error-container',
  onSuccess: () => console.log('Game started!'),
  onError: (err) => trackError(err),
});

// Individual utilities for manual control
checkWebGPUSupport(); // Returns true if WebGPU is available
displayError(title, message, containerId?); // Show styled error in DOM
getCanvas(canvasId?); // Get canvas element safely
```

### Initialization

```typescript
BT.initialize(game, canvas); // Start the engine (low-level)
BT.displaySize(); // Get display resolution
BT.fps(); // Get target FPS
BT.ticks(); // Get current tick count
BT.ticksReset(); // Reset tick counter
```

### Drawing Primitives

```typescript
BT.clear(color); // Clear screen
BT.clearRect(color, rect); // Clear rectangular region
BT.drawPixel(pos, color); // Draw single pixel
BT.drawLine(p0, p1, color); // Draw line
BT.drawRect(rect, color); // Draw rectangle outline
BT.drawRectFill(rect, color); // Draw filled rectangle
```

### Asset Loading

```typescript
// Load sprite sheet from image (automatically cached)
const spriteSheet = await SpriteSheet.load('path/to/sprites.png');

// Load bitmap font from .btfont file (automatically cached)
const font = await BitmapFont.load('fonts/MyFont.btfont');

// Load multiple images in parallel
const images = await AssetLoader.loadImages(['sprite1.png', 'sprite2.png']);

// Check if asset is already cached
if (AssetLoader.isCached('path/to/sprites.png')) {
  // Asset already loaded
}
```

### Sprites and Text

```typescript
BT.drawSprite(sheet, srcRect, destPos, tint?); // Draw sprite from sprite sheet
BT.printFont(font, pos, text, color?); // Draw text using bitmap font
BT.print(pos, color, text); // Draw placeholder text (colored blocks)
```

**Note:** `BT.print()` renders text as colored blocks and is intended as a placeholder. Use `BT.printFont()` with a
`BitmapFont` for proper text rendering.

**Sprite Transforms:** Sprite transform flags (`BT.FLIP_H`, `BT.FLIP_V`, `BT.ROT_90_CW`, etc.) are defined but not yet
implemented in `drawSprite()`. They are planned for a future release.

### Camera

```typescript
BT.cameraSet(offset); // Set camera offset
BT.cameraGet(); // Get current offset
BT.cameraReset(); // Reset to (0, 0)
```

### Core Types

```typescript
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
future use. See the [blit-tech-demos](../blit-tech-demos) repository for workarounds using browser APIs directly.

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
- **Changesets** — Version management and changelog generation

## Assets & Fonts

### Sprite Sheets

Load sprite sheets from PNG images:

```typescript
const spriteSheet = await SpriteSheet.load('assets/sprites.png');
BT.drawSprite(spriteSheet, new Rect2i(0, 0, 32, 32), new Vector2i(100, 100));
```

### Bitmap Fonts

Blit-Tech uses a custom `.btfont` JSON format for bitmap fonts. The format supports:

- Variable-width glyphs with per-character offsets
- Unicode character support
- Embedded or external textures (base64 or relative paths)

**Quick example:**

```typescript
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
- **[Testing Guide](docs/testing-guide.md)** — Testing infrastructure setup and best practices
- **[Developer Experience Guide](docs/developer-experience-guide.md)** — Development workflow and tooling

## License

ISC
