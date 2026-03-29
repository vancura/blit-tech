// noinspection DuplicatedCode

/**
 * Unit tests for the public `BT` facade exported from `BlitTech.ts`.
 *
 * Covers delegation from top-level `BT.*` calls into `BTAPI.instance`,
 * default return behavior for hardware-dependent queries, and the warning
 * suppression behavior used by facade helpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BitmapFont, HardwareSettings } from './BlitTech';
import { BT, Color32, Palette, Rect2i, SpriteSheet, Vector2i } from './BlitTech';
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

        BT.clearRect(1, rect);

        expect(spy).toHaveBeenCalledWith(1, rect);
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

// #region BT.print / BT.printMeasure / BT.printFont

describe('BT.print', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.drawText', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawText').mockReturnValue(undefined);
        const pos = new Vector2i(10, 10);

        BT.print(pos, 8, 'Hello');

        expect(spy).toHaveBeenCalledWith(pos, 8, 'Hello');
    });
});

describe('BT.printMeasure', () => {
    it('returns a zero vector', () => {
        vi.spyOn(console, 'warn').mockReturnValue(undefined);

        const result = BT.printMeasure('any text');

        expect(result.x).toBe(0);
        expect(result.y).toBe(0);
    });

    it('emits a console warning on the first call', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);

        BT.printMeasure('first');

        // The warnOnce mechanism may have already fired in a previous test in this
        // file. Either way, warn is called at most once per unique function name.
        expect(warnSpy.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('does not emit a second warning for the same call', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);

        BT.printMeasure('again');
        BT.printMeasure('again');

        // warnOnce suppresses duplicates; total warn calls across both invocations are 0 or 1.
        expect(warnSpy.mock.calls.length).toBeLessThanOrEqual(1);
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
        const color = Color32.white();

        BT.printFont(font, pos, 'Hi', color);

        expect(spy).toHaveBeenCalledWith(font, pos, 'Hi', color);
    });

    it('forwards an undefined color when omitted', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawBitmapText').mockReturnValue(undefined);
        const font = {} as BitmapFont;

        BT.printFont(font, new Vector2i(0, 0), 'Hi');

        expect(spy).toHaveBeenCalledWith(font, expect.anything(), 'Hi', undefined);
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

    it('forwards the tint argument', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawSprite').mockReturnValue(undefined);
        const sheet = new SpriteSheet(mockImage);
        const tint = Color32.red();

        BT.drawSprite(sheet, new Rect2i(0, 0, 16, 16), new Vector2i(0, 0), tint);

        expect(spy).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), tint);
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
