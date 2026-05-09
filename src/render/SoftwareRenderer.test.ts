import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BitmapFont } from '../assets/BitmapFont';
import { Palette } from '../assets/Palette';
import { SpriteSheet } from '../assets/SpriteSheet';
import { Color32 } from '../utils/Color32';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { Effect } from './effects/Effect';
import { SoftwareRenderer } from './SoftwareRenderer';

type MockContext = {
    imageSmoothingEnabled: boolean;
    createImageData: (w: number, h: number) => ImageData;
    putImageData: ReturnType<typeof vi.fn>;
    clearRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    lastImageData: ImageData | null;
};

function makeMockContext(): MockContext {
    const instance: MockContext = {
        imageSmoothingEnabled: false,
        createImageData: (w: number, h: number) =>
            ({
                data: new Uint8ClampedArray(w * h * 4),
                width: w,
                height: h,
            }) as ImageData,
        putImageData: vi.fn((imageData: ImageData) => {
            instance.lastImageData = imageData;
        }),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        lastImageData: null,
    };
    return instance;
}

const context = makeMockContext();
const logicalContext = makeMockContext();

class MockOffscreenCanvas {
    constructor(
        public width: number,
        public height: number,
    ) {}
    getContext(): MockContext {
        return logicalContext;
    }
}

function getPixel(imageData: ImageData, width: number, x: number, y: number): [number, number, number, number] {
    const index = (y * width + x) * 4;
    /* eslint-disable security/detect-object-injection */
    return [
        imageData.data[index] ?? 0,
        imageData.data[index + 1] ?? 0,
        imageData.data[index + 2] ?? 0,
        imageData.data[index + 3] ?? 0,
    ];
    /* eslint-enable security/detect-object-injection */
}

function makePalette(): Palette {
    const palette = new Palette(16);
    palette.set(1, new Color32(255, 0, 0, 255));
    palette.set(2, new Color32(0, 0, 255, 255));
    palette.set(3, new Color32(0, 255, 0, 255));
    return palette;
}

describe('SoftwareRenderer', () => {
    beforeEach(() => {
        context.lastImageData = null;
        logicalContext.lastImageData = null;
        vi.stubGlobal(
            'ImageData',
            class MockImageData {
                constructor(
                    public width: number,
                    public height: number,
                    public data: Uint8ClampedArray = new Uint8ClampedArray(width * height * 4),
                ) {}
            },
        );
        vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requires palette before beginFrame', async () => {
        const canvas = {
            width: 0,
            height: 0,
            style: { width: '', height: '' },
            getContext: () => context,
            toBlob: (_cb: (blob: Blob | null) => void) => {},
        } as unknown as HTMLCanvasElement;
        const renderer = new SoftwareRenderer(canvas, new Vector2i(4, 4));
        await renderer.init();

        expect(() => renderer.beginFrame()).toThrow('No palette set yet. Call BT.paletteSet');
    });

    it('renders primitives with camera offset applied', async () => {
        const canvas = {
            width: 0,
            height: 0,
            style: { width: '', height: '' },
            getContext: () => context,
            toBlob: (_cb: (blob: Blob | null) => void) => {},
        } as unknown as HTMLCanvasElement;
        const renderer = new SoftwareRenderer(canvas, new Vector2i(4, 4));
        await renderer.init();
        renderer.setPalette(makePalette());

        renderer.beginFrame();
        renderer.setCameraOffset(new Vector2i(1, 1));
        renderer.drawPixel(new Vector2i(2, 2), 1);
        renderer.endFrame();

        const frame = logicalContext.lastImageData;
        expect(frame).not.toBeNull();
        expect(getPixel(frame as ImageData, 4, 1, 1)).toEqual([255, 0, 0, 255]);
    });

    it('renders indexed sprites with transparent index and palette offsets', async () => {
        const canvas = {
            width: 0,
            height: 0,
            style: { width: '', height: '' },
            getContext: () => context,
            toBlob: (_cb: (blob: Blob | null) => void) => {},
        } as unknown as HTMLCanvasElement;
        const renderer = new SoftwareRenderer(canvas, new Vector2i(4, 4));
        await renderer.init();

        const palette = makePalette();
        palette.set(4, new Color32(255, 255, 0, 255));
        renderer.setPalette(palette);
        renderer.setClearColor(4);

        const sheet = SpriteSheet.fromIndexedPixels(2, 1, new Uint8Array([1, 0]));
        renderer.beginFrame();
        renderer.drawSprite(sheet, new Rect2i(0, 0, 2, 1), new Vector2i(0, 0), 1);
        renderer.endFrame();

        const frame = logicalContext.lastImageData;
        expect(frame).not.toBeNull();
        expect(getPixel(frame as ImageData, 4, 0, 0)).toEqual([0, 0, 255, 255]);
        expect(getPixel(frame as ImageData, 4, 1, 0)).toEqual([255, 255, 0, 255]);
    });

    it('renders bitmap text through sprite-backed glyphs', async () => {
        const canvas = {
            width: 0,
            height: 0,
            style: { width: '', height: '' },
            getContext: () => context,
            toBlob: (_cb: (blob: Blob | null) => void) => {},
        } as unknown as HTMLCanvasElement;
        const renderer = new SoftwareRenderer(canvas, new Vector2i(4, 4));
        await renderer.init();
        renderer.setPalette(makePalette());

        const sheet = SpriteSheet.fromIndexedPixels(1, 1, new Uint8Array([1]));
        const glyphs = new Map([
            [
                'A',
                {
                    rect: new Rect2i(0, 0, 1, 1),
                    offsetX: 0,
                    offsetY: 0,
                    advance: 1,
                },
            ],
        ]);
        const font = BitmapFont.createFromGlyphs(sheet, glyphs, 'test', 8, 1, 1);

        renderer.beginFrame();
        renderer.drawBitmapText(font, new Vector2i(0, 0), 'A', 0);
        renderer.endFrame();

        const frame = logicalContext.lastImageData;
        expect(frame).not.toBeNull();
        expect(getPixel(frame as ImageData, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('throws clear unsupported errors for fullscreen effects', async () => {
        const canvas = {
            width: 0,
            height: 0,
            style: { width: '', height: '' },
            getContext: () => context,
            toBlob: (_cb: (blob: Blob | null) => void) => {},
        } as unknown as HTMLCanvasElement;
        const renderer = new SoftwareRenderer(canvas, new Vector2i(4, 4));
        await renderer.init();

        const effect: Effect = { tier: 'pixel', init: vi.fn(), updateUniforms: vi.fn(), encodePass: vi.fn() };

        expect(() => renderer.addEffect(effect)).toThrow("doesn't support fullscreen effects");
        expect(() => renderer.removeEffect(effect)).toThrow("doesn't support fullscreen effects");
        expect(() => renderer.clearEffects()).toThrow("doesn't support fullscreen effects");
    });

    it('resolves captureFrame on next endFrame', async () => {
        const toBlob = vi.fn((callback: (blob: Blob | null) => void) =>
            callback(new Blob(['png'], { type: 'image/png' })),
        );
        const canvas = {
            width: 0,
            height: 0,
            style: { width: '', height: '' },
            getContext: () => context,
            toBlob,
        } as unknown as HTMLCanvasElement;
        const renderer = new SoftwareRenderer(canvas, new Vector2i(4, 4));
        await renderer.init();
        renderer.setPalette(makePalette());

        const capture = renderer.captureFrame();
        renderer.beginFrame();
        renderer.endFrame();

        const blob = await capture;
        expect(blob.type).toBe('image/png');
        expect(toBlob).toHaveBeenCalledOnce();
    });
});
