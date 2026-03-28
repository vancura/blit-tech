import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// #region Types

interface RawPerfResult {
    frameTimes: number[];
    frames: number;
    scenario: string;
    warmupFrames: number;
    workload: Record<string, number | string>;
}

interface PerfStats {
    frames: number;
    max: number;
    median: number;
    min: number;
    p95: number;
    p99: number;
}

interface PerfScenarioResult {
    fixture: string;
    name: string;
    stats: PerfStats;
    workload: Record<string, number | string>;
}

interface PerfScenario {
    fixture: string;
    name: string;
    query: Record<string, number | string>;
}

interface PerfWindow {
    __INIT_FAILED__?: boolean;
    __PERF_COMPLETE__?: boolean;
    __PERF_RESULT__?: RawPerfResult | null;
}

// #endregion

// #region Constants

const PERF_RESULTS_FILE = path.resolve(process.cwd(), 'test-results/perf/perf-results.json');

const perfResults: PerfScenarioResult[] = [];

const perfScenarios: PerfScenario[] = [
    {
        fixture: 'perf-primitives.html',
        name: 'primitives',
        query: { frames: 100, lines: 80, pixels: 400, rects: 120, warmup: 10 },
    },
    {
        fixture: 'perf-sprites.html',
        name: 'sprites-same-texture',
        query: { frames: 100, sprites: 800, textureMode: 'same', warmup: 10 },
    },
    {
        fixture: 'perf-sprites.html',
        name: 'sprites-alternating-textures',
        query: { frames: 100, sprites: 800, textureMode: 'alternating', warmup: 10 },
    },
    {
        fixture: 'perf-fonts.html',
        name: 'fonts',
        query: { chars: 480, frames: 100, lineWidth: 32, warmup: 10 },
    },
    {
        fixture: 'perf-mixed.html',
        name: 'mixed',
        query: { chars: 160, frames: 100, lines: 100, rects: 140, sprites: 220, warmup: 10 },
    },
];

// #endregion

// #region Helpers

/**
 * Builds a fixture URL with query parameters for a perf scenario.
 *
 * @param fixture - Fixture HTML filename.
 * @param query - Query parameters passed to the page.
 * @returns Relative URL for Playwright navigation.
 */
function buildFixtureUrl(fixture: string, query: Record<string, number | string>): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        params.set(key, String(value));
    }

    return `/${fixture}?${params.toString()}`;
}

/**
 * Computes summary statistics from a list of frame times.
 *
 * @param frameTimes - Recorded frame durations in milliseconds.
 * @returns Median, tail percentiles, and min/max values.
 */
function computeStats(frameTimes: number[]): PerfStats {
    const sorted = [...frameTimes].sort((left, right) => left - right);

    return {
        frames: sorted.length,
        max: sorted[sorted.length - 1] ?? 0,
        median: percentile(sorted, 0.5),
        min: sorted[0] ?? 0,
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
    };
}

/**
 * Calculates a percentile using nearest-rank selection.
 *
 * @param sorted - Frame times sorted ascending.
 * @param percentileValue - Percentile expressed as 0.0-1.0.
 * @returns Value at the requested percentile.
 */
function percentile(sorted: number[], percentileValue: number): number {
    if (sorted.length === 0) {
        return 0;
    }

    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);

    return sorted.at(index) ?? 0;
}

/**
 * Writes the aggregated perf results to a machine-readable JSON file.
 */
function writePerfResultsFile(): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Output path is a fixed test artifact location under test-results/perf
    fs.mkdirSync(path.dirname(PERF_RESULTS_FILE), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Output path is a fixed test artifact location under test-results/perf
    fs.writeFileSync(
        PERF_RESULTS_FILE,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                scenarios: perfResults,
            },
            null,
            2,
        ),
    );
}

// #endregion

// #region Tests

test.afterAll(() => {
    writePerfResultsFile();
});

for (const scenario of perfScenarios) {
    test(`collects frame-time stats for ${scenario.name}`, async ({ page }, testInfo) => {
        await page.goto(buildFixtureUrl(scenario.fixture, scenario.query));

        await page.waitForFunction(
            () => {
                const perfWindow = window as unknown as PerfWindow;

                return perfWindow.__PERF_COMPLETE__ || perfWindow.__INIT_FAILED__;
            },
            { timeout: 30_000 },
        );

        const rawResult = await page.evaluate(() => {
            const perfWindow = window as unknown as PerfWindow;

            return {
                initFailed: perfWindow.__INIT_FAILED__,
                result: perfWindow.__PERF_RESULT__ ?? null,
            };
        });

        test.skip(rawResult.initFailed === true, 'WebGPU not available in this environment');

        expect(rawResult.result).not.toBeNull();

        const result = rawResult.result as RawPerfResult;

        expect(result.frameTimes.length).toBe(result.frames);

        const stats = computeStats(result.frameTimes);
        const scenarioResult: PerfScenarioResult = {
            fixture: scenario.fixture,
            name: scenario.name,
            stats,
            workload: result.workload,
        };

        perfResults.push(scenarioResult);

        await testInfo.attach('perf-stats', {
            body: JSON.stringify(scenarioResult, null, 2),
            contentType: 'application/json',
        });

        console.log(
            `[perf] ${scenario.name}: median=${stats.median.toFixed(2)}ms p95=${stats.p95.toFixed(2)}ms p99=${stats.p99.toFixed(2)}ms`,
        );
    });
}

// #endregion
