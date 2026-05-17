import { describe, expect, it } from 'vitest';

import {
    ASSET_DIMENSION_LIMITS,
    clipSpriteSourceRect,
    computeSafePixelArea,
    MAX_ASSET_DIMENSION,
    MAX_ASSET_PIXELS,
    MAX_BTFONT_JSON_BYTES,
    MAX_GLYPH_COUNT,
    validateAssetDimensions,
    validateBtfontGlyphData,
    validateBtfontJsonByteSize,
    validateGlyphCount,
    validateIndexedPixelInput,
} from './AssetLimits';
import { Rect2i } from './Rect2i';

describe('AssetLimits', () => {
    describe('validateAssetDimensions', () => {
        const cases: Array<{ name: string; width: number; height: number }> = [
            { name: 'zero width', width: 0, height: 16 },
            { name: 'negative height', width: 16, height: -1 },
            { name: 'fractional width', width: 16.5, height: 16 },
            { name: 'NaN height', width: 16, height: Number.NaN },
            { name: 'huge width', width: MAX_ASSET_DIMENSION + 1, height: 16 },
            { name: 'huge height', width: 16, height: MAX_ASSET_DIMENSION + 1 },
            { name: 'huge area', width: 4096, height: 4097 },
        ];

        for (const testCase of cases) {
            it(`rejects ${testCase.name}`, () => {
                expect(validateAssetDimensions('sprite sheet', testCase.width, testCase.height)).not.toBeNull();
            });
        }

        it('accepts valid dimensions', () => {
            expect(validateAssetDimensions('sprite sheet', 256, 256)).toBeNull();
        });

        it('rejects total area separately from per-axis limits', () => {
            const error = validateAssetDimensions('sprite sheet', 4096, 4097);

            expect(error).toContain(MAX_ASSET_PIXELS.toLocaleString('en-US'));
        });
    });

    describe('validateIndexedPixelInput', () => {
        it('rejects length mismatch before allocation', () => {
            const error = validateIndexedPixelInput(4, 4, 10);

            expect(error).toContain('10 values');
            expect(error).toContain('16');
        });

        it('rejects overflowed width*height products', () => {
            const error = validateIndexedPixelInput(MAX_ASSET_DIMENSION, MAX_ASSET_DIMENSION);

            expect(error).toContain('too many pixels');
        });
    });

    describe('computeSafePixelArea', () => {
        it('returns null for invalid dimensions', () => {
            expect(computeSafePixelArea(0, 16)).toBeNull();
            expect(computeSafePixelArea(16, Number.POSITIVE_INFINITY)).toBeNull();
        });

        it('returns the pixel count for valid dimensions', () => {
            expect(computeSafePixelArea(16, 16)).toBe(256);
        });
    });

    describe('validateBtfontJsonByteSize', () => {
        it('rejects oversized JSON payloads', () => {
            const error = validateBtfontJsonByteSize(MAX_BTFONT_JSON_BYTES + 1);

            expect(error).toContain(MAX_BTFONT_JSON_BYTES.toLocaleString('en-US'));
        });
    });

    describe('validateGlyphCount', () => {
        it('rejects oversized glyph maps', () => {
            const error = validateGlyphCount(MAX_GLYPH_COUNT + 1);

            expect(error).toContain(MAX_GLYPH_COUNT.toLocaleString('en-US'));
        });
    });

    describe('validateBtfontGlyphData', () => {
        it('rejects glyph rectangles outside the atlas', () => {
            const error = validateBtfontGlyphData({ x: 60, y: 0, w: 8, h: 12, ox: 0, oy: 0, adv: 8 }, 64, 16, 'A');

            expect(error).toContain('outside');
        });

        it('rejects non-integer metrics', () => {
            const error = validateBtfontGlyphData({ x: 0, y: 0, w: 8.5, h: 12, ox: 0, oy: 0, adv: 8 }, 64, 16, 'A');

            expect(error).toContain('whole number');
        });

        it('accepts valid glyph metrics', () => {
            expect(validateBtfontGlyphData({ x: 0, y: 0, w: 8, h: 12, ox: 0, oy: 0, adv: 8 }, 64, 16, 'A')).toBeNull();
        });
    });

    describe('clipSpriteSourceRect', () => {
        it('clips rectangles to the sheet bounds', () => {
            const clipped = clipSpriteSourceRect(new Rect2i(-2, -1, 5, 4), 4, 4);

            expect(clipped).toEqual({ x: 0, y: 0, width: 3, height: 3 });
        });

        it('returns null for oversized blits after clipping', () => {
            const clipped = clipSpriteSourceRect(
                new Rect2i(0, 0, ASSET_DIMENSION_LIMITS.maxWidth, ASSET_DIMENSION_LIMITS.maxHeight),
                ASSET_DIMENSION_LIMITS.maxWidth,
                ASSET_DIMENSION_LIMITS.maxHeight,
            );

            expect(clipped).toBeNull();
        });

        it('returns null for rectangles with non-positive size', () => {
            expect(clipSpriteSourceRect(new Rect2i(0, 0, 0, 2), 4, 4)).toBeNull();
        });
    });
});
