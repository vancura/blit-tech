# Blit-Tech

[![CI](https://github.com/vancura/blit-tech/actions/workflows/ci.yml/badge.svg)](https://github.com/vancura/blit-tech/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![pnpm](https://img.shields.io/badge/pnpm-10.24.0-yellow.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Enabled-green.svg)](https://www.w3.org/TR/webgpu/)

A lightweight WebGPU retro game engine for TypeScript, inspired by [RetroBlit](https://github.com/pixeltris/RetroBlit).
Build pixel-perfect 2D games with a clean, fantasy-console-style API.

## Features

- **WebGPU rendering** with dual-pipeline architecture (primitives + sprites)
- **Primitive drawing**: pixels, lines, rectangles (outline and filled)
- **Sprite system**: sprite sheets, color tinting, transparency
- **Bitmap fonts**: fixed-width font rendering with color support
- **Camera system**: scrolling with offset and reset
- **Asset loading**: sprite sheets and bitmap fonts from images
- **Fixed timestep**: deterministic 60 FPS game loop
- **Clean API**: all engine access through the `BT` namespace

## Prerequisites

- **Node.js** v20 or higher (LTS)
- **pnpm** v10.24.0 or higher
- A **WebGPU-compatible browser**:
  - Chrome/Edge 113+ (Windows, macOS, Linux, Android)
  - Firefox Nightly (with `dom.webgpu.enabled` in `about:config`)
  - Safari 18+ (macOS/iOS)

## Installation

Clone the repository:

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

The examples gallery opens automatically at `http://localhost:5173/examples/`.

## Scripts

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Start dev server with HMR              |
| `pnpm build`        | Type-check and build examples          |
| `pnpm build:lib`    | Build the library for npm distribution |
| `pnpm build:deploy` | Build examples for deployment          |
| `pnpm preview`      | Preview the production build           |
| `pnpm lint`         | Run ESLint                             |
| `pnpm lint:fix`     | Run ESLint with auto-fix               |
| `pnpm format`       | Format code with Biome                 |
| `pnpm format:check` | Check formatting without changes       |
| `pnpm typecheck`    | Run TypeScript type checking           |
| `pnpm clean`        | Remove dist and cache directories      |
| `pnpm changeset`    | Create a changeset for version bump    |
| `pnpm version:bump` | Bump version based on changesets       |
| `pnpm release`      | Build library and publish to npm       |

## Quick Start

Create a game by implementing the `IBlitTechGame` interface:

```typescript
import { BT, Color32, Rect2i, Vector2i, type HardwareSettings, type IBlitTechGame } from 'blit-tech';

class MyGame implements IBlitTechGame {
  queryHardware(): HardwareSettings {
    return {
      displaySize: new Vector2i(320, 240),
      mapSize: new Vector2i(128, 128),
      mapLayers: 4,
      chunkSize: new Vector2i(16, 16),
      targetFPS: 60,
    };
  }

  async initialize(): Promise<boolean> {
    // Load assets here
    return true;
  }

  update(): void {
    // Game logic at fixed timestep
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
│   ├── examples-index.html     # Examples gallery
│   ├── index.html              # Basic example
│   ├── primitives.html         # Drawing primitives demo
│   ├── camera.html             # Camera scrolling demo
│   ├── patterns.html           # Animated patterns demo
│   ├── sprite.html             # Sprite rendering demo
│   └── font.html               # Bitmap font demo
├── src/
│   ├── BlitTech.ts             # Main API (BT namespace)
│   ├── main.ts                 # Dev entry point
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
├── index.html                  # Dev entry HTML
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
BT.mapSize(); // Get tilemap size
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

### Sprites and Text

```typescript
BT.drawSprite(sheet, srcRect, destPos, tint?); // Draw sprite
BT.printFont(font, pos, text, color?); // Draw bitmap text
BT.print(pos, color, text); // Draw basic text
```

### Camera

```typescript
BT.cameraSet(offset); // Set camera offset
BT.cameraGet(); // Get current offset
BT.cameraReset(); // Reset to (0, 0)
```

### Core Types

```typescript
Vector2i(x, y); // Integer 2D vector
Rect2i(x, y, width, height); // Integer rectangle
Color32.fromRGB(r, g, b); // Create color from RGB
Color32.fromRGBA(r, g, b, a); // Create color with alpha
```

## Examples

Run `pnpm dev` and visit the examples gallery:

- **Basic Example** — Simple game setup with a moving square
- **Primitives** — All drawing primitives showcase
- **Camera** — Scrolling world with mini-map
- **Patterns** — Animated mathematical patterns
- **Sprites** — Texture rendering with tinting
- **Bitmap Fonts** — Text rendering with custom fonts

## Deployment

Deploy the examples to any static hosting platform:

```bash
pnpm build:deploy
```

The `dist/` directory contains a ready-to-deploy static site with all examples.

**Supported Platforms:**

- GitHub Pages
- FastFront.io
- StaticHost.eu
- Coolify
- Hetzner
- Uberspace
- Ploi.cloud
- And any static host!

**📚 Full deployment guide:** See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions for each platform.

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

## License

ISC
