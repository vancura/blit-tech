# Blit-Tech

[![CI](https://github.com/vancura/blit-tech/actions/workflows/ci.yml/badge.svg)](https://github.com/vancura/blit-tech/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![WebGPU](https://img.shields.io/badge/WebGPU-Enabled-green.svg)](https://www.w3.org/TR/webgpu/)
[![pnpm](https://img.shields.io/badge/pnpm-10.26.2-yellow.svg)](https://pnpm.io/)

A palette-first WebGPU retro engine for TypeScript, inspired by [RetroBlit](https://badcastle.itch.io/retroblit). Draw
with palette indices, animate with palette cycling and fades, and ship authentic VGA-era effects on modern GPUs.

![Blit-Tech logo](assets/logo.png)

## Inspiration

Blit-Tech draws heavy inspiration from [RetroBlit](https://www.badcastle.com/retroblit/docs/doc/index.html) by Martin
Cietwierkowski ([@daafu](https://github.com/daafu)) — a retro pixel demo framework for Unity that replaces the editor
with a clean, low-level demo loop. Blit-Tech brings the same philosophy to the web using WebGPU: no scene graphs, no
complex frameworks, just sprites, primitives, and fonts.

## Features

- **True indexed rendering**: primitives and sprites write palette indices, not RGBA pixels
- **Palette effects built-in**: cycling, fade, flash, and swap run per frame with no per-sprite rewrites
- **Built-in retro palettes**: VGA, CGA, C64, Game Boy, PICO-8, and NES preset factories
- **Palette offset variants**: recolor one sprite sheet into team colors, states, or themes without duplicate textures
- **Performance-first data model**: tiny palette uploads (4 KB), smaller sprite textures, and compact primitive vertices
- **WebGPU rendering** with dual-pipeline architecture (primitives + sprites); automatic Canvas 2D software fallback
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

## Why Blit-Tech?

| Feature                  | Blit-Tech                           | Typical 2D WebGPU engines        |
| ------------------------ | ----------------------------------- | -------------------------------- |
| Rendering model          | Native indexed palette pipeline     | RGBA textures and framebuffers   |
| Color animation          | Palette cycling/fade/flash built-in | Manual sprite or shader rewrites |
| Global recolor/fade cost | One palette update                  | Scene redraw and blend passes    |
| Color variants           | Palette offsets                     | Duplicate assets or tint logic   |
| Retro palette presets    | C64, NES, Game Boy, CGA, VGA, etc.  | Usually custom/manual only       |

## Prerequisites

**Runtime (browser)**

- A **WebGPU-compatible browser** (the engine falls back to Canvas 2D software rendering when WebGPU is unavailable):
  - Chrome/Edge 113+ (Windows, macOS, Linux, Android)
  - Firefox 141+ on Windows; 145+/147+ on macOS; Nightly on Linux and Android
  - Safari 26+ (macOS Tahoe / iOS 26); or Safari 18–25 with WebGPU enabled via Feature Flags

**App toolchain**

- **Node.js** >=22.18.0 (LTS)
- An **ESM bundler** (Vite, webpack, esbuild, and similar) to load the published package in the browser

## Installation

Install **blit-tech** from npm (1.0.0):

```bash
pnpm add blit-tech
```

Or with npm:

```bash
npm install blit-tech
```

## Examples & Demos

For interactive examples and demos, visit the [Blit-Tech Demos repository](https://github.com/vancura/blit-tech-demos).

## Quick Start

`bootstrap()` expects a canvas inside `#canvas-container` (defaults: canvas id `blit-tech-canvas`, container id
`canvas-container`). Pair the HTML below with a TypeScript entry module in any ESM bundler setup.

**`index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Blit-Tech Demo</title>
  </head>
  <body>
    <div id="canvas-container"><canvas id="blit-tech-canvas"></canvas></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**`src/main.ts`**

```ts
import { bootstrap, BT, Color32, Palette, Rect2i, type IBlitTechDemo } from 'blit-tech';

const BG = 1;
const WATER_A = 9;
const WATER_B = 12;

class MyDemo implements IBlitTechDemo {
  async init(): Promise<boolean> {
    const palette = Palette.c64();
    palette.set(BG, new Color32(20, 30, 40, 255));
    BT.paletteSet(palette);

    // Animate every pixel that uses slots 9..12 (water/lava style cycling).
    BT.paletteCycle(WATER_A, WATER_B, 6);

    // Quick full-screen impact flash via palette manipulation.
    BT.paletteFlash(Color32.white, 120);

    return true;
  }

  update(): void {
    // fixed-step logic here
  }

  render(): void {
    BT.clear(BG);
    BT.drawRectFill(new Rect2i(100, 100, 50, 50), WATER_A);
  }
}

bootstrap(MyDemo);
```

**Scaffold and run** (Vite + TypeScript):

```bash
pnpm create vite my-demo --template vanilla-ts
cd my-demo
pnpm add blit-tech
# Add the HTML and main.ts snippets above, then:
pnpm dev
```

See [API: Core](docs/api-core.md) for `bootstrap()` options and
[Developer Experience](docs/developer-experience-guide.md) when working from a git clone.

## Developing the library

The commands below apply when building or contributing to **blit-tech** from a repository checkout (not when consuming
the npm package). See [CONTRIBUTING.md](CONTRIBUTING.md) for clone setup, DCO sign-off, and pull request workflow.

**Repository prerequisites:** **Node.js** >=22.18.0 (see `engines` in `package.json`); **pnpm** v10.26.2 or higher (see
`packageManager` in `package.json`).

### Scripts

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

## Documentation

| Guide                                                            | What it covers                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| [API: Core](docs/api-core.md)                                    | bootstrap, init, game loop, camera, Timer, core types  |
| [API: Rendering](docs/api-rendering.md)                          | primitives, sprites, text, post-process, frame capture |
| [API: Palette](docs/api-palette.md)                              | palette setup, presets, effects, serialization         |
| [Palette Guide](docs/palette-guide.md)                           | palette-first workflow, offsets, effects, performance  |
| [Palette Presets](docs/palette-presets.md)                       | built-in preset reference and exact color data         |
| [API: Assets](docs/api-assets.md)                                | sprite sheets, bitmap fonts, asset loading             |
| [Input Guide](docs/input.md)                                     | pointer, keyboard, gamepad                             |
| [Post-Process Effects](docs/post-process-effects.md)             | effect chain, built-in effects, custom effects         |
| [Bitmap Fonts](docs/bitmap-fonts.md)                             | .btfont format, BMFont conversion                      |
| [Testing](docs/testing.md)                                       | test tiers, WebGPU mocks, visual regression            |
| [Performance Testing](docs/performance-testing.md)               | CPU benchmarks, CI regression checks                   |
| [Performance Best Practices](docs/performance-best-practices.md) | optimization guidelines                                |
| [Developer Experience](docs/developer-experience-guide.md)       | contributing workflow, IDE setup                       |
| [Tooling](docs/tooling.md)                                       | TypeScript pin, declaration checks, CI enforcement     |
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
