# Testing Guide

This document provides comprehensive guidance for implementing testing infrastructure for Blit-Tech.

## Table of Contents

- [Overview](#overview)
- [Testing Strategy](#testing-strategy)
- [Setup: Vitest (Unit Tests)](#setup-vitest-unit-tests)
- [Setup: Playwright (E2E Tests)](#setup-playwright-e2e-tests)
- [Writing Unit Tests](#writing-unit-tests)
- [Writing E2E Tests](#writing-e2e-tests)
- [CI Integration](#ci-integration)
- [Coverage Reporting](#coverage-reporting)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Goal:** Implement comprehensive testing for both the library code and examples to ensure reliability and catch
regressions early.

**Testing Levels:**

1. **Unit Tests** (Vitest) - Test individual functions, classes, and utilities
2. **E2E Tests** (Playwright) - Test examples in real browsers with WebGPU

**Coverage Targets:**

- Unit tests: 70%+ overall coverage
- E2E tests: All examples load and render without errors
- Critical paths: 90%+ coverage (rendering, API, asset loading)

---

## Testing Strategy

### What to Test

**Unit Tests:**

- ✓ **Utility classes**: `Vector2i`, `Rect2i`, `Color32`
- ✓ **Asset loaders**: `AssetLoader`, `SpriteSheet`, `BitmapFont`
- ✓ **Core API**: BT namespace functions (with mocked WebGPU)
- ✓ **Math operations**: Vector math, rectangle intersections
- ✓ **Color conversions**: RGB/RGBA to 32-bit integer

**E2E Tests:**

- ✓ **Example loading**: All HTML pages load successfully
- ✓ **Canvas rendering**: Canvas element exists and has content
- ✓ **No errors**: Console errors are caught and fail tests
- ✓ **Visual regression**: Screenshot comparison (optional but recommended)
- ✓ **WebGPU support**: Graceful degradation when WebGPU unavailable

### What NOT to Test

- ❌ Third-party libraries (Vite, TypeScript)
- ❌ Browser WebGPU implementation details
- ❌ Build artifacts (those are tested by build process)

---

## Setup: Vitest (Unit Tests)

### 1. Install Dependencies

```bash
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 happy-dom
```

**Packages:**

- `vitest` - Fast unit test framework (Vite-native)
- `@vitest/ui` - Web-based test UI
- `@vitest/coverage-v8` - Code coverage reporting
- `happy-dom` - Lightweight DOM implementation for tests

### 2. Create Vitest Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment
    environment: 'happy-dom', // Provides DOM APIs (window, document, etc.)
    globals: true, // Enable global test APIs (describe, it, expect)

    // File patterns
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.ts', // Dev entry point
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // Performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Reporters
    reporters: ['verbose'],

    // Mock configuration
    mockReset: true, // Reset mocks between tests
    restoreMocks: true, // Restore mocks after tests
  },
});
```

### 3. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest watch",
    "test:unit:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 4. Update TypeScript Config for Tests

Update `tsconfig.json` to include test files:

```json
{
  "include": ["src/**/*", "examples/**/*", "tests/**/*", "vitest.config.ts"]
}
```

### 5. Create Test Directory Structure

```bash
mkdir -p tests/unit/{utils,assets,core}
```

**Structure:**

```text
tests/
├── unit/
│   ├── utils/
│   │   ├── Vector2i.test.ts
│   │   ├── Rect2i.test.ts
│   │   └── Color32.test.ts
│   ├── assets/
│   │   ├── AssetLoader.test.ts
│   │   ├── SpriteSheet.test.ts
│   │   └── BitmapFont.test.ts
│   └── core/
│       └── BTAPI.test.ts
└── e2e/
    └── (Playwright tests)
```

---

## Writing Unit Tests

### Example: Vector2i Tests

Create `tests/unit/utils/Vector2i.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { Vector2i } from '../../../src/utils/Vector2i';

describe('Vector2i', () => {
  describe('constructor', () => {
    it('should create a vector with given coordinates', () => {
      const vec = new Vector2i(10, 20);
      expect(vec.x).toBe(10);
      expect(vec.y).toBe(20);
    });

    it('should handle negative coordinates', () => {
      const vec = new Vector2i(-5, -10);
      expect(vec.x).toBe(-5);
      expect(vec.y).toBe(-10);
    });

    it('should handle zero coordinates', () => {
      const vec = new Vector2i(0, 0);
      expect(vec.x).toBe(0);
      expect(vec.y).toBe(0);
    });
  });

  describe('add', () => {
    it('should add two vectors correctly', () => {
      const v1 = new Vector2i(10, 20);
      const v2 = new Vector2i(5, 15);
      const result = v1.add(v2);
      expect(result.x).toBe(15);
      expect(result.y).toBe(35);
    });

    it('should not modify original vectors', () => {
      const v1 = new Vector2i(10, 20);
      const v2 = new Vector2i(5, 15);
      v1.add(v2);
      expect(v1.x).toBe(10);
      expect(v1.y).toBe(20);
    });
  });

  describe('subtract', () => {
    it('should subtract two vectors correctly', () => {
      const v1 = new Vector2i(10, 20);
      const v2 = new Vector2i(5, 15);
      const result = v1.subtract(v2);
      expect(result.x).toBe(5);
      expect(result.y).toBe(5);
    });
  });

  describe('multiply', () => {
    it('should multiply vector by scalar', () => {
      const vec = new Vector2i(10, 20);
      const result = vec.multiply(2);
      expect(result.x).toBe(20);
      expect(result.y).toBe(40);
    });

    it('should handle negative scalar', () => {
      const vec = new Vector2i(10, 20);
      const result = vec.multiply(-1);
      expect(result.x).toBe(-10);
      expect(result.y).toBe(-20);
    });
  });

  describe('length', () => {
    it('should calculate magnitude correctly', () => {
      const vec = new Vector2i(3, 4);
      expect(vec.length()).toBe(5); // 3-4-5 triangle
    });

    it('should return 0 for zero vector', () => {
      const vec = new Vector2i(0, 0);
      expect(vec.length()).toBe(0);
    });
  });

  describe('equals', () => {
    it('should return true for equal vectors', () => {
      const v1 = new Vector2i(10, 20);
      const v2 = new Vector2i(10, 20);
      expect(v1.equals(v2)).toBe(true);
    });

    it('should return false for different vectors', () => {
      const v1 = new Vector2i(10, 20);
      const v2 = new Vector2i(10, 21);
      expect(v1.equals(v2)).toBe(false);
    });
  });
});
```

### Example: Color32 Tests

Create `tests/unit/utils/Color32.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { Color32 } from '../../../src/utils/Color32';

describe('Color32', () => {
  describe('fromRGB', () => {
    it('should create color from RGB values', () => {
      const color = Color32.fromRGB(255, 128, 64);
      expect(color).toBeDefined();
      // Test packed value if accessor exists
    });

    it('should handle full white', () => {
      const white = Color32.fromRGB(255, 255, 255);
      expect(white).toBeDefined();
    });

    it('should handle full black', () => {
      const black = Color32.fromRGB(0, 0, 0);
      expect(black).toBeDefined();
    });
  });

  describe('fromRGBA', () => {
    it('should create color with alpha channel', () => {
      const color = Color32.fromRGBA(255, 128, 64, 128);
      expect(color).toBeDefined();
    });

    it('should handle fully transparent', () => {
      const transparent = Color32.fromRGBA(0, 0, 0, 0);
      expect(transparent).toBeDefined();
    });

    it('should handle fully opaque', () => {
      const opaque = Color32.fromRGBA(255, 128, 64, 255);
      expect(opaque).toBeDefined();
    });
  });

  describe('predefined colors', () => {
    it('should have common color constants', () => {
      expect(Color32.Black).toBeDefined();
      expect(Color32.White).toBeDefined();
      expect(Color32.Red).toBeDefined();
      expect(Color32.Green).toBeDefined();
      expect(Color32.Blue).toBeDefined();
    });
  });
});
```

### Example: Rect2i Tests

Create `tests/unit/utils/Rect2i.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { Rect2i } from '../../../src/utils/Rect2i';
import { Vector2i } from '../../../src/utils/Vector2i';

describe('Rect2i', () => {
  describe('constructor', () => {
    it('should create rectangle with position and size', () => {
      const rect = new Rect2i(10, 20, 100, 50);
      expect(rect.x).toBe(10);
      expect(rect.y).toBe(20);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(50);
    });
  });

  describe('contains', () => {
    it('should return true for point inside rectangle', () => {
      const rect = new Rect2i(0, 0, 100, 100);
      const point = new Vector2i(50, 50);
      expect(rect.contains(point)).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      const rect = new Rect2i(0, 0, 100, 100);
      const point = new Vector2i(150, 150);
      expect(rect.contains(point)).toBe(false);
    });

    it('should handle boundary conditions', () => {
      const rect = new Rect2i(0, 0, 100, 100);
      expect(rect.contains(new Vector2i(0, 0))).toBe(true); // Top-left
      expect(rect.contains(new Vector2i(99, 99))).toBe(true); // Bottom-right (inside)
      expect(rect.contains(new Vector2i(100, 100))).toBe(false); // Outside
    });
  });

  describe('intersects', () => {
    it('should return true for overlapping rectangles', () => {
      const rect1 = new Rect2i(0, 0, 100, 100);
      const rect2 = new Rect2i(50, 50, 100, 100);
      expect(rect1.intersects(rect2)).toBe(true);
    });

    it('should return false for non-overlapping rectangles', () => {
      const rect1 = new Rect2i(0, 0, 100, 100);
      const rect2 = new Rect2i(150, 150, 100, 100);
      expect(rect1.intersects(rect2)).toBe(false);
    });
  });
});
```

### Mocking WebGPU for Core Tests

Create `tests/unit/mocks/webgpu.ts`:

```typescript
import { vi } from 'vitest';

/**
 * Mock WebGPU APIs for testing without actual GPU
 */
export function mockWebGPU() {
  const mockAdapter = {
    requestDevice: vi.fn().mockResolvedValue({
      createShaderModule: vi.fn(),
      createPipelineLayout: vi.fn(),
      createRenderPipeline: vi.fn(),
      createBuffer: vi.fn(),
      createTexture: vi.fn(),
      queue: {
        submit: vi.fn(),
        writeBuffer: vi.fn(),
      },
    }),
  };

  const mockGPU = {
    requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
  };

  // @ts-ignore - Mock global navigator
  global.navigator = {
    gpu: mockGPU,
  };

  return { mockGPU, mockAdapter };
}

/**
 * Clean up WebGPU mocks
 */
export function cleanupWebGPU() {
  // @ts-ignore
  delete global.navigator;
}
```

---

## Setup: Playwright (E2E Tests)

### 1. Install Playwright

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

**Why Chromium only?** WebGPU support is best in Chromium-based browsers (Chrome, Edge).

### 2. Create Playwright Configuration

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // Fail CI if test.only
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable WebGPU flags
        launchOptions: {
          args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan'],
        },
      },
    },
  ],

  // Start dev server before tests
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### 3. Add E2E Test Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

### 4. Create E2E Test Directory

```bash
mkdir -p tests/e2e
```

---

## Writing E2E Tests

### Example: Test All Examples Load

Create `tests/e2e/examples.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

const examples = [
  { name: 'Gallery', path: '/examples/examples-index.html' },
  { name: 'Basic', path: '/examples/index.html' },
  { name: 'Primitives', path: '/examples/primitives.html' },
  { name: 'Camera', path: '/examples/camera.html' },
  { name: 'Patterns', path: '/examples/patterns.html' },
  { name: 'Sprite', path: '/examples/sprite.html' },
  { name: 'Font', path: '/examples/font.html' },
];

test.describe('Blit-Tech Examples', () => {
  for (const example of examples) {
    test(`${example.name} example loads without errors`, async ({ page }) => {
      // Track console errors
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Navigate to example
      await page.goto(example.path);

      // Wait for canvas to be present
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible({ timeout: 10000 });

      // Check for WebGPU error message
      const errorMessage = page.locator('text=WebGPU is not supported');
      const hasWebGPUError = await errorMessage.isVisible().catch(() => false);

      if (hasWebGPUError) {
        test.skip('WebGPU not available in this environment');
        return;
      }

      // Wait for rendering to start (canvas should have context)
      await page.waitForTimeout(1000);

      // Verify no console errors
      expect(errors).toHaveLength(0);

      // Take screenshot for visual regression (optional)
      await expect(page).toHaveScreenshot(`${example.name}.png`, {
        maxDiffPixels: 100, // Allow minor differences
      });
    });
  }
});
```

### Example: Test Interactive Features

Create `tests/e2e/interactions.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('Interactive Features', () => {
  test('basic example responds to keyboard input', async ({ page }) => {
    await page.goto('/examples/index.html');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Focus canvas
    await canvas.click();

    // Get initial screenshot
    const before = await page.screenshot();

    // Press arrow key
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    // Get after screenshot
    const after = await page.screenshot();

    // Screenshots should be different (square moved)
    expect(before).not.toEqual(after);
  });

  test('camera example has scrollable world', async ({ page }) => {
    await page.goto('/examples/camera.html');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Test camera controls exist and work
    await canvas.click();
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Verify no errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    expect(errors).toHaveLength(0);
  });
});
```

---

## CI Integration

### Update .github/workflows/ci.yml

Enable the test job:

```yaml
test:
  name: Run Tests
  runs-on: ubuntu-latest
  needs: quality
  # Remove 'if: false' to enable

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.24.0

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Install Playwright browsers
      run: pnpm exec playwright install chromium --with-deps

    - name: Run unit tests
      run: pnpm test:unit

    - name: Run E2E tests
      run: pnpm test:e2e

    - name: Upload coverage
      uses: codecov/codecov-action@v4
      if: always()
      with:
        files: ./coverage/coverage-final.json

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

---

## Coverage Reporting

### View Coverage Locally

```bash
pnpm test:coverage
```

Coverage reports generated in `coverage/`:

- `coverage/index.html` - HTML report (open in browser)
- `coverage/lcov.info` - LCOV format (for CI)
- `coverage/coverage-final.json` - JSON format

### Codecov Integration (Optional)

1. Sign up at [codecov.io](https://codecov.io)
2. Add repository
3. Set `CODECOV_TOKEN` in GitHub Secrets
4. Coverage uploaded automatically by CI

---

## Best Practices

### Unit Testing

1. **Test one thing per test** - Each `it()` should verify one behavior
2. **Use descriptive names** - Test names should explain what they verify
3. **AAA pattern** - Arrange, Act, Assert
4. **Mock external dependencies** - Don't test WebGPU implementation
5. **Test edge cases** - Zero, negative, boundary values
6. **Keep tests fast** - Unit tests should run in milliseconds

### E2E Testing

1. **Test user journeys** - How users interact with examples
2. **Don't test implementation details** - Test behavior, not code
3. **Use data-testid attributes** - For reliable selectors
4. **Handle WebGPU unavailability** - Skip gracefully
5. **Visual regression sparingly** - Only for critical visuals
6. **Keep tests independent** - Each test should run in isolation

### General

1. **Run tests before commit** - Pre-commit hook runs unit tests
2. **Write tests with features** - TDD when possible
3. **Maintain coverage** - Don't let coverage drop
4. **Review test failures** - Fix tests or fix code, never ignore
5. **Update tests with changes** - Keep tests synchronized

---

## Troubleshooting

### "WebGPU is not available" in E2E tests

**Solution:** Playwright Chromium may not have WebGPU enabled:

```typescript
// playwright.config.ts
launchOptions: {
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'];
}
```

### Unit tests fail with "navigator is not defined"

**Solution:** Use happy-dom environment:

```typescript
// vitest.config.ts
test: {
  environment: 'happy-dom';
}
```

### Coverage not reaching threshold

**Solution:**

1. Check `coverage/index.html` to see uncovered lines
2. Add tests for uncovered code paths
3. Adjust thresholds if needed (temporarily)
4. Focus on critical paths first

### Tests are slow

**Solution:**

- **Unit tests:** Run in parallel (default)
- **E2E tests:** Reduce `waitForTimeout` durations
- **CI:** Use caching for node_modules and Playwright browsers

### Flaky E2E tests

**Solution:**

1. Increase timeouts for slow rendering
2. Use `waitForSelector` instead of `waitForTimeout`
3. Add retries in playwright.config.ts
4. Ensure tests are independent

---

## Next Steps

After implementing the testing infrastructure:

1. Run full test suite: `pnpm test:unit && pnpm test:e2e`
2. Review coverage report: `pnpm test:coverage`
3. Enable test job in CI (remove `if: false`)
4. Add coverage badge to README.md
5. Document test writing in CONTRIBUTING.md
6. See [DEVELOPER_EXPERIENCE_GUIDE.md](DEVELOPER_EXPERIENCE_GUIDE.md) for next steps

---

**Last Updated:** 2025-11-28
