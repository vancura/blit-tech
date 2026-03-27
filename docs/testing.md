# Testing

Blit-Tech uses a three-tier testing strategy to cover both pure logic and GPU-dependent rendering code.

## Architecture

### Tier 1: Unit Tests (Vitest, Node.js)

Pure logic with no GPU dependencies. Tests run in Node.js for maximum speed.

- **Vector2i** - all arithmetic, distance, comparison, factory methods
- **Rect2i** - intersection, containment, computed properties
- **Color32** - color math, conversions, blending
- **GameLoop** - constructor validation, tick counter
- **IBlitTechDemo** - default hardware settings

### Tier 2: Integration Tests (Vitest, Node + GPU mocks)

Code that requires WebGPU objects or DOM APIs. Most tests run in Node with `src/__test__/webgpu-mock.ts` for GPU stubs
and `vi` for browser API stubs. Tests that need a full DOM (Bootstrap, BootstrapHelpers) opt into `happy-dom` via the
`// @vitest-environment happy-dom` directive.

- **AssetLoader** - image caching and deduplication (Node + vi stubs)
- **SpriteSheet** - UV calculation, lazy texture creation (Node + GPU mocks)
- **BitmapFont** - glyph lookup, text measurement (Node + vi stubs)
- **BootstrapHelpers** - WebGPU support detection, canvas lookup (happy-dom)
- **Bootstrap** - full bootstrap lifecycle (happy-dom)
- **Renderer** - frame lifecycle, camera, pipeline delegation (Node + GPU mocks)
- **PrimitivePipeline** - vertex buffer math, line algorithm (Node + GPU mocks)
- **SpritePipeline** - texture batching, UV coordinates (Node + GPU mocks)
- **WebGPUContext** - initialization with mock adapter/device (Node + GPU mocks)
- **BTAPI** - singleton coordinator (Node + GPU mocks)
- **FrameCapture** - GPU readback, PNG conversion (Node + GPU mocks + browser stubs)

### Tier 3: Visual Regression (Playwright, Chromium)

Actual GPU rendering verified via screenshot comparison. Requires Chrome with WebGPU flags enabled.

- **Primitives** - pixel, line, and rectangle rendering
- **Sprites** - sprite rendering with tinting, batching, alpha blending
- **Camera** - camera offset transforms applied to all geometry
- **Fonts** - placeholder text rendering at known positions
- **Mixed** - primitives and sprites combined with correct layering

## Commands

```bash
pnpm test                # Run all unit tests (alias for test:unit)
pnpm test:unit           # Run all unit tests
pnpm test:unit:watch     # Watch mode for development
pnpm test:unit:coverage  # Coverage report (80% minimum threshold)
pnpm test:visual            # Playwright visual regression (requires Chrome)
pnpm test:visual:update     # Update visual test baselines
pnpm test:visual:coverage   # Visual tests with Istanbul coverage report
```

## Test File Location

Tests are colocated next to their source files:

```text
src/utils/Vector2i.ts       # Source
src/utils/Vector2i.test.ts  # Test
```

Visual regression tests live in a separate directory:

```text
tests/visual/
  fixtures/              # HTML pages and Vite config
  __snapshots__/         # Git-tracked reference screenshots
  coverage-fixture.ts    # Playwright fixture for Istanbul coverage
  primitives.spec.ts     # Primitive rendering visual test
  sprites.spec.ts        # Sprite rendering visual test
  camera.spec.ts         # Camera transform visual test
  fonts.spec.ts          # Text rendering visual test
  mixed.spec.ts          # Combined rendering visual test
```

## Writing a New Test

```ts
import { describe, expect, it } from 'vitest';

import { MyClass } from './MyClass';

describe('MyClass', () => {
  describe('myMethod', () => {
    it('should do something', () => {
      const instance = new MyClass();
      expect(instance.myMethod()).toBe(expected);
    });
  });
});
```

Conventions:

- Use `describe`/`it` (not `test`)
- Use `// #region` / `// #endregion` for files over ~100 lines
- Follow source code style (4-space indent, single quotes, semicolons)
- No emoji in test descriptions
- No JSDoc required in test files

## WebGPU Mock Usage

For tests that need GPU objects, import from the mock factory:

```ts
import { createMockGPUDevice, createMockGPUTexture } from '../__test__/webgpu-mock';

const device = createMockGPUDevice();
const texture = createMockGPUTexture(256, 256);
```

Available mocks:

- `createMockGPUDevice()` - returns a stub GPUDevice
- `createMockGPUTexture(width, height)` - returns a stub GPUTexture
- `createMockGPUCanvasContext()` - returns a stub GPUCanvasContext
- `createMockRenderPassEncoder()` - returns a stub GPURenderPassEncoder
- `installMockNavigatorGPU()` / `uninstallMockNavigatorGPU()` - install/remove global navigator.gpu

## Coverage

Minimum thresholds enforced in `vitest.config.ts`:

- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

Run `pnpm test:unit:coverage` to check. Coverage reports are generated in `coverage/`.

### Visual Test Coverage

Visual test coverage uses Istanbul instrumentation via `vite-plugin-istanbul`. It is separate from unit test coverage
(different provider: Istanbul vs V8) and generates reports in `coverage-visual/`.

```bash
pnpm test:visual:coverage  # Runs visual tests with instrumented code, then generates lcov report
```

Coverage is collected via a custom Playwright fixture (`tests/visual/coverage-fixture.ts`) that captures
`window.__coverage__` from each page after tests complete. The `VISUAL_COVERAGE=1` env var activates instrumentation.

## Visual Test Workflow

1. Create a fixture HTML page in `tests/visual/fixtures/`
2. Write a Playwright spec in `tests/visual/`
3. Run `pnpm test:visual` to generate baseline screenshots
4. Screenshots are committed to `tests/visual/__snapshots__/`
5. After intentional rendering changes, run `pnpm test:visual:update`

## IDE Setup

### Cursor / VS Code

Install the recommended extensions (prompted on first open):

- **Vitest** (`vitest.explorer`) - inline test running, debugging, coverage gutter
- **Playwright** (`ms-playwright.playwright`) - visual test runner

### WebStorm

Built-in Vitest support since 2023.3. Auto-detects `vitest.config.ts` and shows run gutters next to each test.

### Zed

Use the Tasks system. Create `.zed/tasks.json`:

```json
[
  {
    "label": "Test: Run All",
    "command": "pnpm test",
    "cwd": "$ZED_WORKTREE_ROOT"
  },
  {
    "label": "Test: Current File",
    "command": "pnpm exec vitest run $ZED_FILE",
    "cwd": "$ZED_WORKTREE_ROOT"
  }
]
```

## CI Integration

- **ci.yml**: Unit tests with coverage run on every push/PR to main
- **pr-checks.yml**: Unit tests run as part of PR quality checks
- **ci.yml (visual job)**: Visual regression runs only on PRs, non-blocking
