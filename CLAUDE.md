# Blit-Tech

A palette-first WebGPU retro engine for TypeScript, inspired by RetroBlit. Pixel-perfect 2D rendering where primitives
and sprites resolve through a shared indexed palette.

## Tech Stack

- **Language:** TypeScript 5.9.3 (strict mode; pinned to match API Extractor for declaration rollup)
- **Runtime:** Browser (WebGPU)
- **Build:** Vite + vite-plugin-dts (`rollupTypes` uses API Extractor)
- **Formatting:** Biome (TS/JS) + Prettier (MD/YAML)
- **Linting:** ESLint with perfectionist, jsdoc, security, promise plugins
- **Spelling:** cspell
- **Dead code:** knip
- **Commits:** Conventional Commits + DCO sign-off + commitlint
- **Package manager:** pnpm

## Where to Find Information

Before writing new code, reviewing existing code, or preflighting, check here first:

| Question                                      | Where to look                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does `BT.X` do (getter vs method)?       | `src/BlitTech.ts` JSDoc, `docs/api-core.md`, **BT API: getters vs methods** below                                                                                                                       |
| How does a subsystem work internally?         | The relevant `src/core/` or `src/render/` file                                                                                                                                                          |
| What does a demo implement?                   | `src/core/IBlitTechDemo.ts` (interface + HardwareSettings)                                                                                                                                              |
| What palette/sprite setup pattern is correct? | `docs/palette-guide.md`, then `docs/api-assets.md`                                                                                                                                                      |
| What are the render/asset dimension limits?   | `src/utils/RenderLimits.ts` (constants), `src/utils/AssetLimits.ts` (asset + glyph limits), `docs/api-assets.md` (asset size limits table), `docs/api-core.md` (HardwareSettings dimension constraints) |
| Which preset has which exact color values?    | `docs/palette-presets.md`                                                                                                                                                                               |
| How do post-process effects work?             | `docs/post-process-effects.md`                                                                                                                                                                          |
| What does the CI do on this file?             | `.github/workflows/ci.yml`                                                                                                                                                                              |
| Dependency security policy / CI audit gate?   | `docs/security/dependency-policy.md`, `docs/security/audit-exceptions.md`                                                                                                                               |
| What is the benchmark threshold?              | `ci.yml` benchmark job (`--threshold 25` flag), not docs                                                                                                                                                |
| What error message style should I use?        | `docs/voice.md`, then `src/utils/errorMessages.ts`                                                                                                                                                      |
| Is this API exported publicly?                | `src/BlitTech.ts` export block (lines 1460-1501)                                                                                                                                                        |
| What test mock do I need for GPU code?        | `src/__test__/webgpu-mock.ts`                                                                                                                                                                           |
| Declaration tooling / TS version alignment?   | `docs/tooling.md`, `docs/developer-experience-guide.md`, `scripts/check-declaration-tooling.mjs`                                                                                                        |

## Architecture

All engine functionality is accessed through the static `BT` namespace. The architecture is palette-first: primitives,
sprites, and bitmap text resolve color through the active `Palette` before final RGBA output. Demos implement the
`IBlitTechDemo` interface (`configure?`, `init`, `update`, `render`).

```text
src/
  BlitTech.ts              # Public API (BT namespace exports)
  core/
    BTAPI.ts               # Internal singleton managing subsystems
    IBlitTechDemo.ts       # Demo interface + HardwareSettings
    GameLoop.ts            # Fixed-timestep game loop
    WebGPUContext.ts       # WebGPU adapter/device/context setup
  render/
    IRenderer.ts           # Backend-agnostic renderer contract (interface)
    WebGpuRenderer.ts      # WebGPU concrete renderer implementing IRenderer
    SoftwareRenderer.ts    # Canvas 2D software fallback implementing IRenderer
    SoftwareTicker.ts      # Dismissible in-canvas "SOFTWARE RENDERER" status banner (software mode only)
    PrimitivePipeline.ts   # Batched geometry writing palette indices (pixels, lines, rects)
    SpritePipeline.ts      # Batched textured quads (sprites, bitmap text)
    PostProcessChain.ts    # Tier-aware fullscreen effect chain
    UpscalePass.ts         # RGBA texture upscale helper (tests / utilities)
    PaletteResolveUpscalePass.ts # r8uint palette indices -> RGBA + upscale
    effects/
      Effect.ts            # Effect interface + EffectTier
      FullscreenEffect.ts  # Base class for typical fullscreen effects
      FullscreenPixelEffect.ts # Pixel-tier base (logical r8uint chain)
      pixel/               # Pixel-tier effects (PixelGlitch, PixelMosaic)
      display/             # Display-tier effects (BarrelDistortion, Scanlines, ...)
      presets/             # Pre-configured stacks (crtPipBoy, amber, green)
  assets/
    AssetLoader.ts         # Image loading with caching
    SpriteSheet.ts         # GPU texture wrapper (+ loadIndexed convenience path)
    BitmapFont.ts          # Bitmap font system (.btfont)
    Palette.ts             # 256-entry indexed color palette
    PaletteEffect.ts       # Palette effect system (cycle, fade, flash, swap)
    palettes/              # Built-in preset palette data (VGA, CGA, C64, etc.) + HUD UI preset (hudData.ts)
  input/
    PointerInput.ts        # DOM-backed pointer / mouse / touch / pen tracker (4 slots)
    KeyboardInput.ts       # KeyboardEvent.code state, edges, tick repeat, beforeinput text
    GamepadInput.ts        # Polling-based gamepad input tracker (4 players, axes, buttons, dead zone)
    defaultKeyboardMap.ts  # Default face-button key tables; clone helpers for BT.inputMapReset
  utils/
    Bootstrap.ts           # Demo bootstrap utilities
    BootstrapHelpers.ts    # Canvas lookup and error display utilities
    CameraUtils.ts         # Camera clamp helper (world/view bounds)
    CanvasLayoutStyles.ts  # Canvas layout CSS custom properties helper
    RenderLimits.ts        # Render dimension validation and max-size constants (8192px / 16M px)
    AssetLimits.ts         # Asset dimension validation, btfont/glyph limits, sprite-blit clipping
    Vector2i.ts            # Integer 2D vector
    Rect2i.ts              # Integer rectangle
    Color32.ts             # 32-bit RGBA color
    Easing.ts              # Easing functions for palette effects
    FrameCapture.ts        # GPU readback + PNG export
  __test__/
    webgpu-mock.ts         # WebGPU mock factories for tests
    setup.ts               # Vitest global setup (GPU constants)
```

### Palette-First Rendering

Two backends selectable via `HardwareSettings.renderer` (default `'webgpu'`):

- **WebGPU** (`'webgpu'`): indexed, palette-first hardware renderer.
  1. **Primitives pipeline** - batched geometry writing **palette indices** (pixels, lines, rects). Max 50k
     vertices/frame.
  2. **Sprites pipeline** - batched **palette-indexed** textured quads (sprites, bitmap text). Max 50k vertices (~8333
     quads). Nearest-neighbor sampling. Auto-batched by texture.
  3. **Framebuffer & post-process** - the logical composite is an **`r8uint`** attachment at `displaySize` (one palette
     slot per pixel). **Pixel-tier** effects (`PostProcessChain`, `FullscreenPixelEffect`) run on that index buffer.
     **`PaletteResolveUpscalePass`** LUT-resolves indices to RGBA and upscales to `canvasDisplaySize`. **Display-tier**
     effects run on that RGBA before present (see `docs/post-process-effects.md`).
- **Software** (`'software'`): Canvas 2D fallback. Supports palette rendering, rects, Bresenham lines, indexed sprite
  blits, and bitmap text. Post-process/fullscreen effects throw a clear error directing users to the WebGPU backend.
  Activates automatically when WebGPU init fails; force explicitly via `HardwareSettings.renderer: 'software'` or the
  `?renderer=software` URL query parameter. A dismissible in-canvas ticker banner is rendered each frame when this
  backend is active. Use `BT.activeBackend` to query which backend started (`'webgpu' | 'software' | null`).

### Core Types

- `Vector2i` - integer 2D vector. Constructor auto-floors. Has `width`/`height` aliases.
- `Rect2i` - integer rectangle. Methods: `contains()`, `intersects()`, `intersection()`.
- `Color32` - 32-bit RGBA (0-255). Static colors, hex parsing, named-color registry, float array conversion.

## Critical Rules

1. **No emoji** - nowhere: code, docs, commits, PR titles, errors, logs
2. **Integer coordinates** - all rendering uses `Vector2i`/`Rect2i`, never floats
3. **Performance first** - minimize allocations in update/render, reuse buffers, batch draws
4. **Use BT namespace** - never access `BTAPI` directly from demo code
5. **No `any` types** - use `unknown` or proper types
6. **Type-only imports** - `import type { ... }` for types
7. **Documentation is part of every feature** - after any public API change update the relevant `docs/api-*.md`; after
   any behavior change update the affected `docs/` guide; after any architecture change update the `CLAUDE.md`
   architecture map. Update `README.md` only when the Quick Start, features list, prerequisites, or browser
   compatibility is affected. Never wait to be asked.

## Input Conventions

- `BTN_*` constants are bit flags (powers of 2), not sequential integers
- `BT.buttonDown` / `BT.buttonPressed` / `BT.buttonReleased` use ANY-match semantics for masks
- Face buttons: players `0` and `1` are keyboard OR gamepad; players `2` and `3` are gamepad-only
- Input previous-state rollover is end-of-frame aligned (same snapshot model across pointer/keyboard/gamepad)
- Default gamepad stick dead zone is `0.75`
- Triggers are axis-only for now (`AXIS_TRIGGER_L` / `AXIS_TRIGGER_R`); trigger button constants are tracked in `VV-481`

## BT API: getters vs methods

The public `BT` namespace uses **getters** for read-only snapshots and **methods** for actions, parameterized queries,
and async work. Do not add new zero-argument `BT.foo()` functions when a getter is appropriate.

### Use getters (property access, no `()`)

| Category                                                         | Members                                                       | Notes                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Configure-time** (mirror {@link HardwareSettings} field names) | `displaySize`, `canvasDisplaySize`, `targetFPS`, `outputSize` | `outputSize` = effective buffer (`canvasDisplaySize ?? displaySize`). Clone per read for `Vector2i` getters.          |
| **Loop timing**                                                  | `deltaSeconds`, `timeSeconds`, `ticks`                        | `targetFPS` is configured rate, not measured FPS.                                                                     |
| **Runtime state**                                                | `activeBackend`, `camera`, `palette`                          | `activeBackend` is what actually started (after fallback), not `configure().renderer`. `palette` is a live reference. |
| **Per-frame input**                                              | `pointerScrollDelta`, `inputString`, `gamepadCount`           | Read once per frame when needed.                                                                                      |

Examples: `BT.displaySize.y`, `BT.targetFPS`, `BT.ticks % 60`, `if (BT.activeBackend === 'software')`.

### Use methods (call with `()`)

- **Lifecycle / mutations:** `init`, `ticksReset`, `cameraSet`, `cameraReset`, `paletteSet`, `hideCursor`, all
  draw/clear/effect APIs.
- **Parameterized queries:** `pointerPos(index?)`, `pointerDelta`, `pointerPosValid`, `buttonDown` / `Pressed` /
  `Released`, `getAxis`, `gamepadConnected`, `keyDown` / `Pressed` / `Released`.
- **Utilities with arguments:** `cameraClamp(camera, worldSize, viewSize?)`, `systemPrintMeasure(text)`.
- **Async:** `captureFrame`, `downloadFrame`.

### Naming when adding getters

- **Same name as `HardwareSettings`** when exposing configure values (`targetFPS`, not `fps` or `targetFps`).
- **Descriptive runtime names** when there is no configure field (`activeBackend`, not `renderer`).
- **Do not** expose `configure().renderer` on `BT` as `renderer` without documenting that it differs from
  `activeBackend`.

Full tables: `docs/api-core.md`. Style guide: `docs/developer-experience-guide.md` (Naming conventions).

## API Conventions

- Prefer `SpriteSheet.loadIndexed(...)` for demo/game sprite setup; use manual `loadColorsIntoPalette` + `load` +
  `indexize` only for advanced flows
- Use `SpriteSheet.getIndexedPixels()` when the software renderer needs CPU-side pixel data; it returns a defensive copy
  of the internal palette-indexed `Uint8Array` (throws if the sheet has not been indexized)
- Prefer `Color32#luminance` for perceived brightness calculations instead of duplicating `0.299*r + 0.587*g + 0.114*b`
  at call sites
- Prefer fixed-step helpers `BT.deltaSeconds` / `BT.timeSeconds` over hardcoded `1 / TARGET_FPS` in update loops
- Prefer `BT.cameraClamp(...)` (or `clampCameraToWorld(...)` in utility code) over ad-hoc clamp math
- Prefer `palette.applyHUD(startSlot?)` (default `1`) to fill the six common UI slots (white, bg, label, header, dim,
  FPS) and register their `hud_*` name aliases, rather than six manual `palette.set()` calls; override individual slots
  afterward for demo-specific colors

## Code Style

- 4-space indent, 120-char line width
- Single quotes, always semicolons, always trailing commas
- Always arrow parens
- Named exports only (no default exports)
- JSDoc required for public APIs
- When implementing changes, always update JSDoc and inline comments alongside the code. Never leave stale comments that
  describe old behavior.
- Use `// #region` / `// #endregion` for sections in files >100 lines

## Commands

```bash
pnpm run build              # Build library
pnpm run lint               # ESLint
pnpm run lint:fix           # ESLint with auto-fix
pnpm run format             # Format all files (Biome + Prettier)
pnpm run format:check       # Check formatting (Biome + Prettier)
pnpm run typecheck          # TypeScript type checking
pnpm run spellcheck         # cspell check
pnpm run knip               # Find unused exports/deps
pnpm run preflight          # All checks (format + lint + typecheck + spellcheck + knip + test:unit + test:declarations)
```

**RTK:** Shell commands are rewritten via `rtk hook cursor` (Cursor) / `rtk hook claude` (Claude Code). Use `pnpm run …`
for scripts. Prefer `rtk read` / `rtk grep` / shell over native Read/Grep for exploration. See `~/.claude/RTK.md`.

## Testing

Test files are colocated next to source: `src/utils/Vector2i.test.ts`.

```bash
pnpm run test                # Run all unit tests (alias for test:unit)
pnpm run test:unit           # Run all unit tests
pnpm run test:unit:watch     # Watch mode for development
pnpm run test:unit:coverage  # Coverage report (80% minimum threshold)
pnpm run test:declarations   # Declaration tooling log checker (Node test)
pnpm run test:visual         # Playwright visual regression tests (requires Chrome with WebGPU)
pnpm run test:visual:update  # Update visual test baselines
pnpm run bench               # Run CPU benchmarks (Vitest bench)
pnpm run bench:json          # Run benchmarks and write benchmark-results.json
```

**Test tiers:**

1. **Unit tests** (Vitest, node) - Pure logic: Vector2i, Rect2i, Color32, Palette, PaletteEffect, Easing, GameLoop
2. **Integration tests** (Vitest, Node + GPU mocks; happy-dom for DOM tests) - DOM and GPU code
3. **Visual regression** (Playwright, Chromium + WebGPU) - PNG snapshot verification of rendered output
4. **CPU benchmarks** (Vitest bench, `*.bench.ts`) - Hot method and allocation pattern throughput

### Visual Regression Tests

`pnpm run test:visual` runs Playwright with Chromium + WebGPU and captures PNG snapshots of actual rendered frames. This
is the primary tool for verifying that visual output is correct - not performance, but pixel-level correctness.

Use it when implementing or changing:

- Post-process effects (CRT, bloom, or any new effect in the effect chain)
- Sprite rendering, tinting, or blending
- Bitmap font rendering
- Primitive drawing (pixels, lines, rects)
- Palette-indexed rendering
- Camera offsets

Run `pnpm run test:visual:update` to regenerate baselines after an intentional visual change. Snapshots live in
`tests/visual/__snapshots__/`.

The suite covers: camera, fonts, mixed (primitives + sprites), post-process (baseline/CRT/CRT+bloom), primitives, and
sprites.

**WebGPU mocks:** Use `src/__test__/webgpu-mock.ts` for tests needing GPUDevice, GPUTexture, etc. See
[docs/testing.md](docs/testing.md) for full details.

### Known Testing Quirks

- **DOM environment directive**: Add `// @vitest-environment happy-dom` at the top of any test file that touches DOM
  APIs. Without it, the test runs in Node and DOM APIs are undefined.
- **happy-dom Image.onload does not fire for data URIs**: AssetLoader image-loading tests are marked `.todo` for this
  reason. Do not attempt to unit-test asset loading via data URIs in happy-dom.
- **Vector2i `-0` vs `0`**: JavaScript can produce `-0` when negating vectors. Use `result.x + 0` to coerce in
  assertions where sign is meaningless.

## Performance Testing

Use the benchmark system when the user asks about performance, throughput, regressions, hot paths, or CI benchmark
coverage.

- Use **CPU benchmarks** for isolated methods, helpers, caches, and allocation patterns
- For rendering correctness, use visual regression tests (`pnpm run test:visual`) - they produce PNG snapshots

Recommended commands:

```bash
pnpm run bench
pnpm run bench:json
```

CI status:

- CPU benchmarks run in GitHub Actions on `main` pushes and on PRs labeled `perf`
- Labeled PR benchmark runs compare against the latest `main` baseline artifact
- The benchmark job comments on the PR and fails on regressions greater than 25%

Claude Code reusable skill:

- Use `.claude/skills/perf/SKILL.md` for benchmark-related work
- Use it when adding a new `*.bench.ts` or reasoning about benchmark CI behavior

## Git

- Conventional Commits format: `<type>(<scope>): <description>`
- All commits require DCO sign-off (`git commit -s`)
- AI-assisted commits include `Co-Authored-By: Claude <noreply@anthropic.com>` trailer
- Types: feat, fix, refactor, docs, test, chore, perf, ci
- Scopes: renderer, camera, assets, api, utils, examples, ci, docs

## Working with Claude

- **Planning vs implementation sessions**: During planning work (reviewing Linear tickets, discussing architecture), do
  not modify source files. Only update Linear. Wait for a separate implementation session before touching code.
- **User-facing strings**: Follow the two-tier voice guide for all throws, error messages, and canvas-visible text. See
  [docs/voice.md](docs/voice.md) before writing any throw or user-facing string.
- **Documentation is part of every feature**: After completing any feature or fix, always update documentation without
  being asked. The rule: if you changed a public API, update the relevant `docs/api-*.md` file; if you changed engine
  behavior, update the affected `docs/` guide; if you changed architecture or added a new subsystem file, update the
  `CLAUDE.md` architecture map and the `## Where to Find Information` table; update `README.md` only if the change
  affects the Quick Start, prerequisites, features list, or browser compatibility. Never treat documentation as a
  separate step the user must request.
