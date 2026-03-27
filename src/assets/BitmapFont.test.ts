/**
 * Unit tests for {@link BitmapFont}.
 *
 * Exercises the bitmap-font workflow end to end:
 * - loading `.btfont` JSON metadata and its backing texture
 * - ASCII and Unicode glyph lookup paths
 * - text measurement, cache reuse, and cache eviction
 * - metadata defaults and relative texture resolution
 * - failure modes for invalid font data and texture load errors
 *
 * The suite uses stubbed `fetch` and `Image` globals so glyph and measurement
 * behavior can be validated without real browser I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BitmapFont } from './BitmapFont';

// #region Test Fixtures

/**
 * Canonical fixture returned by mocked font fetches.
 *
 * Includes ASCII glyphs plus one extended Unicode glyph so the tests can cover
 * both the fast ASCII lookup table and the fallback Unicode map path.
 */
const MOCK_FONT_DATA: object = {
    name: 'TestFont',
    size: 12,
    lineHeight: 14,
    baseline: 10,
    texture: 'data:image/png;base64,aGVsbG8=',
    glyphs: {
        A: { x: 0, y: 0, w: 8, h: 12, ox: 0, oy: 0, adv: 9 },
        B: { x: 8, y: 0, w: 7, h: 12, ox: 0, oy: 0, adv: 8 },
        '\u00e9': { x: 16, y: 0, w: 6, h: 12, ox: 0, oy: 1, adv: 7 },
    },
};

// #endregion

// #region BitmapFont Tests

describe('BitmapFont', () => {
    let font: BitmapFont;

    beforeEach(async () => {
        // Stub Image to fire onload synchronously.
        vi.stubGlobal(
            'Image',
            class {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                width = 64;
                height = 16;

                private _src = '';

                get src(): string {
                    return this._src;
                }

                set src(value: string) {
                    this._src = value;
                    this.onload?.();
                }
            },
        );

        // Stub fetch to return the mock font data.
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                json: vi.fn().mockResolvedValue(MOCK_FONT_DATA),
            }),
        );

        font = await BitmapFont.load('test.btfont');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should load from .btfont URL', () => {
        expect(font).toBeDefined();
        expect(font.name).toBe('TestFont');
        expect(font.lineHeight).toBe(14);
        expect(font.baseline).toBe(10);
    });

    it('should look up ASCII glyphs via a fast path', () => {
        const glyph = font.getGlyph('A');

        expect(glyph).not.toBeNull();
        expect(glyph?.advance).toBe(9);
        expect(glyph?.rect.x).toBe(0);
    });

    it('should look up Unicode glyphs via Map', () => {
        const glyph = font.getGlyph('\u00e9');

        expect(glyph).not.toBeNull();
        expect(glyph?.advance).toBe(7);
    });

    it('should measure text width with caching', () => {
        const width = font.measureText('AB');

        expect(width).toBe(17); // 9 (A advance) + 8 (B advance)

        // Second call returns the cached result.
        const cached = font.measureText('AB');

        expect(cached).toBe(width);
    });

    it('should evict the oldest entry when the cache exceeds max size', () => {
        // Fill the cache with 256 unique strings.
        for (let i = 0; i < 256; i++) {
            font.measureText(`str-${i}`);
        }

        // The 257th entry triggers FIFO eviction of the first entry.
        expect(() => font.measureText('overflow')).not.toThrow();

        // Font still measures correctly after eviction.
        expect(font.measureText('A')).toBe(9);
    });

    it('should report hasGlyph correctly', () => {
        expect(font.hasGlyph('A')).toBe(true);
        expect(font.hasGlyph('B')).toBe(true);
        expect(font.hasGlyph('\u00e9')).toBe(true);
        expect(font.hasGlyph('Z')).toBe(false);
    });

    it('should clear the measure cache', () => {
        font.measureText('A'); // Populate cache.
        font.clearMeasureCache();

        // After clearing, measurement still works (recomputed from glyph data).
        expect(font.measureText('A')).toBe(9);
    });

    // #region Additional accessors

    it('should return the correct glyphCount', () => {
        expect(font.glyphCount).toBe(3);
    });

    it('should return null for getGlyph of a missing character', () => {
        expect(font.getGlyph('Z')).toBeNull();
    });

    it('should use Unicode Map fallback for getGlyph with a high-char code', () => {
        // '\u00e9' has char code 233 which is >= ASCII_CACHE_SIZE (128).
        const glyph = font.getGlyph('\u00e9');

        expect(glyph).not.toBeNull();
        expect(glyph?.advance).toBe(7);
    });

    it('should look up glyph by ASCII code with getGlyphByCode', () => {
        const glyph = font.getGlyphByCode('A'.charCodeAt(0)); // 65

        expect(glyph).not.toBeNull();
        expect(glyph?.advance).toBe(9);
    });

    it('should return null for getGlyphByCode of an unknown ASCII code', () => {
        expect(font.getGlyphByCode('Z'.charCodeAt(0))).toBeNull();
    });

    it('should use Map fallback for getGlyphByCode with Unicode code >= 128', () => {
        const glyph = font.getGlyphByCode(0x00e9); // 233

        expect(glyph).not.toBeNull();
        expect(glyph?.advance).toBe(7);
    });

    it('should return the sprite sheet from getSpriteSheet', () => {
        const spriteSheet = font.getSpriteSheet();

        expect(spriteSheet).toBeDefined();
        expect(spriteSheet.size.x).toBe(64);
        expect(spriteSheet.size.y).toBe(16);
    });

    it('should return the correct measureTextSize width and height', () => {
        const size = font.measureTextSize('AB');

        expect(size.width).toBe(17); // 9 + 8
        expect(size.height).toBe(14); // lineHeight
    });

    it('should write width and height into the provided object for measureTextSizeInto', () => {
        const result = { width: 0, height: 0 };

        font.measureTextSizeInto('A', result);

        expect(result.width).toBe(9);
        expect(result.height).toBe(14);
    });

    it('should use Unicode Map fallback for hasGlyph with char code >= 128', () => {
        expect(font.hasGlyph('\u00e9')).toBe(true);
        expect(font.hasGlyph('\u0100')).toBe(false); // not in font
    });

    it('should return 0 width for a character not in the font (measureText)', () => {
        expect(font.measureText('\u0100')).toBe(0);
    });

    // #endregion

    // #region load error cases

    describe('load error cases', () => {
        it('should throw when fetch returns a non-ok response', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));

            await expect(BitmapFont.load('missing.btfont')).rejects.toThrow('Failed to load font');
        });

        it('should throw when font JSON is missing the texture field', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue({
                        name: 'Test',
                        size: 12,
                        lineHeight: 14,
                        baseline: 10,
                        glyphs: {},
                    }),
                }),
            );

            await expect(BitmapFont.load('bad.btfont')).rejects.toThrow('Invalid font file');
        });

        it('should throw when font JSON is missing the glyphs field', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue({
                        name: 'Test',
                        size: 12,
                        lineHeight: 14,
                        baseline: 10,
                        texture: 'data:image/png;base64,aGVsbG8=',
                    }),
                }),
            );

            await expect(BitmapFont.load('bad.btfont')).rejects.toThrow('Invalid font file');
        });

        it('should throw when the font texture image fails to load', async () => {
            vi.stubGlobal(
                'Image',
                class {
                    onload: (() => void) | null = null;
                    onerror: (() => void) | null = null;
                    private _src = '';

                    get src(): string {
                        return this._src;
                    }

                    set src(value: string) {
                        this._src = value;
                        this.onerror?.(); // fire error instead of load
                    }
                },
            );
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue(MOCK_FONT_DATA),
                }),
            );

            await expect(BitmapFont.load('test.btfont')).rejects.toThrow('Failed to load font texture');
        });

        it('should resolve a relative texture path relative to the font URL', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue({ ...MOCK_FONT_DATA, texture: 'font-atlas.png' }),
                }),
            );

            const loaded = await BitmapFont.load('fonts/test.btfont');

            expect(loaded).toBeDefined();
        });
    });

    // #endregion

    // #region Default metadata fallbacks

    describe('default metadata fallbacks', () => {
        it('should use defaults when name, size, lineHeight, baseline are missing', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue({
                        texture: 'data:image/png;base64,aGVsbG8=',
                        glyphs: { A: { x: 0, y: 0, w: 8, h: 12, ox: 0, oy: 0, adv: 9 } },
                    }),
                }),
            );

            const f = await BitmapFont.load('minimal.btfont');

            expect(f.name).toBe('Unknown');
            expect(f.size).toBe(12);
            expect(f.lineHeight).toBe(12);
            expect(f.baseline).toBe(12);
        });

        it('should use size as a fallback for lineHeight and baseline', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: vi.fn().mockResolvedValue({
                        name: 'CustomFont',
                        size: 16,
                        texture: 'data:image/png;base64,aGVsbG8=',
                        glyphs: { A: { x: 0, y: 0, w: 8, h: 16, ox: 0, oy: 0, adv: 9 } },
                    }),
                }),
            );

            const f = await BitmapFont.load('partial.btfont');

            expect(f.name).toBe('CustomFont');
            expect(f.size).toBe(16);
            expect(f.lineHeight).toBe(16); // Falls back to size
            expect(f.baseline).toBe(16); // Falls back to size
        });
    });

    // #endregion

    // #region Edge cases

    describe('edge cases', () => {
        it('should return 0 for measureText with empty string', () => {
            expect(font.measureText('')).toBe(0);
        });

        it('should measure mixed ASCII and Unicode text', () => {
            // A(9) + e-acute(7) + B(8) = 24
            const width = font.measureText('A\u00e9B');

            expect(width).toBe(24);
        });

        it('should return a reusable object from measureTextSize', () => {
            const size1 = font.measureTextSize('A');
            const size2 = font.measureTextSize('AB');

            // Same reference (reused object)
            expect(size1).toBe(size2);

            // But values reflect the latest measurement
            expect(size2.width).toBe(17);
        });
    });

    // #endregion
});

// #endregion
