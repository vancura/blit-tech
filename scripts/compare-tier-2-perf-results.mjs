import fs from 'node:fs';
import path from 'node:path';

const COMMENT_MARKER = '<!-- perf-comparison -->';
const DEFAULT_THRESHOLD = 50;

/**
 * Parses CLI arguments for the perf comparison command.
 *
 * @param {string[]} argv Raw CLI arguments after the node/script prefix.
 * @returns {{
 *   baseline: string | null,
 *   current: string | null,
 *   jsonOut: string,
 *   markdownOut: string,
 *   threshold: number,
 * }} Parsed command options.
 */
function parseArgs(argv) {
    const args = {
        baseline: null,
        current: null,
        jsonOut: 'perf-comparison.json',
        markdownOut: 'perf-comment.md',
        threshold: DEFAULT_THRESHOLD,
    };

    for (let index = 0; index < argv.length; index += 1) {
        // eslint-disable-next-line security/detect-object-injection -- CLI flags are parsed from a fixed argv array shape.
        const value = argv[index];
        const nextValue = argv[index + 1];

        if (!value.startsWith('--')) {
            throw new Error(`Unexpected positional token: ${value}`);
        }

        if (nextValue === undefined || nextValue.startsWith('--') || nextValue.startsWith('-')) {
            throw new Error(`Missing or invalid value for argument: ${value}`);
        }

        switch (value) {
            case '--baseline':
                args.baseline = nextValue;
                index += 1;
                break;
            case '--current':
                args.current = nextValue;
                index += 1;
                break;
            case '--json-out':
                args.jsonOut = nextValue;
                index += 1;
                break;
            case '--markdown-out':
                args.markdownOut = nextValue;
                index += 1;
                break;
            case '--threshold':
                args.threshold = Number(nextValue);
                index += 1;
                break;
            default:
                throw new Error(`Unknown argument: ${value}`);
        }
    }

    if (!args.current) {
        throw new Error('The --current argument is required');
    }

    if (!Number.isFinite(args.threshold) || args.threshold < 0) {
        throw new Error(`Invalid --threshold value: ${String(args.threshold)}`);
    }

    return args;
}

/**
 * Ensures that the parent directory for an output file exists.
 *
 * @param {string} filePath Output file path.
 * @returns {void}
 */
function ensureParentDirectory(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Reads and parses a JSON file from disk.
 *
 * @param {string} filePath JSON file path.
 * @returns {unknown} Parsed JSON value.
 */
function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Throws when a required condition is not met.
 *
 * @param {unknown} condition Condition to evaluate.
 * @param {string} message Error message for failed assertions.
 * @returns {void}
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Validates the top-level shape of a perf benchmark report.
 *
 * @param {unknown} report Parsed perf report JSON.
 * @param {string} sourceLabel Human-readable source label for error messages.
 * @returns {void}
 */
function validatePerfReport(report, sourceLabel) {
    assert(report !== null && typeof report === 'object', `Invalid perf report in ${sourceLabel}: expected object`);
    assert(Array.isArray(report.scenarios), `Invalid perf report in ${sourceLabel}: report.scenarios must be an array`);
}

/**
 * Flattens the perf report into scenario entries suitable for comparison.
 *
 * @param {{ scenarios: unknown[], __sourceLabel?: string }} report Parsed perf report.
 * @returns {Array<{
 *   fixture: string,
 *   label: string,
 *   matchKey: string,
 *   name: string,
 *   stats: {
 *     frames: number,
 *     max: number,
 *     median: number,
 *     min: number,
 *     p95: number,
 *     p99: number,
 *   },
 * }>} Flattened perf scenario entries.
 */
function flattenPerfScenarios(report) {
    const entries = [];
    const reportLabel = report.__sourceLabel ?? 'perf report';
    const seenMatchKeys = new Set();

    validatePerfReport(report, reportLabel);

    for (const [scenarioIndex, scenario] of report.scenarios.entries()) {
        assert(
            scenario !== null && typeof scenario === 'object',
            `Invalid scenario entry at index ${scenarioIndex} in ${reportLabel}`,
        );
        assert(
            typeof scenario.fixture === 'string',
            `Invalid scenario.fixture at index ${scenarioIndex} in ${reportLabel}`,
        );
        assert(typeof scenario.name === 'string', `Invalid scenario.name at index ${scenarioIndex} in ${reportLabel}`);
        assert(
            scenario.stats !== null && typeof scenario.stats === 'object',
            `Invalid scenario.stats for ${scenario.name} in ${reportLabel}`,
        );
        assert(Number.isFinite(scenario.stats.frames), `Invalid stats.frames for ${scenario.name} in ${reportLabel}`);
        assert(Number.isFinite(scenario.stats.median), `Invalid stats.median for ${scenario.name} in ${reportLabel}`);
        assert(Number.isFinite(scenario.stats.p95), `Invalid stats.p95 for ${scenario.name} in ${reportLabel}`);
        assert(Number.isFinite(scenario.stats.p99), `Invalid stats.p99 for ${scenario.name} in ${reportLabel}`);
        assert(Number.isFinite(scenario.stats.min), `Invalid stats.min for ${scenario.name} in ${reportLabel}`);
        assert(Number.isFinite(scenario.stats.max), `Invalid stats.max for ${scenario.name} in ${reportLabel}`);

        const matchKey = `${scenario.fixture}::${scenario.name}`;
        assert(
            !seenMatchKeys.has(matchKey),
            `Duplicate perf scenario matchKey ${matchKey} encountered in ${reportLabel}`,
        );
        seenMatchKeys.add(matchKey);

        entries.push({
            fixture: scenario.fixture,
            label: scenario.name,
            matchKey,
            name: scenario.name,
            stats: scenario.stats,
        });
    }

    return entries;
}

/**
 * Calculates the percentage change for a frame-time metric.
 *
 * @param {number} baselineValue Baseline frame-time value.
 * @param {number} currentValue Current frame-time value.
 * @returns {number | string} Percentage change where positive means slower.
 */
function calculateRegressionPct(baselineValue, currentValue) {
    if (baselineValue === 0) {
        if (currentValue === 0) {
            return 0;
        }

        return currentValue > 0 ? 'zero-baseline-positive' : 'zero-baseline-negative';
    }

    return ((currentValue - baselineValue) / baselineValue) * 100;
}

/**
 * Checks whether a perf delta should count as a regression.
 *
 * @param {number | string | null} value Perf delta value.
 * @param {number} thresholdPct Maximum allowed slowdown percentage before failure.
 * @returns {boolean} True when the delta exceeds the allowed regression threshold.
 */
function isRegressionDelta(value, thresholdPct) {
    if (value === 'zero-baseline-positive') {
        return true;
    }

    if (typeof value === 'number') {
        return value > thresholdPct;
    }

    return false;
}

/**
 * Checks whether a perf delta should count as an improvement.
 *
 * @param {number | string | null} value Perf delta value.
 * @returns {boolean} True when the delta indicates an improvement versus baseline.
 */
function isImprovementDelta(value) {
    if (value === 'zero-baseline-negative') {
        return true;
    }

    if (typeof value === 'number') {
        return value < 0;
    }

    return false;
}

/**
 * Compares current perf results against an optional baseline report.
 *
 * @param {{ scenarios: unknown[], __sourceLabel?: string }} currentReport Current perf report.
 * @param {{ scenarios: unknown[], __sourceLabel?: string } | null} baselineReport Baseline perf report, if available.
 * @param {number} thresholdPct Maximum allowed slowdown percentage before failure.
 * @returns {{
 *   generatedAt: string,
 *   hasBaseline: boolean,
 *   thresholdPct: number,
 *   summary: {
 *     total: number,
 *     compared: number,
 *     regressions: number,
 *     improvements: number,
 *     pass: number,
 *     newScenarios: number,
 *     missingScenarios: number,
 *   },
 *   scenarios: Array<{
 *     fixture: string,
 *     name: string,
 *     baselineStats: {
 *       frames: number,
 *       max: number,
 *       median: number,
 *       min: number,
 *       p95: number,
 *       p99: number,
 *     } | null,
 *     currentStats: {
 *       frames: number,
 *       max: number,
 *       median: number,
 *       min: number,
 *       p95: number,
 *       p99: number,
 *     } | null,
 *     deltas: {
 *       median: number | string | null,
 *       p95: number | string | null,
 *       p99: number | string | null,
 *     },
 *     status: string,
 *   }>,
 * }} Comparison report used by CI and PR comments.
 */
function comparePerfReports(currentReport, baselineReport, thresholdPct) {
    const currentEntries = flattenPerfScenarios(currentReport);
    const baselineEntries = baselineReport ? flattenPerfScenarios(baselineReport) : [];
    const currentByKey = new Map(currentEntries.map((entry) => [entry.matchKey, entry]));
    const baselineByKey = new Map(baselineEntries.map((entry) => [entry.matchKey, entry]));
    const keys = [...new Set([...baselineByKey.keys(), ...currentByKey.keys()])].sort((left, right) =>
        left.localeCompare(right),
    );

    const scenarios = keys.map((key) => {
        const baselineEntry = baselineByKey.get(key) ?? null;
        const currentEntry = currentByKey.get(key) ?? null;

        if (!baselineEntry) {
            return {
                fixture: currentEntry?.fixture ?? 'unknown',
                name: currentEntry?.label ?? key,
                baselineStats: null,
                currentStats: currentEntry?.stats ?? null,
                deltas: { median: null, p95: null, p99: null },
                status: 'new',
            };
        }

        if (!currentEntry) {
            return {
                fixture: baselineEntry.fixture,
                name: baselineEntry.label,
                baselineStats: baselineEntry.stats,
                currentStats: null,
                deltas: { median: null, p95: null, p99: null },
                status: 'missing',
            };
        }

        const deltas = {
            median: calculateRegressionPct(baselineEntry.stats.median, currentEntry.stats.median),
            p95: calculateRegressionPct(baselineEntry.stats.p95, currentEntry.stats.p95),
            p99: calculateRegressionPct(baselineEntry.stats.p99, currentEntry.stats.p99),
        };
        let status = 'pass';

        if (isRegressionDelta(deltas.median, thresholdPct)) {
            status = 'fail';
        } else if (isImprovementDelta(deltas.median)) {
            status = 'improved';
        }

        return {
            fixture: currentEntry.fixture,
            name: currentEntry.label,
            baselineStats: baselineEntry.stats,
            currentStats: currentEntry.stats,
            deltas,
            status,
        };
    });

    const summary = {
        total: scenarios.length,
        compared: scenarios.filter((scenario) => scenario.deltas.median !== null).length,
        regressions: scenarios.filter((scenario) => scenario.status === 'fail').length,
        improvements: scenarios.filter((scenario) => scenario.status === 'improved').length,
        pass: scenarios.filter((scenario) => scenario.status === 'pass').length,
        newScenarios: scenarios.filter((scenario) => scenario.status === 'new').length,
        missingScenarios: scenarios.filter((scenario) => scenario.status === 'missing').length,
    };

    return {
        generatedAt: new Date().toISOString(),
        hasBaseline: baselineReport !== null,
        thresholdPct,
        summary,
        scenarios,
    };
}

/**
 * Formats a frame-time value for markdown output.
 *
 * @param {number | null} value Frame-time value in milliseconds.
 * @returns {string} Formatted frame-time string.
 */
function formatFrameTime(value) {
    if (value === null) {
        return 'n/a';
    }

    return `${value.toFixed(2)}ms`;
}

/**
 * Formats a regression delta percentage for markdown output.
 *
 * @param {number | string | null} value Percentage delta where positive means slower.
 * @returns {string} Formatted delta string.
 */
function formatDelta(value) {
    if (value === null) {
        return 'n/a';
    }

    if (value === 'zero-baseline-positive') {
        return 'zero-baseline+';
    }

    if (value === 'zero-baseline-negative') {
        return 'zero-baseline-';
    }

    const sign = value > 0 ? '+' : '';

    return `${sign}${value.toFixed(2)}%`;
}

/**
 * Converts an internal perf scenario status into the PR comment label.
 *
 * @param {string} status Internal scenario status.
 * @returns {string} Human-readable status label.
 */
function formatStatus(status) {
    switch (status) {
        case 'fail':
            return 'FAIL';
        case 'improved':
            return 'IMPROVED';
        case 'new':
            return 'NEW';
        case 'missing':
            return 'MISSING';
        default:
            return 'PASS';
    }
}

/**
 * Escapes a markdown table cell value.
 *
 * @param {string} value Raw markdown cell content.
 * @returns {string} Escaped markdown-safe value.
 */
function escapeMarkdownCell(value) {
    return value.replaceAll('|', '\\|');
}

/**
 * Builds the markdown body for the perf PR comment.
 *
 * @param {{
 *   hasBaseline: boolean,
 *   thresholdPct: number,
 *   summary: {
 *     compared: number,
 *     regressions: number,
 *     improvements: number,
 *     newScenarios: number,
 *     missingScenarios: number,
 *   },
 *   scenarios: Array<{
 *     fixture: string,
 *     name: string,
 *     baselineStats: { median: number } | null,
 *     currentStats: { median: number } | null,
 *     deltas: { median: number | string | null, p95: number | string | null, p99: number | string | null },
 *     status: string,
 *   }>,
 * }} report Comparison report.
 * @returns {string} Markdown comment body.
 */
function buildMarkdown(report) {
    const lines = [COMMENT_MARKER, '## Tier 2 GPU Perf Comparison', ''];

    if (!report.hasBaseline) {
        lines.push(
            'No `main` branch GPU perf baseline artifact is available yet. This run produced fresh perf results and uploaded them as artifacts.',
            '',
            `Configured regression threshold: ${report.thresholdPct}% slower median frame time.`,
        );

        return `${lines.join('\n')}\n`;
    }

    lines.push(
        `Compared ${report.summary.compared} perf scenarios against the latest \`main\` baseline. Regression threshold: ${report.thresholdPct}% slower median frame time.`,
        '',
        `Regressions: ${report.summary.regressions} | Improvements: ${report.summary.improvements} | New: ${report.summary.newScenarios} | Missing: ${report.summary.missingScenarios}`,
        '',
        '<details>',
        '<summary>Perf table</summary>',
        '',
        '| Fixture | Scenario | Baseline median | Current median | Median delta | P95 delta | P99 delta | Status |',
        '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    );

    for (const scenario of report.scenarios) {
        lines.push(
            `| ${escapeMarkdownCell(scenario.fixture)} | ${escapeMarkdownCell(scenario.name)} | ${formatFrameTime(scenario.baselineStats?.median ?? null)} | ${formatFrameTime(scenario.currentStats?.median ?? null)} | ${formatDelta(scenario.deltas.median)} | ${formatDelta(scenario.deltas.p95)} | ${formatDelta(scenario.deltas.p99)} | ${formatStatus(scenario.status)} |`,
        );
    }

    lines.push('', '</details>');

    return `${lines.join('\n')}\n`;
}

/**
 * Writes a file to disk, creating parent directories when needed.
 *
 * @param {string} filePath Output file path.
 * @param {string} content File contents.
 * @returns {void}
 */
function writeFile(filePath, content) {
    ensureParentDirectory(filePath);
    fs.writeFileSync(filePath, content);
}

/**
 * Runs the perf comparison CLI.
 *
 * @returns {void}
 */
function main() {
    const args = parseArgs(process.argv.slice(2));
    const currentReport = readJsonFile(args.current);
    currentReport.__sourceLabel = args.current;
    let baselineReport = null;

    if (args.baseline) {
        assert(fs.existsSync(args.baseline), `Missing baseline perf report: ${args.baseline}`);
        baselineReport = readJsonFile(args.baseline);
    }

    if (baselineReport !== null) {
        baselineReport.__sourceLabel = args.baseline;
    }

    const report = comparePerfReports(currentReport, baselineReport, args.threshold);

    writeFile(args.jsonOut, JSON.stringify(report, null, 2));
    writeFile(args.markdownOut, buildMarkdown(report));
}

main();
