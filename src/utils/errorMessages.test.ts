import { describe, expect, it } from 'vitest';

import {
    CANVAS_NOT_FOUND_MESSAGE,
    INIT_FAILED_MESSAGE,
    noActivePaletteError,
    paletteIndexNegativeError,
    paletteIndexOutOfRangeError,
    renderDimensionAreaTooLargeError,
    renderDimensionGpuLimitError,
    renderDimensionInvalidError,
    renderDimensionTooLargeError,
    spriteColorNotInPaletteError,
    spriteNotIndexizedError,
    WEBGPU_ADAPTER_MESSAGE,
    WEBGPU_DEVICE_MESSAGE,
} from './errorMessages';

describe('errorMessages', () => {
    describe('CANVAS_NOT_FOUND_MESSAGE', () => {
        it('should interpolate the canvas ID into the message', () => {
            expect(CANVAS_NOT_FOUND_MESSAGE('blit-tech-canvas')).toContain('blit-tech-canvas');
        });

        it('should produce different messages for different canvas IDs', () => {
            expect(CANVAS_NOT_FOUND_MESSAGE('canvas-a')).not.toBe(CANVAS_NOT_FOUND_MESSAGE('canvas-b'));
        });

        it('should mention canvas element syntax', () => {
            expect(CANVAS_NOT_FOUND_MESSAGE('my-canvas')).toContain('<canvas');
        });
    });

    describe('INIT_FAILED_MESSAGE', () => {
        it('should be a non-empty string', () => {
            expect(typeof INIT_FAILED_MESSAGE).toBe('string');
            expect(INIT_FAILED_MESSAGE.length).toBeGreaterThan(0);
        });

        it('should mention F12 for console access', () => {
            expect(INIT_FAILED_MESSAGE).toContain('F12');
        });
    });

    describe('WEBGPU_ADAPTER_MESSAGE', () => {
        it('should be a non-empty string', () => {
            expect(typeof WEBGPU_ADAPTER_MESSAGE).toBe('string');
            expect(WEBGPU_ADAPTER_MESSAGE.length).toBeGreaterThan(0);
        });

        it('should mention hardware acceleration', () => {
            expect(WEBGPU_ADAPTER_MESSAGE).toContain('hardware acceleration');
        });
    });

    describe('WEBGPU_DEVICE_MESSAGE', () => {
        it('should be a non-empty string', () => {
            expect(typeof WEBGPU_DEVICE_MESSAGE).toBe('string');
            expect(WEBGPU_DEVICE_MESSAGE.length).toBeGreaterThan(0);
        });

        it('should suggest closing other tabs or restarting', () => {
            expect(WEBGPU_DEVICE_MESSAGE).toContain('closing other tabs');
        });
    });

    describe('renderDimensionInvalidError', () => {
        it('includes the field name and invalid size', () => {
            const message = renderDimensionInvalidError('displaySize', '0x240');

            expect(message).toContain('displaySize');
            expect(message).toContain('0x240');
        });

        it('directs the author to update configure()', () => {
            expect(renderDimensionInvalidError('canvasDisplaySize', '320.5x240')).toContain('configure()');
        });
    });

    describe('renderDimensionTooLargeError', () => {
        it('includes the field name, size, and axis limits', () => {
            const message = renderDimensionTooLargeError('maxCanvasDisplaySize', '9000x720', 8192, 8192);

            expect(message).toContain('maxCanvasDisplaySize');
            expect(message).toContain('9000x720');
            expect(message).toContain('8192x8192');
        });

        it('directs the author to use a smaller configure() size', () => {
            expect(renderDimensionTooLargeError('displaySize', '9000x240', 8192, 8192)).toContain('configure()');
        });
    });

    describe('renderDimensionAreaTooLargeError', () => {
        it('includes the field name, size, and formatted pixel cap', () => {
            const message = renderDimensionAreaTooLargeError('displaySize', '4096x4097', 16_777_216);

            expect(message).toContain('displaySize');
            expect(message).toContain('4096x4097');
            expect(message).toContain('16,777,216');
        });
    });

    describe('renderDimensionGpuLimitError', () => {
        it('includes the field name, size, and graphics-card limit', () => {
            const message = renderDimensionGpuLimitError('canvasDisplaySize', '2048x1024', 1024);

            expect(message).toContain('canvasDisplaySize');
            expect(message).toContain('2048x1024');
            expect(message).toContain('graphics card');
            expect(message).toContain('1024');
        });
    });
});

describe('runtime error message helpers', () => {
    describe('noActivePaletteError', () => {
        it('returns a non-empty string', () => {
            expect(noActivePaletteError().length).toBeGreaterThan(0);
        });

        it('mentions BT.paletteSet', () => {
            expect(noActivePaletteError()).toContain('BT.paletteSet');
        });

        it('is consistent across calls', () => {
            expect(noActivePaletteError()).toBe(noActivePaletteError());
        });
    });

    describe('paletteIndexNegativeError', () => {
        it('includes the supplied index', () => {
            expect(paletteIndexNegativeError(-3)).toContain('-3');
        });

        it('mentions 0 or higher', () => {
            expect(paletteIndexNegativeError(-3)).toContain('0 or higher');
        });

        it('produces different messages for different indices', () => {
            expect(paletteIndexNegativeError(-1)).not.toBe(paletteIndexNegativeError(-5));
        });
    });

    describe('paletteIndexOutOfRangeError', () => {
        it('includes the supplied index', () => {
            expect(paletteIndexOutOfRangeError(999, 256)).toContain('999');
        });

        it('includes the palette size', () => {
            expect(paletteIndexOutOfRangeError(999, 256)).toContain('256');
        });

        it('states the valid upper bound', () => {
            expect(paletteIndexOutOfRangeError(999, 256)).toContain('255');
        });

        it('produces different messages for different sizes', () => {
            expect(paletteIndexOutOfRangeError(20, 16)).not.toBe(paletteIndexOutOfRangeError(20, 32));
        });
    });

    describe('spriteColorNotInPaletteError', () => {
        it('includes the pixel coordinates', () => {
            const msg = spriteColorNotInPaletteError(10, 5, "'sheet.png'", '#ff0000');
            expect(msg).toContain('(10, 5)');
        });

        it('includes the source image name', () => {
            const msg = spriteColorNotInPaletteError(10, 5, "'sheet.png'", '#ff0000');
            expect(msg).toContain("'sheet.png'");
        });

        it('includes the hex color', () => {
            const msg = spriteColorNotInPaletteError(10, 5, "'sheet.png'", '#ff0000');
            expect(msg).toContain('#ff0000');
        });

        it('suggests adding the color or editing the image', () => {
            const msg = spriteColorNotInPaletteError(10, 5, "'sheet.png'", '#ff0000');
            expect(msg).toContain('add');
        });
    });

    describe('spriteNotIndexizedError', () => {
        it('returns a non-empty string', () => {
            expect(spriteNotIndexizedError().length).toBeGreaterThan(0);
        });

        it('mentions SpriteSheet.loadIndexed', () => {
            expect(spriteNotIndexizedError()).toContain('SpriteSheet.loadIndexed');
        });

        it('mentions indexize as the manual path', () => {
            expect(spriteNotIndexizedError()).toContain('indexize');
        });

        it('is consistent across calls', () => {
            expect(spriteNotIndexizedError()).toBe(spriteNotIndexizedError());
        });
    });
});
