---
description: Run tests - unit tests, coverage, visual regression, or watch mode.
---

# Run Tests

Run the test suite with various options.

## Usage

```text
/test              # Run all unit tests
/test coverage     # Run with coverage report (80% threshold)
/test watch        # Run in watch mode
/test visual       # Run visual regression tests (requires Chrome with WebGPU)
/test <file>       # Run tests for a specific file
```

## Steps

1. **Determine test scope** from the user’s arguments:
   - No arguments: Run `pnpm test:unit` (all Vitest tests)
   - `coverage`: Run `pnpm test:unit:coverage` (with coverage thresholds)
   - `watch`: Run `pnpm test:unit:watch` (interactive watch mode)
   - `visual`: Run `pnpm test:visual` (Playwright visual regression)
   - File path: Run `pnpm exec vitest run <path>`

2. **Report results**
   - If all tests pass: Confirm success with pass count
   - If tests fail: Report specific failures with file locations and assertion details
   - If coverage: Report coverage percentages vs. 80% threshold

3. **Suggest fixes for failures**
   - For assertion errors: Show expected vs. actual values
   - For type errors in tests: Check test imports and types
   - For coverage gaps: Identify untested functions/branches
   - For visual regression: Suggest `pnpm test:visual:update` if change is intentional

## Test Conventions

- Test files are colocated: `src/utils/Vector2i.test.ts` next to `Vector2i.ts`
- Visual tests are in `tests/visual/`
- Use `describe`/`it` from vitest (not `test`)
- Use `// #region` / `// #endregion` in test files over ~100 lines
- Follow the same code style as the source (four-space indent, single quotes, semicolons)
- No emoji in test descriptions
