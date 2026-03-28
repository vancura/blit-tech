import { bench, describe } from 'vitest';

import { Rect2i } from '../utils/Rect2i';
import { BitmapFont, type Glyph } from './BitmapFont';
import { SpriteSheet } from './SpriteSheet';

const ASCII_CACHE_SIZE = 128;
const CACHE_HALF_FULL = 128;
const CACHE_FULL = 256;
const BENCH_OPTIONS = {
    iterations: 500,
    time: 100,
    warmupTime: 25,
    warmupIterations: 50,
};

/**
 * Constructor shape used to instantiate `BitmapFont` with synthetic data.
 */
type BitmapFontCtor = new (
    spriteSheet: SpriteSheet,
    glyphs: Map<string, Glyph>,
    asciiGlyphs: (Glyph | null)[],
    name: string,
    size: number,
    lineHeight: number,
    baseline: number,
) => BitmapFont;

/**
 * Internal type view exposing the private measurement cache for setup control.
 */
type BitmapFontInternals = BitmapFont & {
    measureCache: Map<string, number>;
};

/**
 * Creates synthetic glyph metadata for benchmark-only font construction.
 *
 * @param advance - Horizontal advance for the glyph.
 * @param x - Glyph x position inside the synthetic atlas.
 * @param y - Glyph y position inside the synthetic atlas.
 * @returns Glyph metadata matching the runtime shape used by `BitmapFont`.
 */
function createGlyph(advance: number, x: number, y: number): Glyph {
    return {
        rect: new Rect2i(x, y, 8, 12),
        offsetX: 0,
        offsetY: 0,
        advance,
    };
}

/**
 * Builds a minimal in-memory font instance with ASCII and Unicode glyphs.
 *
 * @returns Benchmark font instance with populated lookup tables and cache state.
 */
function createBenchmarkFont(): BitmapFont {
    const glyphs = new Map<string, Glyph>();
    const asciiGlyphs = new Array<Glyph | null>(ASCII_CACHE_SIZE).fill(null);
    const sheet = new SpriteSheet({ width: 256, height: 256 } as HTMLImageElement);

    for (let code = 32; code <= 126; code++) {
        const glyph = createGlyph(6 + (code % 4), (code - 32) * 2, 0);
        const char = String.fromCharCode(code);

        glyphs.set(char, glyph);
        // eslint-disable-next-line security/detect-object-injection -- Index is an integer constrained to the ASCII table bounds above
        asciiGlyphs[code] = glyph;
    }

    for (const [index, char] of ['é', 'Ω', 'Ж', '中'].entries()) {
        glyphs.set(char, createGlyph(9 + index, index * 8, 16));
    }

    const Ctor = BitmapFont as unknown as BitmapFontCtor;

    return new Ctor(sheet, glyphs, asciiGlyphs, 'BenchFont', 12, 14, 10);
}

/**
 * Pre-populates the measurement cache to simulate different occupancy levels.
 *
 * @param font - Font whose cache should be filled.
 * @param count - Number of synthetic entries to insert.
 */
function fillMeasureCache(font: BitmapFont, count: number): void {
    const cache = (font as BitmapFontInternals).measureCache;

    cache.clear();

    for (let i = 0; i < count; i++) {
        cache.set(`cache-entry-${i}`, i);
    }
}

/**
 * Generates a string of exactly `length` characters by repeating a seed.
 *
 * @param seed - Source substring to repeat.
 * @param length - Final string length.
 * @returns Repeated string truncated to the requested length.
 */
function createRepeatedText(seed: string, length: number): string {
    return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

/**
 * Produces unique ASCII strings used to force `measureText` cache misses.
 *
 * @param length - Length of each generated string.
 * @param count - Number of unique strings to create.
 * @returns Array of unique strings for cold-path benchmarking.
 */
function createUniqueTexts(length: number, count: number): string[] {
    const texts: string[] = [];

    for (let index = 0; index < count; index++) {
        const suffix = index.toString(36).padStart(4, '0');

        texts.push(createRepeatedText(`A${suffix}B`, length));
    }

    return texts;
}

/**
 * Registers a benchmark for cache-miss text measurement at a fixed text length.
 *
 * @param name - Benchmark label shown in Vitest output.
 * @param length - Text length to generate for the cold-path workload.
 */
function benchColdMeasureText(name: string, length: number): void {
    const font = createBenchmarkFont();
    const texts = createUniqueTexts(length, 2_048);
    let index = 0;

    bench(
        name,
        () => {
            font.measureText(texts.at(index) ?? '');
            index = (index + 1) % texts.length;
        },
        BENCH_OPTIONS,
    );
}

/**
 * Registers a benchmark for repeated cache-hit width measurement of one string.
 *
 * @param name - Benchmark label shown in Vitest output.
 * @param text - Precomputed string that should remain hot in the cache.
 */
function benchWarmMeasureText(name: string, text: string): void {
    const font = createBenchmarkFont();

    font.measureText(text);

    bench(
        name,
        () => {
            font.measureText(text);
        },
        BENCH_OPTIONS,
    );
}

/**
 * Registers a benchmark for cached `measureTextSize` calls over one string.
 *
 * @param name - Benchmark label shown in Vitest output.
 * @param text - Precomputed string to measure.
 */
function benchMeasureTextSize(name: string, text: string): void {
    const font = createBenchmarkFont();

    font.measureText(text);

    bench(
        name,
        () => {
            font.measureTextSize(text);
        },
        BENCH_OPTIONS,
    );
}

describe('BitmapFont glyph lookup benchmarks', () => {
    const font = createBenchmarkFont();

    bench(
        'getGlyph ASCII fast path',
        () => {
            font.getGlyph('A');
        },
        BENCH_OPTIONS,
    );

    bench(
        'getGlyph Unicode fallback path',
        () => {
            font.getGlyph('é');
        },
        BENCH_OPTIONS,
    );

    bench(
        'getGlyphByCode ASCII fast path',
        () => {
            font.getGlyphByCode(65);
        },
        BENCH_OPTIONS,
    );
});

describe('BitmapFont measureText cache miss benchmarks', () => {
    benchColdMeasureText('measureText cold short (5 chars)', 5);
    benchColdMeasureText('measureText cold medium (50 chars)', 50);
    benchColdMeasureText('measureText cold long (200 chars)', 200);
});

describe('BitmapFont measureText cache hit benchmarks', () => {
    benchWarmMeasureText('measureText warm short (5 chars)', createRepeatedText('HELLO', 5));
    benchWarmMeasureText('measureText warm medium (50 chars)', createRepeatedText('HELLO WORLD ', 50));
    benchWarmMeasureText('measureText warm long (200 chars)', createRepeatedText('HELLO WORLD 0123456789 ', 200));
});

describe('BitmapFont measureTextSize benchmarks', () => {
    benchMeasureTextSize('measureTextSize short (5 chars)', createRepeatedText('HELLO', 5));
    benchMeasureTextSize('measureTextSize medium (50 chars)', createRepeatedText('HELLO WORLD ', 50));
    benchMeasureTextSize('measureTextSize long (200 chars)', createRepeatedText('HELLO WORLD 0123456789 ', 200));
});

describe('BitmapFont cache fill level benchmarks', () => {
    const targetText = createRepeatedText('BENCHMARK ', 50);

    for (const fillLevel of [0, CACHE_HALF_FULL, CACHE_FULL]) {
        const font = createBenchmarkFont();

        fillMeasureCache(font, fillLevel);
        font.measureText(targetText);

        bench(
            `measureText warm medium with cache fill ${fillLevel}`,
            () => {
                font.measureText(targetText);
            },
            BENCH_OPTIONS,
        );
    }
});
