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
pixel game framework for Unity created by **Martin Cietwierkowski**. RetroBlit provides an ideal environment for making
pixel-perfect retro games through a traditional game loop and code-only development, discarding the Unity Editor in
favor of a clean, low-level API. Blit-Tech brings similar philosophy to the web using WebGPU: no scene graphs, no
complex frameworks - just sprites, primitives, fonts, and tilemaps.

## Features

- **WebGPU rendering** with dual-pipeline architecture (primitives + sprites)
- **Primitive drawing**: pixels, lines, rectangles (outline and filled)
- **Sprite system**: sprite sheets, color tinting, transparency
- **Bitmap fonts**: variable-width font rendering with color support
- **Camera system**: scrolling with offset and reset
- **Asset loading**: sprite sheets and bitmap fonts from images
- **Fixed timestep**: deterministic 60 FPS game loop
- **Clean API**: all engine access through the `BT` namespace
- **Asset management**: sprite sheets and bitmap fonts with automatic caching

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

## Development

Start the development server with hot module replacement:

```bash
pnpm dev
```

The browser opens automatically at `http://localhost:5173/` and redirects to the examples gallery.

## Scripts

| Command                    | Description                               |
| -------------------------- | ----------------------------------------- |
| `pnpm dev`                 | Start dev server with HMR                 |
| `pnpm build`               | Type-check and build examples             |
| `pnpm build:lib`           | Build the library for npm distribution    |
| `pnpm build:deploy`        | Build examples for deployment             |
| `pnpm preview`             | Preview the production build              |
| `pnpm electron:dev`        | Run Electron with hot-reload              |
| `pnpm electron:dist`       | Build Electron app for current platform   |
| `pnpm electron:dist:linux` | Build Electron app for Linux (Steam Deck) |
| `pnpm lint`                | Run ESLint                                |
| `pnpm lint:fix`            | Run ESLint with auto-fix                  |
| `pnpm format`              | Format all code (Biome + Prettier)        |
| `pnpm format:check`        | Check all formatting without changes      |
| `pnpm format:biome`        | Format TS/JS/JSON/CSS only (Biome)        |
| `pnpm format:prettier`     | Format Markdown/YAML/HTML/HBS (Prettier)  |
| `pnpm typecheck`           | Run TypeScript type checking              |
| `pnpm clean`               | Remove dist and cache directories         |
| `pnpm changeset`           | Create a changeset for version bump       |
| `pnpm version:bump`        | Bump version based on changesets          |
| `pnpm release`             | Build library and publish to npm          |

## Quick Start

Create a game by implementing the `IBlitTechGame` interface:

```typescript
import { BT, Color32, Rect2i, Vector2i, type HardwareSettings, type IBlitTechGame } from '../src/BlitTech';

class MyGame implements IBlitTechGame {
  queryHardware(): HardwareSettings {
    return {
      displaySize: new Vector2i(320, 240),
      targetFPS: 60,
    };
  }

  async initialize(): Promise<boolean> {
    // Load assets here (sprites, fonts, etc.)
    // Example: const spriteSheet = await SpriteSheet.load('assets/sprites.png');
    return true;
  }

  update(): void {
    // Game logic at fixed timestep (60 FPS)
    // Note: Keyboard input (BT.keyDown, BT.keyPressed) is planned but not yet implemented
  }

  render(): void {
    BT.clear(Color32.fromRGB(20, 30, 40));
    BT.drawRectFill(new Rect2i(100, 100, 50, 50), Color32.fromRGB(255, 100, 50));
  }
}

// Initialize and run
const canvas = document.getElementById('game') as HTMLCanvasElement;
BT.initialize(new MyGame(), canvas);
```

## Project Structure

```text
blit-tech/
├── examples/                   # Interactive examples
│   ├── _config/
│   │   └── contexts.ts         # Page-specific template data
│   ├── _partials/              # Shared Handlebars templates
│   │   ├── layout-top.hbs      # Common HTML head and styles
│   │   ├── layout-bottom.hbs   # Common HTML footer
│   │   └── font-attribution.hbs
│   ├── index.html              # Examples gallery
│   ├── basics.html             # Basic example
│   ├── primitives.html         # Drawing primitives demo
│   ├── camera.html             # Camera scrolling demo
│   ├── patterns.html           # Animated patterns demo
│   ├── sprites.html            # Sprite rendering demo
│   └── fonts.html              # Bitmap font demo
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
│       ├── Color32.ts          # 32-bit color type
│       ├── Rect2i.ts           # Integer rectangle
│       └── Vector2i.ts         # Integer 2D vector
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

## API Reference

### Initialization

```typescript
BT.initialize(game, canvas); // Start the engine
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
// Load sprite sheet from image
const spriteSheet = await SpriteSheet.load('path/to/sprites.png');

// Load bitmap font from .btfont file
const font = await BitmapFont.load('fonts/MyFont.btfont');

// Load multiple images in parallel
const images = await AssetLoader.loadImages(['sprite1.png', 'sprite2.png']);
```

### Sprites and Text

```typescript
BT.drawSprite(sheet, srcRect, destPos, tint?); // Draw sprite from sprite sheet
BT.printFont(font, pos, text, color?); // Draw text using bitmap font
BT.print(pos, color, text); // Draw placeholder text (colored blocks)
```

**Note:** `BT.print()` renders text as colored blocks and is intended as a placeholder. Use `BT.printFont()` with a
`BitmapFont` for proper text rendering.

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
Color32.fromRGB(r, g, b); // Create color from RGB (0-255)
Color32.fromRGBA(r, g, b, a); // Create color with alpha (0-255)
Color32.white(); // Predefined colors
Color32.black();

// Assets
SpriteSheet.load(url); // Load sprite sheet (static method)
BitmapFont.load(url); // Load bitmap font (static method)
```

### Input

**Note:** Keyboard and gamepad input methods (`BT.keyDown()`, `BT.buttonDown()`, etc.) are planned but not yet
implemented. They currently return `false`. See the examples for workarounds.

## Examples

Run `pnpm dev` and visit the examples gallery:

- **Basic Example** — Simple game setup with a moving square
- **Primitives** — All drawing primitives showcase
- **Camera** — Scrolling world with mini-map
- **Patterns** — Animated mathematical patterns
- **Sprites** — Texture rendering with tinting
- **Bitmap Fonts** — Text rendering with custom fonts

## Deployment

### Web Deployment

Deploy the examples to any static hosting platform:

```bash
pnpm build:deploy
```

The `dist/` directory contains a ready-to-deploy static site with all examples.

### Desktop/Steam Deck Deployment

**NEW**: Package Blit-Tech as a native desktop app with Electron (optimized for Steam Deck):

```bash
# Run in development mode with hot-reload
pnpm electron:dev

# Build for Linux (AppImage, .deb, .tar.gz)
pnpm electron:dist:linux

# Build for current platform
pnpm electron:dist
```

**Note**: When running `pnpm install` for the first time, pnpm may prompt you to approve build scripts for Electron.
Select `electron` from the list and press enter to allow it to download the binary. If Electron fails to install, run
`pnpm rebuild electron`.

**Why Electron?**

- WebGPU support on Linux/Steam Deck (via Vulkan)
- Works in Steam Deck Game Mode
- Native app feel, appears in Steam library
- Cross-platform (Linux, Windows, macOS)

Output location: `dist-electron/`

## Browser Compatibility

WebGPU support varies by browser:

| Browser     | Version | Status                      |
| ----------- | ------- | --------------------------- |
| Chrome/Edge | 113+    | Enabled by default          |
| Firefox     | Nightly | Enable `dom.webgpu.enabled` |
| Safari      | 18+     | Enabled by default          |

The engine displays an error message if WebGPU is not supported.

## Technologies

- **WebGPU** — Modern GPU API for the web
- **TypeScript** — Type-safe JavaScript
- **Vite** — Fast build tool with HMR
- **WGSL** — WebGPU Shading Language

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
```

**Full documentation:** See [Bitmap Fonts in Wiki](https://github.com/vancura/blit-tech/wiki/Bitmap-Fonts) for:

- Complete `.btfont` format specification
- Converting from BMFont format
- Font creation tips and tools
- API reference and examples

The bitmap font examples use **PragmataPro** by Fabrizio Schiavi, available at
[https://fsd.it/shop/fonts/pragmatapro/](https://fsd.it/shop/fonts/pragmatapro/).

## License

ISC
