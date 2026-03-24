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
  render/
    Renderer.ts            # WebGPU renderer (dual pipelines)
  assets/
    AssetLoader.ts         # Image loading with caching
    SpriteSheet.ts         # GPU texture wrapper
    BitmapFont.ts          # Bitmap font system (.btfont)
  utils/
    Bootstrap.ts           # Demo bootstrap utilities
    Vector2i.ts            # Integer 2D vector
    Rect2i.ts              # Integer rectangle
    Color32.ts             # 32-bit RGBA color
```

### Rendering

Dual WebGPU pipeline architecture:

1. **Primitives pipeline** - colored geometry (pixels, lines, rects). Max 100k vertices/frame.
2. **Sprites pipeline** - textured quads with tinting. Max 50k vertices (4096 quads). Nearest-neighbor sampling.
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
pnpm format             # Format all files
pnpm format:check       # Check formatting
pnpm typecheck          # TypeScript type checking
pnpm spellcheck         # cspell check
pnpm knip               # Find unused exports/deps
pnpm preflight          # All checks (format + lint + typecheck + spellcheck + knip + test)
```

## Testing

Test files are colocated next to source: `src/utils/Vector2i.test.ts`.

```bash
pnpm test               # Run all unit tests
pnpm test:watch          # Watch mode for development
pnpm test:coverage       # Coverage report (80% minimum threshold)
pnpm test:visual         # Playwright visual regression (requires Chrome)
pnpm test:visual:update  # Update visual test baselines
```

**Test tiers:**

1. **Unit tests** (Vitest, node) - Pure logic: Vector2i, Rect2i, Color32, GameLoop
2. **Integration tests** (Vitest, happy-dom + GPU mocks) - DOM and GPU code
3. **Visual regression** (Playwright, Chromium) - Rendering output verification

**WebGPU mocks:** Use `src/__test__/webgpu-mock.ts` for tests needing GPUDevice, GPUTexture, etc. See `docs/testing.md`
for full details.

## Git

- Conventional Commits format: `<type>(<scope>): <description>`
- All commits require DCO sign-off (`git commit -s`)
- AI-assisted commits include `Co-Authored-By: Claude <noreply@anthropic.com>` trailer
- Types: feat, fix, refactor, docs, test, chore, perf, ci
- Scopes: renderer, camera, assets, api, utils, examples, ci, docs
