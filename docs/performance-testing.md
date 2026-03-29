# Performance Testing

Blit-Tech has two performance testing layers: fast CPU micro-benchmarks for hot methods and browser-based frame-time
benchmarks for rendered workloads. This guide explains when to use each one, how to add a new benchmark, and how CI uses
the results.

## Table of Contents

- [Overview](#overview)
- [Tier 1: CPU Benchmarks](#tier-1-cpu-benchmarks)
- [Tier 2: GPU Frame-Time Benchmarks](#tier-2-gpu-frame-time-benchmarks)
- [Choosing the Right Benchmark Type](#choosing-the-right-benchmark-type)
- [Adding a New CPU Benchmark](#adding-a-new-cpu-benchmark)
- [Adding a New GPU Performance Test](#adding-a-new-gpu-performance-test)
- [Commands](#commands)
- [CI Benchmark Workflow](#ci-benchmark-workflow)
- [Recommended Workflow for New Performance Work](#recommended-workflow-for-new-performance-work)

---

## Overview

Blit-Tech now uses two benchmarking methods:

1. **Tier 1: CPU benchmarks** with Vitest bench.
2. **Tier 2: browser frame-time performance tests** with Playwright and Chromium WebGPU.

These serve different purposes.

### CPU Benchmarks

Use CPU benchmarks when you want to measure a single method, hot loop, cache lookup, math helper, allocation pattern, or
batching helper in isolation.

Examples:

- `Vector2i.add()` vs `Vector2i.addInPlace()`
- `Color32.toFloat32Array()` vs `Color32.writeToFloat32Array()`
- `BitmapFont.measureText()` cold vs warm cache
- `Rect2i.containsXY()` vs `Rect2i.contains()`

### GPU Performance Tests

Use GPU performance tests when you want to measure whole-frame rendering cost in the browser.

Examples:

- 500 sprites with one texture vs alternating textures
- many filled rects or diagonal lines
- bitmap text rendering throughput
- mixed scenes with primitives and sprites together

---

## Tier 1: CPU Benchmarks

Tier 1 benchmarks are implemented with Vitest bench and colocated next to the source as `*.bench.ts` files.

Current benchmark files:

- `src/utils/Vector2i.bench.ts`
- `src/utils/Color32.bench.ts`
- `src/utils/Rect2i.bench.ts`
- `src/assets/BitmapFont.bench.ts`

### Tier 1 Metrics

CPU benchmarks report **ops/sec**. Higher numbers are better.

If one benchmark shows:

- `20,000,000 ops/sec`

and another shows:

- `10,000,000 ops/sec`

the first one is roughly twice as fast.

### Why This Is the Default Choice

CPU benchmarks are:

- faster to run locally
- easier to write
- easier to reason about
- already integrated into CI regression checks when the PR is labeled `perf-tier-1`

If you add a new hot method and want immediate automated regression protection, this is the first tool to use.

---

## Tier 2: GPU Frame-Time Benchmarks

Tier 2 performance tests are implemented with Playwright and browser fixtures under `tests/perf/` and
`tests/visual/fixtures/`.

Current entrypoints:

- `tests/perf/perf.spec.ts`
- `tests/visual/fixtures/perf-primitives.html`
- `tests/visual/fixtures/perf-sprites.html`
- `tests/visual/fixtures/perf-fonts.html`
- `tests/visual/fixtures/perf-mixed.html`

### Tier 2 Metrics

GPU performance tests measure **frame time**, not ops/sec.

The fixture renders a workload for a fixed number of frames and records frame durations with `performance.now()`.
Playwright collects the raw frame times and computes:

- `median`
- `p95`
- `p99`

Lower frame times are better.

### Browser Runtime

Tier 2 uses the Playwright-managed **pinned Chromium** build that matches the Playwright version in this repository.
That keeps browser revisions stable across local runs and CI, which reduces baseline drift compared with floating
branded Chrome installs.

### Why This Exists

Some changes look cheap in isolation but are expensive in a real frame. For example:

- texture batch switching
- sprite submission overhead
- rendering many lines or quads in one frame
- interaction between primitives and sprites

That is what Tier 2 is for.

### Current CI Status

Tier 2 can be run locally with `pnpm test:perf` and is now wired into CI as a **label-gated PR workflow**. CI uses a
much looser threshold for GPU perf than Tier 1 because browser/GPU variance is higher on shared runners.

Today, that CI job still runs on standard GitHub-hosted Linux runners, not on dedicated GPU hardware. Treat Tier 2 CI as
an **approximate browser perf smoke signal**, not as a hardware-accurate GPU benchmark. If a self-hosted GPU runner is
added later, the same workflow can be pointed at it and re-baselined.

---

## Choosing the Right Benchmark Type

Use this rule of thumb:

### Use Tier 1 CPU Benchmarks When

- the code runs in Node without a browser
- you are measuring a specific method or helper
- you want to compare allocating vs in-place variants
- you want CI to catch regressions now

### Use Tier 2 GPU Performance Tests When

- the code depends on browser rendering
- the important question is frame time, not raw method throughput
- the code affects batching, submission, or whole-frame draw cost

If you need hardware-true GPU numbers, a controlled local machine or a future self-hosted GPU runner is still a better
source of truth than current hosted CI.

### Use Both When

You changed something in the render path and want both:

- a micro-benchmark for the hot method itself
- a browser performance test for actual frame impact

This is often the best approach for rendering code.

---

## Adding a New CPU Benchmark

If you add a new sprite-related method and it can run without a browser, start here.

### File Location

Create or extend a `*.bench.ts` file near the code being measured.

Examples:

```text
src/utils/MyType.bench.ts
src/render/SpritePipeline.bench.ts
```

### Basic Structure

```ts
import { bench, describe } from 'vitest';

import { MyType } from './MyType';

describe('MyType hot paths', () => {
  const instance = new MyType();

  bench('newMethod()', () => {
    instance.newMethod();
  });

  bench('oldMethod()', () => {
    instance.oldMethod();
  });
});
```

### What to Compare

Good benchmark comparisons usually measure one meaningful tradeoff:

- new method vs previous method
- allocating vs in-place
- small input vs large input
- cold cache vs warm cache
- vector argument vs raw `x, y` argument

### Benchmark Design Rules

- keep the benchmark focused on one hot behavior
- use realistic inputs, not absurd synthetic values unless stress testing is intentional
- compare alternatives in the same file so the relative result is obvious
- prefer stable setup outside the `bench(...)` callback
- if mutation is involved, reset state inside the benchmark or in setup so each iteration is valid

### Running It

```bash
pnpm bench
pnpm bench:json
```

`pnpm bench` gives the terminal report.

`pnpm bench:json` writes `benchmark-results.json`, which is what CI uses.

---

## Adding a New GPU Performance Test

Use this when the change is meaningful only in a browser render loop.

### File Location

Add or extend:

- a fixture page in `tests/visual/fixtures/`
- a scenario in `tests/perf/perf.spec.ts`

### Typical Pattern

1. Create a parameterized fixture that renders the workload.
2. Run a fixed number of frames.
3. Record frame times with `performance.now()`.
4. Return the raw frame times to Playwright.
5. Let the Playwright spec compute `median`, `p95`, and `p99`.

### Good GPU Performance Cases

- many sprites using one texture
- many sprites alternating textures
- many bitmap text characters
- mixed primitive + sprite workloads
- stress cases that intentionally push batching or fill rate

### Running It

```bash
pnpm test:perf
```

The results are written to `test-results/perf/perf-results.json`.

---

## Commands

```bash
pnpm bench       # Run all Tier 1 CPU benchmarks
pnpm bench:json  # Run Tier 1 benchmarks and write benchmark-results.json
pnpm test:perf   # Run Tier 2 browser/GPU performance tests
```

### Which Command Should I Use?

- **New hot method:** `pnpm bench`
- **Need machine-readable result for comparison:** `pnpm bench:json`
- **Whole browser frame cost:** `pnpm test:perf`

---

## CI Benchmark Workflow

Tier 1 CPU benchmark regression detection is now wired into GitHub Actions.

### What Happens on `main`

On pushes to `main`, CI:

1. runs `pnpm bench:json`
2. produces `benchmark-results.json`
3. uploads that file as the latest benchmark baseline artifact

That artifact becomes the reference point for future pull requests.

### What Happens on a Pull Request

On PRs targeting `main` with the `perf-tier-1` label, CI:

1. runs the normal `quality` job first
2. runs the `benchmark` job
3. runs `pnpm bench:json`
4. downloads the latest successful `main` benchmark baseline artifact
5. compares PR results against the `main` baseline
6. posts or updates a PR comment with a benchmark comparison table
7. fails the job if any benchmark is more than **10% slower**

PRs without the `perf-tier-1` label skip the Tier 1 benchmark job to reduce CI cost.

### Tier 2 GPU Perf Workflow

Tier 2 GPU perf uses the same baseline-artifact model, but it is gated separately and uses a much looser threshold.

On pushes to `main`, CI:

1. runs `pnpm test:perf`
2. produces `test-results/perf/perf-results.json`
3. uploads that file as the latest GPU perf baseline artifact

On PRs targeting `main` with the `perf-tier-2` label, CI:

1. runs `pnpm test:perf`
2. downloads the latest successful `main` GPU perf baseline artifact
3. compares current frame-time stats against the baseline
4. posts or updates a PR comment with the GPU perf comparison table
5. fails the job if any scenario has a **median frame time** regression greater than **50%**

PRs without the `perf-tier-2` label skip the Tier 2 GPU perf job to reduce CI cost.

Tier 2 CI currently uses Playwright-managed pinned Chromium on standard GitHub-hosted Linux runners. That keeps browser
revisions stable, but the hardware is still shared and not GPU-dedicated. Use these CI results as approximate browser
perf coverage rather than hardware-accurate GPU benchmarking.

### What the PR Comment Contains

The comparison comment includes:

- benchmark name
- baseline ops/sec
- current ops/sec
- delta percent
- pass/fail status

### What Counts as Failure

The benchmark CI job fails if:

- any benchmark regresses by more than 10%
- a previously existing benchmark disappears from the PR run

---

## Recommended Workflow for New Performance Work

If you add a new sprite operation, follow this order:

1. **Write the code clearly first.**
2. **Add a Tier 1 CPU benchmark** if the method can run in Node.
3. **Run `pnpm bench` locally** to compare the new method against the old behavior or an alternative implementation.
4. **Run `pnpm bench:json`** if you want to inspect the machine-readable output used by CI.
5. **Add a Tier 2 GPU test** if the change affects real render throughput or frame time.
6. **Open a PR** and add:
   - `perf-tier-1` for Tier 1 CPU benchmark comparison
   - `perf-tier-2` for Tier 2 GPU perf comparison

### Best Default

If you are unsure which path to choose:

- start with **Tier 1 CPU benchmarking**

It is simpler, faster, and already supported by the label-gated benchmark CI.

Add Tier 2 only when the real question is about frame rendering cost in the browser.
