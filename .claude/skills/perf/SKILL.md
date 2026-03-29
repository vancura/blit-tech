---
description:
  Add or update Blit-Tech performance tests, choose between Vitest bench and Playwright perf, and explain the CI
  benchmark workflow.
---

# Performance Testing

Use this skill when the task involves:

- adding or extending `*.bench.ts` files
- benchmarking a new hot method or allocation pattern
- deciding between CPU micro-benchmarks and browser/GPU perf tests
- working on `tests/perf/` or perf fixtures in `tests/visual/fixtures/`
- explaining or debugging benchmark CI behavior

## Benchmark Types

### Tier 1: CPU Benchmarks

Use Vitest bench for isolated hot paths that can run in Node.

Examples:

- vector math
- color conversion
- rect intersection
- glyph lookup and text measurement
- render-pipeline helper methods that do not require a browser

Commands:

```bash
pnpm bench
pnpm bench:json
```

Rules:

- colocate benchmarks as `*.bench.ts` next to the source
- compare meaningful alternatives in the same file
- prefer realistic hot-path inputs
- use `pnpm bench:json` when validating CI-facing output

### Tier 2: GPU Performance Tests

Use Playwright perf when the important metric is browser frame time.

Examples:

- sprite throughput
- texture batch switching
- bitmap text frame cost
- mixed primitive + sprite workloads

Commands:

```bash
pnpm test:perf
```

Rules:

- add or extend a fixture in `tests/visual/fixtures/`
- add or extend the scenario in `tests/perf/perf.spec.ts`
- think in terms of workload shape and frame-time stats (`median`, `p95`, `p99`)
- Tier 2 uses Playwright-managed pinned Chromium for stable baselines
- current CI for Tier 2 runs on standard hosted runners, so treat it as approximate browser perf coverage unless a
  self-hosted GPU runner exists

## Choosing the Right Tool

Use Tier 1 first if the code can run without a browser.

Use Tier 2 when:

- the code depends on browser rendering
- the user cares about whole-frame cost
- batching or texture switching is part of the question

Use both when a rendering change affects both an inner-loop method and actual rendered frame time.

## CI Behavior

Tier 1 and Tier 2 performance checks are in CI now, with separate labels.

- `main` pushes run `pnpm bench:json` and refresh the stored baseline artifact
- PRs labeled `perf-tier-1` run `pnpm bench:json`
- CI compares against the latest successful `main` baseline artifact
- CI posts or updates a PR comment with the comparison table
- CI fails if any benchmark regresses by more than 10%

- `main` pushes run `pnpm test:perf` and refresh the stored GPU perf baseline artifact
- PRs labeled `perf-tier-2` run `pnpm test:perf`
- CI compares GPU perf results against the latest successful `main` GPU perf baseline artifact
- CI posts or updates a PR comment with the frame-time comparison table
- CI fails if any scenario has a median frame-time regression greater than 50%
- Tier 2 results are intentionally loose because the current CI environment is a standard hosted runner, not dedicated
  GPU hardware

## References

- Read `docs/performance-testing.md` when the user wants an explanation or documentation update
- Read `.github/workflows/ci.yml`, `scripts/compare-tier-1-benchmarks.mjs`, and
  `scripts/compare-tier-2-perf-results.mjs` when the task is about benchmark CI
