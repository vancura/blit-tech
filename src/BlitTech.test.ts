// noinspection DuplicatedCode
// @vitest-environment happy-dom

/**
 * Unit tests for the public `BT` facade exported from `BlitTech.ts`.
 *
 * Covers delegation from top-level `BT.*` calls into `BTAPI.instance`,
 * default return behavior for hardware-dependent queries, and the warning
 * suppression behavior used by facade helpers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BitmapFont, HardwareSettings } from './BlitTech';
import { BT, Palette, Rect2i, SpriteSheet, Vector2i } from './BlitTech';
import { BTAPI } from './core/BTAPI';

// #region Helpers

const mockHardwareSettings = (displaySize = new Vector2i(320, 240), targetFPS = 60): HardwareSettings => ({
    displaySize,
    targetFPS,
});

// #endregion

// #region BT.initialize

describe('BT.initialize', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.initialize and returns its result', async () => {
        const spy = vi.spyOn(BTAPI.instance, 'initialize').mockResolvedValue(true);
        const demo = {
            queryHardware: vi.fn(),
            initialize: vi.fn(),
            update: vi.fn(),
            render: vi.fn(),
        };
        const canvas = {} as HTMLCanvasElement;

        const result = await BT.initialize(demo, canvas);

        expect(spy).toHaveBeenCalledWith(demo, canvas);
        expect(result).toBe(true);
    });

    it('forwards a failure result from BTAPI', async () => {
        vi.spyOn(BTAPI.instance, 'initialize').mockResolvedValue(false);

        const demo = {
            queryHardware: vi.fn(),
            initialize: vi.fn(),
            update: vi.fn(),
            render: vi.fn(),
        };

        const result = await BT.initialize(demo, {} as HTMLCanvasElement);

        expect(result).toBe(false);
    });
});

// #endregion

// #region BT.displaySize

describe('BT.displaySize', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns zero vector when hardware settings are not available', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(null);

        const size = BT.displaySize();

        expect(size.x).toBe(0);
        expect(size.y).toBe(0);
    });

    it('returns a clone of displaySize from hardware settings', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(mockHardwareSettings(new Vector2i(640, 480)));

        const size = BT.displaySize();

        expect(size.x).toBe(640);
        expect(size.y).toBe(480);
    });
});

// #endregion

// #region BT.fps

describe('BT.fps', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 60 when hardware settings are not available', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(null);

        expect(BT.fps()).toBe(60);
    });

    it('returns targetFPS from hardware settings', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), 30),
        );

        expect(BT.fps()).toBe(30);
    });
});

// #endregion

// #region BT.ticks / BT.ticksReset

describe('BT.ticks', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.getTicks', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(42);

        expect(BT.ticks()).toBe(42);
    });
});

describe('BT.ticksReset', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.resetTicks', () => {
        const spy = vi.spyOn(BTAPI.instance, 'resetTicks').mockReturnValue(undefined);

        BT.ticksReset();

        expect(spy).toHaveBeenCalledOnce();
    });
});

// #endregion

// #region BT.paletteCreate / BT.paletteSet / BT.paletteGet

describe('BT.paletteCreate', () => {
    it('creates a palette with the requested size', () => {
        const palette = BT.paletteCreate(16);

        expect(palette).toBeInstanceOf(Palette);
        expect(palette.size).toBe(16);
    });
});

describe('BT.paletteSet', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.setPalette', () => {
        const spy = vi.spyOn(BTAPI.instance, 'setPalette').mockReturnValue(undefined);
        const palette = new Palette(16);

        BT.paletteSet(palette);

        expect(spy).toHaveBeenCalledWith(palette);
    });
});

describe('BT.paletteGet', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns palette when one is set', () => {
        const palette = new Palette(16);

        vi.spyOn(BTAPI.instance, 'getPalette').mockReturnValue(palette);

        expect(BT.paletteGet()).toBe(palette);
    });

    it('throws when no palette is set', () => {
        vi.spyOn(BTAPI.instance, 'getPalette').mockReturnValue(null);

        expect(() => BT.paletteGet()).toThrow('No active palette. Call BT.paletteSet() first.');
    });
});

// #endregion

// #region BT.clear / BT.clearRect

describe('BT.clear', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.setClearColor', () => {
        const spy = vi.spyOn(BTAPI.instance, 'setClearColor').mockReturnValue(undefined);

        BT.clear(1);

        expect(spy).toHaveBeenCalledWith(1);
    });
});

describe('BT.clearRect', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.clearRect', () => {
        const spy = vi.spyOn(BTAPI.instance, 'clearRect').mockReturnValue(undefined);
        const rect = new Rect2i(0, 0, 100, 100);

        BT.clearRect(rect, 1);

        expect(spy).toHaveBeenCalledWith(rect, 1);
    });
});

// #endregion

// #region BT.drawPixel / BT.drawLine / BT.drawRect / BT.drawRectFill

describe('BT.drawPixel', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawPixel', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawPixel').mockReturnValue(undefined);
        const pos = new Vector2i(5, 10);

        BT.drawPixel(pos, 2);

        expect(spy).toHaveBeenCalledWith(pos, 2);
    });
});

describe('BT.drawLine', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawLine', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawLine').mockReturnValue(undefined);
        const p0 = new Vector2i(0, 0);
        const p1 = new Vector2i(50, 50);

        BT.drawLine(p0, p1, 3);

        expect(spy).toHaveBeenCalledWith(p0, p1, 3);
    });
});

describe('BT.drawRect', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawRect', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawRect').mockReturnValue(undefined);
        const rect = new Rect2i(10, 10, 40, 30);

        BT.drawRect(rect, 4);

        expect(spy).toHaveBeenCalledWith(rect, 4);
    });
});

describe('BT.drawRectFill', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawRectFill', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawRectFill').mockReturnValue(undefined);
        const rect = new Rect2i(0, 0, 20, 20);

        BT.drawRectFill(rect, 8);

        expect(spy).toHaveBeenCalledWith(rect, 8);
    });
});

// #endregion

// #region BT.cameraSet / BT.cameraGet / BT.cameraReset

describe('BT.cameraSet', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.setCameraOffset', () => {
        const spy = vi.spyOn(BTAPI.instance, 'setCameraOffset').mockReturnValue(undefined);
        const offset = new Vector2i(100, 50);

        BT.cameraSet(offset);

        expect(spy).toHaveBeenCalledWith(offset);
    });
});

describe('BT.cameraGet', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.getCameraOffset and returns its result', () => {
        const expected = new Vector2i(64, 32);
        vi.spyOn(BTAPI.instance, 'getCameraOffset').mockReturnValue(expected);

        const result = BT.cameraGet();

        expect(result).toBe(expected);
    });
});

describe('BT.cameraReset', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.resetCamera', () => {
        const spy = vi.spyOn(BTAPI.instance, 'resetCamera').mockReturnValue(undefined);

        BT.cameraReset();

        expect(spy).toHaveBeenCalledOnce();
    });
});

// #endregion

// #region BT.buttonDown / BT.buttonPressed / BT.buttonReleased

describe('BT.buttonDown', () => {
    it('returns false (not yet implemented)', () => {
        expect(BT.buttonDown(BT.BTN_A)).toBe(false);
    });

    it('accepts an optional player index without throwing', () => {
        expect(BT.buttonDown(BT.BTN_START, 2)).toBe(false);
    });
});

describe('BT.buttonPressed', () => {
    it('returns false (not yet implemented)', () => {
        expect(BT.buttonPressed(BT.BTN_B)).toBe(false);
    });

    it('accepts an optional player index without throwing', () => {
        expect(BT.buttonPressed(BT.BTN_B, 1)).toBe(false);
    });
});

describe('BT.buttonReleased', () => {
    it('returns false (not yet implemented)', () => {
        expect(BT.buttonReleased(BT.BTN_X)).toBe(false);
    });

    it('accepts an optional player index without throwing', () => {
        expect(BT.buttonReleased(BT.BTN_X, 3)).toBe(false);
    });
});

// #endregion

// #region BT.keyDown / BT.keyPressed / BT.keyReleased

describe('BT.keyDown', () => {
    it('returns false (not yet implemented)', () => {
        expect(BT.keyDown('Space')).toBe(false);
    });
});

describe('BT.keyPressed', () => {
    it('returns false (not yet implemented)', () => {
        expect(BT.keyPressed('ArrowUp')).toBe(false);
    });
});

describe('BT.keyReleased', () => {
    it('returns false (not yet implemented)', () => {
        expect(BT.keyReleased('KeyA')).toBe(false);
    });
});

// #endregion

// #region BT.systemPrint / BT.systemPrintMeasure / BT.printFont

describe('BT.systemPrint', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawSystemText', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawSystemText').mockReturnValue(undefined);
        const pos = new Vector2i(10, 10);

        BT.systemPrint(pos, 8, 'Hello');

        expect(spy).toHaveBeenCalledWith(pos, 8, 'Hello');
    });
});

describe('BT.systemPrintMeasure', () => {
    it('returns zero vector when system font is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getSystemFont').mockReturnValue(null);

        const result = BT.systemPrintMeasure('any text');

        expect(result.x).toBe(0);
        expect(result.y).toBe(0);
    });

    it('returns measured size when system font is available', () => {
        const mockFont = {
            measureTextSize: vi.fn().mockReturnValue({ width: 40, height: 8 }),
        };

        vi.spyOn(BTAPI.instance, 'getSystemFont').mockReturnValue(mockFont as unknown as BitmapFont);

        const result = BT.systemPrintMeasure('Hello');

        expect(result.x).toBe(40);
        expect(result.y).toBe(8);
        expect(mockFont.measureTextSize).toHaveBeenCalledWith('Hello');
    });
});

describe('BT.printFont', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawBitmapText', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawBitmapText').mockReturnValue(undefined);
        const font = {} as BitmapFont;
        const pos = new Vector2i(0, 0);
        const paletteOffset = 4;

        BT.printFont(font, pos, 'Hi', paletteOffset);

        expect(spy).toHaveBeenCalledWith(font, pos, 'Hi', paletteOffset);
    });

    it('forwards an undefined paletteOffset when omitted', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawBitmapText').mockReturnValue(undefined);
        const font = {} as BitmapFont;

        BT.printFont(font, new Vector2i(0, 0), 'Hi');

        expect(spy).toHaveBeenCalledWith(font, expect.anything(), 'Hi', undefined);
    });
});

// #endregion

// #region BT.captureFrame / BT.downloadFrame

describe('BT.captureFrame', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.captureFrame and returns its result', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });
        const spy = vi.spyOn(BTAPI.instance, 'captureFrame').mockResolvedValue(mockBlob);

        const result = await BT.captureFrame();

        expect(spy).toHaveBeenCalledOnce();
        expect(result).toBe(mockBlob);
    });
});

describe('BT.downloadFrame', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('calls captureFrame, creates object URL, clicks anchor, and revokes URL', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });

        vi.spyOn(BTAPI.instance, 'captureFrame').mockResolvedValue(mockBlob);

        const mockUrl = 'blob:mock-url';
        const createObjectURL = vi.fn().mockReturnValue(mockUrl);
        const revokeObjectURL = vi.fn();

        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

        const mockAnchor = { href: '', download: '', click: vi.fn() };

        vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);

        await BT.downloadFrame('screenshot.png');

        expect(createObjectURL).toHaveBeenCalledWith(mockBlob);
        expect(mockAnchor.href).toBe(mockUrl);
        expect(mockAnchor.download).toBe('screenshot.png');
        expect(mockAnchor.click).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });

    it('uses the default filename when none is provided', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });

        vi.spyOn(BTAPI.instance, 'captureFrame').mockResolvedValue(mockBlob);
        vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:x'), revokeObjectURL: vi.fn() });

        const mockAnchor = { href: '', download: '', click: vi.fn() };

        vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);

        await BT.downloadFrame();

        expect(mockAnchor.download).toBe('blit-tech-capture.png');
    });
});

// #endregion

// #region BT.drawSprite

describe('BT.drawSprite', () => {
    const mockImage = { width: 64, height: 64 } as HTMLImageElement;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawSprite', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawSprite').mockReturnValue(undefined);
        const sheet = new SpriteSheet(mockImage);
        const srcRect = new Rect2i(0, 0, 16, 16);
        const destPos = new Vector2i(10, 20);

        BT.drawSprite(sheet, srcRect, destPos);

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(sheet, srcRect, destPos, undefined);
    });

    it('forwards the paletteOffset argument', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawSprite').mockReturnValue(undefined);
        const sheet = new SpriteSheet(mockImage);
        const paletteOffset = 16;

        BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0), paletteOffset);

        expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), paletteOffset);
    });

    it('forwards undefined tint when omitted', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawSprite').mockReturnValue(undefined);
        const sheet = new SpriteSheet(mockImage);

        BT.drawSprite(sheet, new Rect2i(0, 0, 8, 8), new Vector2i(0, 0));

        expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), undefined);
    });

    it('does not throw when called multiple times', () => {
        vi.spyOn(BTAPI.instance, 'drawSprite').mockReturnValue(undefined);

        const sheet = new SpriteSheet(mockImage);

        expect(() => {
            BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0));
            BT.drawSprite(sheet, new Rect2i(16, 0, 16, 16), new Vector2i(20, 0));
        }).not.toThrow();
    });
});

// #endregion
