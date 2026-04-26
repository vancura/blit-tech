# Blit-Tech

Lightweight WebGPU retro engine for TypeScript, inspired by RetroBlit. Pixel-perfect 2D rendering with a
fantasy-console-style API.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Browser (WebGPU)
- **Build:** Vite + vite-plugin-dts
- **Formatting:** Biome (TS/JS) + Prettier (MD/YAML)
- **Linting:** ESLint with perfectionist, jsdoc, security, promise plugins
- **Spelling:** cspell
- **Dead code:** knip
- **Commits:** Conventional Commits + DCO sign-off + commitlint
- **Package manager:** pnpm

## Architecture

All engine functionality is accessed through the static `BT` namespace. Demos implement the `IBlitTechDemo` interface
(`queryHardware`, `initialize`, `update`, `render`).

```text
src/
  BlitTech.ts              # Public API (BT namespace exports)
  core/
    BTAPI.ts               # Internal singleton managing subsystems
    IBlitTechDemo.ts       # Demo interface + HardwareSettings
    GameLoop.ts            # Fixed-timestep game loop
    WebGPUContext.ts       # WebGPU adapter/device/context setup
  render/
    Renderer.ts            # High-level renderer (coordinates pipelines + chains)
    PrimitivePipeline.ts   # Batched colored geometry (pixels, lines, rects)
    SpritePipeline.ts      # Batched textured quads (sprites, bitmap text)
    PostProcessChain.ts    # Tier-aware fullscreen effect chain
    UpscalePass.ts         # Logical -> output upscale (nearest/linear)
    effects/
      Effect.ts            # Effect interface + EffectTier
      FullscreenEffect.ts  # Base class for typical fullscreen effects
      pixel/               # Pixel-tier effects (PixelGlitch, PixelMosaic)
      display/             # Display-tier effects (BarrelDistortion, Scanlines, ...)
      presets/             # Pre-configured stacks (crtPipBoy, amber, green)
  assets/
    AssetLoader.ts         # Image loading with caching
    SpriteSheet.ts         # GPU texture wrapper
    BitmapFont.ts          # Bitmap font system (.btfont)
    Palette.ts             # 256-entry indexed color palette
    PaletteEffect.ts       # Palette effect system (cycle, fade, flash, swap)
    palettes/              # Built-in preset palette data (VGA, CGA, C64, etc.)
  utils/
    Bootstrap.ts           # Demo bootstrap utilities
    BootstrapHelpers.ts    # WebGPU detection, canvas lookup, error display
    Vector2i.ts            # Integer 2D vector
    Rect2i.ts              # Integer rectangle
    Color32.ts             # 32-bit RGBA color
    Easing.ts              # Easing functions for palette effects
    FrameCapture.ts        # GPU readback + PNG export
  __test__/
    webgpu-mock.ts         # WebGPU mock factories for tests
    setup.ts               # Vitest global setup (GPU constants)
```

### Rendering

Dual WebGPU pipeline architecture:

1. **Primitives pipeline** - colored geometry (pixels, lines, rects). Max 50k vertices/frame.
2. **Sprites pipeline** - textured quads with tinting. Max 50k vertices (~8333 quads). Nearest-neighbor sampling.
   Auto-batched by texture.

### Core Types

- `Vector2i` - integer 2D vector. Constructor auto-floors. Has `width`/`height` aliases.
- `Rect2i` - integer rectangle. Methods: `contains()`, `intersects()`, `intersection()`.
- `Color32` - 32-bit RGBA (0-255). Static colors, hex/RGB parsing, float array conversion.

## Critical Rules

1. **No emoji** - nowhere: code, docs, commits, PR titles, errors, logs
2. **Integer coordinates** - all rendering uses `Vector2i`/`Rect2i`, never floats
3. **Performance first** - minimize allocations in update/render, reuse buffers, batch draws
4. **Use BT namespace** - never access `BTAPI` directly from demo code
5. **No `any` types** - use `unknown` or proper types
6. **Type-only imports** - `import type { ... }` for types

## Code Style

- 4-space indent, 120-char line width
- Single quotes, always semicolons, always trailing commas
- Always arrow parens
- Named exports only (no default exports)
- JSDoc required for public APIs
- Use `// #region` / `// #endregion` for sections in files >100 lines

## Commands

```bash
pnpm build              # Build library
pnpm lint               # ESLint
pnpm lint:fix           # ESLint with auto-fix
pnpm format             # Format all files (Biome + Prettier)
pnpm format:check       # Check formatting (Biome + Prettier)
pnpm typecheck          # TypeScript type checking
pnpm spellcheck         # cspell check
pnpm knip               # Find unused exports/deps
pnpm preflight          # All checks (format + lint + typecheck + spellcheck + knip + test:unit)
```

## Testing

Test files are colocated next to source: `src/utils/Vector2i.test.ts`.

```bash
pnpm test                # Run all unit tests (alias for test:unit)
pnpm test:unit           # Run all unit tests
pnpm test:unit:watch     # Watch mode for development
pnpm test:unit:coverage  # Coverage report (80% minimum threshold)
pnpm test:visual         # Playwright visual regression (requires Chrome)
pnpm test:visual:update  # Update visual test baselines
pnpm bench               # Run Tier 1 CPU benchmarks (Vitest bench)
pnpm bench:json          # Run Tier 1 benchmarks and write benchmark-results.json
pnpm test:perf           # Run Tier 2 browser/GPU frame-time benchmarks
```

**Test tiers:**

1. **Unit tests** (Vitest, node) - Pure logic: Vector2i, Rect2i, Color32, Palette, PaletteEffect, Easing, GameLoop
2. **Integration tests** (Vitest, Node + GPU mocks; happy-dom for DOM tests) - DOM and GPU code
3. **Visual regression** (Playwright, Chromium) - Rendering output verification
4. **Performance tests**
   - Tier 1 CPU benchmarks (Vitest bench, `*.bench.ts`) for hot methods and allocation patterns
   - Tier 2 GPU perf tests (Playwright, `tests/perf/`) for browser frame-time workloads

**WebGPU mocks:** Use `src/__test__/webgpu-mock.ts` for tests needing GPUDevice, GPUTexture, etc. See
[docs/testing.md](docs/testing.md) for full details.

## Performance Testing

Use the benchmark system when the user asks about performance, throughput, regressions, hot paths, or CI benchmark
coverage.

- Prefer **Tier 1 CPU benchmarks** first for isolated methods, helpers, caches, and allocation patterns
- Use **Tier 2 GPU perf tests** when the question is real browser frame time rather than raw method throughput
- If a rendering change affects both inner-loop CPU work and full-frame behavior, add both
- Tier 2 uses Playwright-managed pinned Chromium, not floating branded Chrome
- Tier 2 CI currently runs on standard hosted runners, so its results are approximate and should be treated as a coarse
  regression signal unless a self-hosted GPU runner is configured

Recommended commands:

```bash
pnpm bench
pnpm bench:json
pnpm test:perf
```

CI status:

- Tier 1 CPU benchmarks run in GitHub Actions on `main` pushes and on PRs labeled `perf-tier-1`
- Labeled PR benchmark runs compare against the latest `main` baseline artifact
- The benchmark job comments on the PR and fails on regressions greater than 25%
- Tier 2 GPU perf tests run in GitHub Actions on `main` pushes and on PRs labeled `perf-tier-2`
- Tier 2 PR perf runs compare against the latest `main` GPU perf baseline artifact
- The GPU perf job comments on the PR and fails on median frame-time regressions greater than 50%
- Tier 2 CI is browser/frame-time coverage on hosted Linux runners, not hardware-accurate GPU benchmarking

Claude Code reusable skill:

- Use `.claude/skills/perf/SKILL.md` for benchmark-related work
- Use it when adding a new `*.bench.ts`, extending browser perf fixtures, or reasoning about benchmark CI behavior

## Git

- Conventional Commits format: `<type>(<scope>): <description>`
- All commits require DCO sign-off (`git commit -s`)
- AI-assisted commits include `Co-Authored-By: Claude <noreply@anthropic.com>` trailer
- Types: feat, fix, refactor, docs, test, chore, perf, ci
- Scopes: renderer, camera, assets, api, utils, examples, ci, docs
