import { describe, expect, it } from 'vitest';

import {
    MAX_RENDER_DIMENSION,
    MAX_RENDER_PIXELS,
    type RenderDimensionField,
    RenderDimensionLimitError,
    type RenderDimensionSettings,
    validateRenderDimension,
    validateRenderDimensions,
    validateWebGPUTextureDimension,
} from './RenderLimits';
import { Vector2i } from './Vector2i';

// #region Helpers

function rawSize(x: number, y: number): Vector2i {
    return { x, y } as Vector2i;
}

function makeSettings(field: RenderDimensionField, size: Vector2i): RenderDimensionSettings {
    switch (field) {
        case 'canvasDisplaySize':
            return {
                displaySize: new Vector2i(320, 240),
                canvasDisplaySize: size,
                maxCanvasDisplaySize: new Vector2i(960, 720),
            };
        case 'maxCanvasDisplaySize':
            return {
                displaySize: new Vector2i(320, 240),
                canvasDisplaySize: new Vector2i(640, 480),
                maxCanvasDisplaySize: size,
            };
        case 'displaySize':
            return {
                displaySize: size,
                canvasDisplaySize: new Vector2i(640, 480),
                maxCanvasDisplaySize: new Vector2i(960, 720),
            };
    }
}

// #endregion

describe('RenderLimits', () => {
    describe('validateRenderDimensions', () => {
        const fields: RenderDimensionField[] = ['displaySize', 'canvasDisplaySize', 'maxCanvasDisplaySize'];
        const cases: Array<{ name: string; size: Vector2i }> = [
            { name: 'zero', size: rawSize(0, 240) },
            { name: 'negative', size: rawSize(-1, 240) },
            { name: 'fractional', size: rawSize(320.5, 240) },
            { name: 'NaN', size: rawSize(Number.NaN, 240) },
            { name: 'Infinity', size: rawSize(Number.POSITIVE_INFINITY, 240) },
            { name: 'huge width', size: rawSize(MAX_RENDER_DIMENSION + 1, 240) },
            { name: 'huge height', size: rawSize(320, MAX_RENDER_DIMENSION + 1) },
            { name: 'huge area', size: rawSize(4096, 4097) },
        ];

        for (const field of fields) {
            for (const testCase of cases) {
                it(`rejects ${testCase.name} ${field}`, () => {
                    const error = validateRenderDimensions(makeSettings(field, testCase.size));

                    expect(error).toContain(field);
                });
            }
        }

        it('accepts the default render dimensions', () => {
            expect(
                validateRenderDimensions({
                    displaySize: new Vector2i(320, 240),
                    canvasDisplaySize: new Vector2i(640, 480),
                    maxCanvasDisplaySize: new Vector2i(960, 720),
                }),
            ).toBeNull();
        });

        it('accepts omitted optional canvas dimensions', () => {
            expect(
                validateRenderDimensions({
                    displaySize: new Vector2i(320, 240),
                }),
            ).toBeNull();
        });

        it('rejects total area separately from per-axis limits', () => {
            const error = validateRenderDimensions({
                displaySize: rawSize(4096, 4097),
            });

            expect(error).toContain(MAX_RENDER_PIXELS.toLocaleString('en-US'));
        });

        it('rejects 8192x8192 when per-axis limits pass but total area exceeds cap', () => {
            const error = validateRenderDimensions({
                displaySize: rawSize(MAX_RENDER_DIMENSION, MAX_RENDER_DIMENSION),
            });

            expect(error).toContain('displaySize');
            expect(error).toContain(MAX_RENDER_PIXELS.toLocaleString('en-US'));
        });

        it('accepts dimensions at the per-axis maximum with area within cap', () => {
            expect(
                validateRenderDimensions({
                    displaySize: rawSize(MAX_RENDER_DIMENSION, 2048),
                }),
            ).toBeNull();
        });

        it('accepts dimensions at the total pixel area maximum', () => {
            expect(
                validateRenderDimensions({
                    displaySize: rawSize(4096, 4096),
                }),
            ).toBeNull();
        });

        it('accepts dimensions at the per-axis maximum on a single axis', () => {
            expect(
                validateRenderDimensions({
                    displaySize: rawSize(MAX_RENDER_DIMENSION, 1),
                }),
            ).toBeNull();
        });
    });

    describe('validateRenderDimension', () => {
        it('returns null for a valid size at engine limits', () => {
            expect(validateRenderDimension('displaySize', new Vector2i(4096, 4096))).toBeNull();
        });

        it('returns a field-specific message for invalid sizes', () => {
            const error = validateRenderDimension('canvasDisplaySize', rawSize(0, 480));

            expect(error).toContain('canvasDisplaySize');
        });
    });

    describe('RenderDimensionLimitError', () => {
        it('uses the expected error name', () => {
            const error = new RenderDimensionLimitError('test message');

            expect(error.name).toBe('RenderDimensionLimitError');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(RenderDimensionLimitError);
        });
    });

    describe('validateWebGPUTextureDimension', () => {
        it('rejects dimensions above the provided WebGPU texture limit', () => {
            const error = validateWebGPUTextureDimension('canvasDisplaySize', new Vector2i(2048, 1024), 1024);

            expect(error).toContain('graphics card');
        });

        it('rejects when height alone exceeds the WebGPU texture limit', () => {
            const error = validateWebGPUTextureDimension('displaySize', new Vector2i(512, 2048), 1024);

            expect(error).toContain('displaySize');
            expect(error).toContain('graphics card');
        });

        it('accepts dimensions exactly at the WebGPU texture limit', () => {
            expect(validateWebGPUTextureDimension('displaySize', new Vector2i(1024, 1024), 1024)).toBeNull();
        });

        it('ignores missing WebGPU texture limits', () => {
            expect(validateWebGPUTextureDimension('displaySize', new Vector2i(2048, 1024), undefined)).toBeNull();
        });

        it('ignores non-finite WebGPU texture limits', () => {
            expect(validateWebGPUTextureDimension('displaySize', new Vector2i(2048, 1024), Number.NaN)).toBeNull();
        });

        it('ignores non-positive WebGPU texture limits', () => {
            expect(validateWebGPUTextureDimension('displaySize', new Vector2i(2048, 1024), 0)).toBeNull();
        });
    });
});
