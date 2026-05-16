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

Blit-Tech draws heavy inspiration from [RetroBlit](https://www.badcastle.com/retroblit/docs/doc/index.html) by Martin
Cietwierkowski ([@daafu](https://github.com/daafu)) — a retro pixel demo framework for Unity that replaces the editor
with a clean, low-level demo loop. Blit-Tech brings the same philosophy to the web using WebGPU: no scene graphs, no
complex frameworks, just sprites, primitives, and fonts.

## Features

- **WebGPU rendering** with dual-pipeline architecture (primitives + sprites); automatic Canvas 2D software fallback
- **Palette system**: 256-entry indexed color palette with built-in presets (VGA, CGA, C64, Game Boy, PICO-8, NES)
- **Palette effects**: cycling, fade, flash, swap with easing functions — animated each frame
- **Post-process effects**: two-tier system — pixel tier on the `r8uint` index framebuffer; display tier on upscaled
  RGBA; bundled CRT presets
- **Primitive drawing**: pixels, lines, rectangles (outline and filled)
- **Sprite system**: palette-indexed textures, palette offset, automatic texture batching
- **Bitmap fonts**: variable-width rendering from `.btfont` files with palette offset support
- **Camera system**: scrolling with offset/reset and world-bounds clamping via `BT.cameraClamp`
- **Asset loading**: sprite sheets and bitmap fonts with automatic caching
- **Pointer input**: mouse, touch, and pen unified under four slots; scroll delta; cursor control
- **Keyboard input**: raw keys via `KeyboardEvent.code`, virtual face buttons, remapping, text accumulation
- **Gamepad input**: up to four players via standard Gamepad API, stick dead zone, face buttons
- **Fixed timestep**: deterministic update loop with tick counter, `Timer`, and timing helpers
- **Frame capture**: `BT.captureFrame()` and `BT.downloadFrame()` for PNG export

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

## Quick Start

```ts
import { bootstrap, BT, Color32, Palette, Rect2i, Vector2i, type IBlitTechDemo } from '../src/BlitTech';

const BG = 1;
const RED = 2;

class MyDemo implements IBlitTechDemo {
  async init(): Promise<boolean> {
    const palette = new Palette(16);
    palette.set(BG, new Color32(20, 30, 40, 255));
    palette.set(RED, new Color32(255, 100, 50, 255));
    BT.paletteSet(palette);
    return true;
  }

  update(): void {
    // fixed-step logic here
  }

  render(): void {
    BT.clear(BG);
    BT.drawRectFill(new Rect2i(100, 100, 50, 50), RED);
  }
}

bootstrap(MyDemo);
```

## Scripts

| Command                     | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `pnpm build`                | Build the library for npm distribution                                    |
| `pnpm lint`                 | Run ESLint                                                                |
| `pnpm lint:fix`             | Run ESLint with auto-fix                                                  |
| `pnpm format`               | Format all code (Biome + Prettier)                                        |
| `pnpm format:check`         | Check all formatting without changes                                      |
| `pnpm format:biome`         | Format TS/JS/JSON/CSS only (Biome)                                        |
| `pnpm format:prettier`      | Format Markdown/YAML/HTML/HBS (Prettier)                                  |
| `pnpm typecheck`            | Run TypeScript type checking                                              |
| `pnpm spellcheck`           | Check spelling in source files                                            |
| `pnpm test`                 | Run all unit tests (alias for `test:unit`)                                |
| `pnpm test:unit`            | Run all unit tests                                                        |
| `pnpm test:unit:watch`      | Run unit tests in watch mode                                              |
| `pnpm test:unit:coverage`   | Run unit tests with coverage report (80% threshold)                       |
| `pnpm test:declarations`    | Verify declaration-tooling log checks (TypeScript / API Extractor)        |
| `pnpm test:visual`          | Playwright visual regression tests (requires Chrome with WebGPU)          |
| `pnpm test:visual:update`   | Update visual test baseline screenshots                                   |
| `pnpm test:visual:coverage` | Run visual tests with Istanbul coverage report                            |
| `pnpm bench`                | Run Tier 1 CPU benchmarks (Vitest bench)                                  |
| `pnpm bench:json`           | Run Tier 1 benchmarks and write `benchmark-results.json`                  |
| `pnpm preflight`            | Run all quality checks (format, lint, typecheck, spellcheck, knip, tests) |
| `pnpm knip`                 | Find unused exports and dependencies                                      |
| `pnpm knip:fix`             | Auto-fix unused exports and dependencies                                  |
| `pnpm clean`                | Remove dist and cache directories                                         |
| `pnpm release`              | Build library and publish to npm                                          |
| `pnpm convert-font`         | Convert BMFont to .btfont format                                          |
| `pnpm system-font:export`   | Export system font data to PNG atlas (`assets/system-font.png`)           |
| `pnpm system-font:convert`  | Regenerate `systemFontData.ts` from edited PNG atlas                      |
| `pnpm security:audit`       | Run dependency security audit                                             |
| `pnpm security:audit:fix`   | Run dependency security audit and auto-fix                                |

## Documentation

| Guide                                                            | What it covers                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| [API: Core](docs/api-core.md)                                    | bootstrap, init, game loop, camera, Timer, core types  |
| [API: Rendering](docs/api-rendering.md)                          | primitives, sprites, text, post-process, frame capture |
| [API: Palette](docs/api-palette.md)                              | palette setup, presets, effects, serialization         |
| [API: Assets](docs/api-assets.md)                                | sprite sheets, bitmap fonts, asset loading             |
| [Input Guide](docs/input.md)                                     | pointer, keyboard, gamepad                             |
| [Post-Process Effects](docs/post-process-effects.md)             | effect chain, built-in effects, custom effects         |
| [Bitmap Fonts](docs/bitmap-fonts.md)                             | .btfont format, BMFont conversion                      |
| [Testing](docs/testing.md)                                       | test tiers, WebGPU mocks, visual regression            |
| [Performance Testing](docs/performance-testing.md)               | CPU benchmarks, CI regression checks                   |
| [Performance Best Practices](docs/performance-best-practices.md) | optimization guidelines                                |
| [Developer Experience](docs/developer-experience-guide.md)       | contributing workflow, IDE setup                       |
| [Voice Guide](docs/voice.md)                                     | error messages and user-facing string style            |

## Browser Compatibility

WebGPU support varies by browser:

| Browser     | Version        | Status                                                           |
| ----------- | -------------- | ---------------------------------------------------------------- |
| Chrome/Edge | 113+           | Enabled by default                                               |
| Firefox     | 141+ (Windows) | Enabled by default; 145+/147+ on macOS; Nightly on Linux/Android |
| Safari      | 26+            | Enabled by default; Safari 18–25 available via Feature Flags     |

When WebGPU is unavailable the engine falls back to the Canvas 2D software renderer automatically. A dismissible
in-canvas "SOFTWARE RENDERER" banner appears to confirm the fallback is active. Use `BT.getActiveBackend()` to detect
which backend is running at runtime.

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
