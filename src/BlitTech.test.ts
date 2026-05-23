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
import type { FaceButtonCode } from './input/defaultKeyboardMap';
import { DEFAULT_CONTAINER_ID } from './utils/BootstrapHelpers';

// #region Helpers

const mockHardwareSettings = (displaySize = new Vector2i(320, 240), targetFPS = 60): HardwareSettings => ({
    displaySize,
    targetFPS,
});

function setupErrorContainer(): HTMLDivElement {
    const existingContainer = document.getElementById(DEFAULT_CONTAINER_ID);

    if (existingContainer instanceof HTMLDivElement) {
        existingContainer.textContent = '';
        return existingContainer;
    }

    const container = document.createElement('div');
    container.id = DEFAULT_CONTAINER_ID;
    document.body.appendChild(container);
    return container;
}

function clearErrorContainer(): void {
    const container = document.getElementById(DEFAULT_CONTAINER_ID);
    if (container?.parentElement) {
        container.parentElement.removeChild(container);
    }
}

async function withErrorContainer(callback: () => void | Promise<void>): Promise<void> {
    setupErrorContainer();
    try {
        await callback();
    } finally {
        clearErrorContainer();
    }
}

// #endregion

// #region BT.init

describe('BT.init', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.init and returns its result', async () => {
        const spy = vi.spyOn(BTAPI.instance, 'init').mockResolvedValue(true);
        const demo = {
            configure: vi.fn(),
            init: vi.fn(),
            update: vi.fn(),
            render: vi.fn(),
        };
        const canvas = {} as HTMLCanvasElement;

        const result = await BT.init(demo, canvas);

        expect(spy).toHaveBeenCalledWith(demo, canvas);
        expect(result).toBe(true);
    });

    it('forwards a failure result from BTAPI', async () => {
        vi.spyOn(BTAPI.instance, 'init').mockResolvedValue(false);

        const demo = {
            configure: vi.fn(),
            init: vi.fn(),
            update: vi.fn(),
            render: vi.fn(),
        };

        const result = await BT.init(demo, {} as HTMLCanvasElement);

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

        const size = BT.displaySize;

        expect(size.x).toBe(0);
        expect(size.y).toBe(0);
    });

    it('returns a clone of displaySize from hardware settings', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(mockHardwareSettings(new Vector2i(640, 480)));

        const size = BT.displaySize;

        expect(size.x).toBe(640);
        expect(size.y).toBe(480);
    });
});

// #endregion

// #region BT.canvasDisplaySize / BT.outputSize

describe('BT.canvasDisplaySize', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null when hardware settings are not available', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(null);

        expect(BT.canvasDisplaySize).toBeNull();
    });

    it('returns null when canvasDisplaySize was not configured', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(mockHardwareSettings());

        expect(BT.canvasDisplaySize).toBeNull();
    });

    it('returns a clone when canvasDisplaySize is configured', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue({
            ...mockHardwareSettings(),
            canvasDisplaySize: new Vector2i(640, 480),
        });

        const size = BT.canvasDisplaySize;

        expect(size?.x).toBe(640);
        expect(size?.y).toBe(480);
    });

    it('returns an independent clone per read', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue({
            ...mockHardwareSettings(),
            canvasDisplaySize: new Vector2i(640, 480),
        });

        const first = BT.canvasDisplaySize;
        first!.x = 999;

        expect(BT.canvasDisplaySize?.x).toBe(640);
    });
});

describe('BT.outputSize', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns zero vector when hardware settings are not available', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(null);

        const size = BT.outputSize;

        expect(size.x).toBe(0);
        expect(size.y).toBe(0);
    });

    it('matches displaySize when canvasDisplaySize is omitted', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(mockHardwareSettings(new Vector2i(320, 240)));

        const size = BT.outputSize;

        expect(size.x).toBe(320);
        expect(size.y).toBe(240);
    });

    it('returns canvasDisplaySize when configured', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue({
            ...mockHardwareSettings(new Vector2i(320, 240)),
            canvasDisplaySize: new Vector2i(640, 480),
        });

        const size = BT.outputSize;

        expect(size.x).toBe(640);
        expect(size.y).toBe(480);
    });

    it('returns an independent clone per read', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(mockHardwareSettings(new Vector2i(320, 240)));

        const first = BT.outputSize;
        first.x = 999;

        expect(BT.outputSize.x).toBe(320);
    });
});

// #endregion

// #region BT.targetFPS

describe('BT.targetFPS', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 60 when hardware settings are not available', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(null);

        expect(BT.targetFPS).toBe(60);
    });

    it('returns targetFPS from hardware settings', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), 30),
        );

        expect(BT.targetFPS).toBe(30);
    });
});

// #endregion

// #region BT.deltaSeconds / BT.timeSeconds

describe('BT.deltaSeconds', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1/60 when hardware settings are not available', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(null);

        expect(BT.deltaSeconds).toBeCloseTo(1 / 60);
    });

    it('returns reciprocal of targetFPS from hardware settings', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), 50),
        );

        expect(BT.deltaSeconds).toBeCloseTo(0.02);
    });

    it('falls back to 1/60 when targetFPS is non-positive', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), 0),
        );

        expect(BT.deltaSeconds).toBeCloseTo(1 / 60);
    });

    it('falls back to 1/60 when targetFPS is non-finite', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), Number.NaN),
        );

        expect(BT.deltaSeconds).toBeCloseTo(1 / 60);
    });
});

describe('BT.timeSeconds', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns ticks multiplied by deltaSeconds', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(90);
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), 30),
        );

        expect(BT.timeSeconds).toBeCloseTo(3);
    });

    it('uses fallback delta when targetFPS is non-positive, producing finite time', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(120);
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), 0),
        );

        const time = BT.timeSeconds;
        expect(BT.deltaSeconds).toBeCloseTo(1 / 60);
        expect(Number.isFinite(time)).toBe(true);
        expect(time).toBeCloseTo(2);
    });

    it('uses fallback delta when targetFPS is non-finite, producing finite time', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(120);
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(320, 240), Number.POSITIVE_INFINITY),
        );

        const time = BT.timeSeconds;
        expect(BT.deltaSeconds).toBeCloseTo(1 / 60);
        expect(Number.isFinite(time)).toBe(true);
        expect(time).toBeCloseTo(2);
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

        expect(BT.ticks).toBe(42);
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

// #region BT.paletteCreate / BT.paletteSet / BT.palette

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

    it('shows a beginner-friendly error when passed undefined', async () => {
        await withErrorContainer(async () => {
            BT.paletteSet(undefined as never);

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain('BT.paletteSet expects a Palette');
        });
    });

    it('shows a beginner-friendly error when passed null', async () => {
        await withErrorContainer(async () => {
            BT.paletteSet(null as never);

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain('BT.paletteSet expects a Palette');
        });
    });
});

describe('BT.palette', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns palette when one is set', () => {
        const palette = new Palette(16);

        vi.spyOn(BTAPI.instance, 'getPalette').mockReturnValue(palette);

        expect(BT.palette).toBe(palette);
    });

    it('throws when no palette is set', () => {
        vi.spyOn(BTAPI.instance, 'getPalette').mockReturnValue(null);

        expect(() => BT.palette).toThrow('No palette set yet. Call BT.paletteSet');
    });
});

// #endregion

// #region BT.clear / BT.clearRect

describe('BT.clear', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
    });

    it('delegates to BTAPI.instance.drawPixel', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawPixel').mockReturnValue(undefined);
        const pos = new Vector2i(5, 10);

        BT.drawPixel(pos, 2);

        expect(spy).toHaveBeenCalledWith(pos, 2);
    });

    it('supports (x, y, color) arguments', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawPixel').mockReturnValue(undefined);

        BT.drawPixel(5, 10, 3);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ x: 5, y: 10 }), 3);
    });

    it('shows a beginner-friendly error when drawPixel arguments are invalid', async () => {
        await withErrorContainer(async () => {
            BT.drawPixel({} as never, 2 as never);

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain('drawPixel expects (x, y, paletteIndex) or (Vector2i, paletteIndex).');
        });
    });
});

describe('BT.drawLine', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
    });

    it('delegates to BTAPI.instance.drawRectFill', () => {
        const spy = vi.spyOn(BTAPI.instance, 'drawRectFill').mockReturnValue(undefined);
        const rect = new Rect2i(0, 0, 20, 20);

        BT.drawRectFill(rect, 8);

        expect(spy).toHaveBeenCalledWith(rect, 8);
    });
});

// #endregion

// #region BT.cameraSet / BT.camera / BT.cameraClamp / BT.cameraReset

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

describe('BT.camera', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.getCameraOffset and returns its result', () => {
        const expected = new Vector2i(64, 32);
        vi.spyOn(BTAPI.instance, 'getCameraOffset').mockReturnValue(expected);

        const result = BT.camera;

        expect(result).toBe(expected);
    });

    it('returns an independent clone per read', () => {
        const stored = new Vector2i(64, 32);
        vi.spyOn(BTAPI.instance, 'getCameraOffset').mockImplementation(() => stored.clone());

        const first = BT.camera;
        first.x = 999;

        expect(BT.camera.x).toBe(64);
    });
});

describe('BT.cameraClamp', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('clamps camera coordinates when viewSize is provided', () => {
        const clamped = BT.cameraClamp(new Vector2i(500, 300), new Vector2i(640, 480), new Vector2i(320, 240));

        expect(clamped.equalsXY(320, 240)).toBe(true);
    });

    it('uses BT.displaySize when viewSize is omitted', () => {
        vi.spyOn(BTAPI.instance, 'getHardwareSettings').mockReturnValue(
            mockHardwareSettings(new Vector2i(200, 150), 60),
        );

        const clamped = BT.cameraClamp(new Vector2i(100, 100), new Vector2i(250, 200));

        expect(clamped.equalsXY(50, 50)).toBe(true);
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
    beforeEach(() => {
        BT.inputMapReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        BT.inputMapReset();
    });

    it('returns false for face buttons when keyboard and gamepad are unavailable', () => {
        expect(BT.buttonDown(BT.BTN_A)).toBe(false);
    });

    it('accepts an optional player index without throwing', () => {
        expect(BT.buttonDown(BT.BTN_START, 2)).toBe(false);
    });

    it('delegates pointer buttons to the pointer subsystem', () => {
        const isButtonDown = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ isButtonDown } as never);

        expect(BT.buttonDown(BT.BTN_POINTER_A, 0)).toBe(true);
        expect(isButtonDown).toHaveBeenCalledWith(20, 0);
    });

    it('uses ANY semantics for combined button masks', () => {
        const isButtonDown = vi.fn().mockImplementation((codes: readonly string[]) => codes.includes('KeyA'));
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, BT.BTN_A, 'KeyA');

        expect(BT.buttonDown(BT.BTN_A | BT.BTN_B, 0)).toBe(true);
    });

    it('returns false for pointer buttons when the engine is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue(null);

        expect(BT.buttonDown(BT.BTN_POINTER_A)).toBe(false);
        expect(BT.buttonDown(BT.BTN_POINTER_D, 3)).toBe(false);
    });

    it('uses gamepad for player 2+ when keyboard maps are unavailable', () => {
        const isButtonDown = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({ isButtonDown } as never);

        expect(BT.buttonDown(BT.BTN_START, 2)).toBe(true);
        expect(isButtonDown).toHaveBeenCalledWith(BT.BTN_START, 2);
    });
});

describe('BT.buttonPressed', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false for face buttons when keyboard and gamepad are unavailable', () => {
        expect(BT.buttonPressed(BT.BTN_B)).toBe(false);
    });

    it('accepts an optional player index without throwing', () => {
        expect(BT.buttonPressed(BT.BTN_B, 1)).toBe(false);
    });

    it('delegates pointer buttons to the pointer subsystem', () => {
        const isButtonPressed = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ isButtonPressed } as never);

        expect(BT.buttonPressed(BT.BTN_POINTER_B, 0)).toBe(true);
        expect(isButtonPressed).toHaveBeenCalledWith(21, 0);
    });

    it('forwards repeatRate to keyboard/gamepad face-button queries', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(120);
        const isButtonPressedKeyboard = vi.fn().mockReturnValue(false);
        const isButtonPressedGamepad = vi.fn().mockReturnValue(true);
        const isButtonDownKeyboard = vi.fn().mockReturnValue(false);
        const isButtonDownGamepad = vi.fn().mockReturnValue(false);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({
            isButtonDown: isButtonDownKeyboard,
            isButtonPressed: isButtonPressedKeyboard,
        } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({
            isButtonDown: isButtonDownGamepad,
            isButtonPressed: isButtonPressedGamepad,
        } as never);

        BT.buttonPressed(BT.BTN_A, 0, 6);

        expect(isButtonPressedKeyboard).toHaveBeenCalledWith(expect.any(Array), 6, 120);
        expect(isButtonPressedGamepad).toHaveBeenCalledWith(BT.BTN_A, 0, 6, 120);
    });

    it('suppresses pressed edge when merged button was already down via keyboard', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(120);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({
            isButtonDown: vi.fn().mockReturnValue(true),
            isButtonPressed: vi.fn().mockReturnValue(false),
        } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({
            isButtonDown: vi.fn().mockReturnValue(true),
            isButtonPressed: vi.fn().mockReturnValue(true),
        } as never);

        expect(BT.buttonPressed(BT.BTN_A, 0)).toBe(false);
    });

    it('allows repeat events during dual-source hold when repeatRate is enabled', () => {
        vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(120);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({
            isButtonDown: vi.fn().mockReturnValue(true),
            isButtonPressed: vi.fn().mockReturnValue(true),
        } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({
            isButtonDown: vi.fn().mockReturnValue(true),
            isButtonPressed: vi.fn().mockReturnValue(false),
        } as never);

        expect(BT.buttonPressed(BT.BTN_A, 0, 6)).toBe(true);
    });
});

describe('BT.buttonReleased', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false for face buttons when keyboard is unavailable', () => {
        expect(BT.buttonReleased(BT.BTN_X)).toBe(false);
    });

    it('accepts an optional player index without throwing', () => {
        expect(BT.buttonReleased(BT.BTN_X, 3)).toBe(false);
    });

    it('delegates pointer buttons to the pointer subsystem', () => {
        const isButtonReleased = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ isButtonReleased } as never);

        expect(BT.buttonReleased(BT.BTN_POINTER_C, 2)).toBe(true);
        expect(isButtonReleased).toHaveBeenCalledWith(22, 2);
    });

    it('merges keyboard and gamepad for players 0 and 1', () => {
        const isButtonReleasedKeyboard = vi.fn().mockReturnValue(false);
        const isButtonReleased = vi.fn().mockReturnValue(true);
        const isButtonDownKeyboard = vi.fn().mockReturnValue(false);
        const isButtonDown = vi.fn().mockReturnValue(false);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({
            isButtonDown: isButtonDownKeyboard,
            isButtonReleased: isButtonReleasedKeyboard,
        } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({ isButtonDown, isButtonReleased } as never);

        expect(BT.buttonReleased(BT.BTN_A, 1)).toBe(true);
        expect(isButtonReleased).toHaveBeenCalledWith(BT.BTN_A, 1);
    });

    it('suppresses released edge when merged button remains down via keyboard', () => {
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({
            isButtonDown: vi.fn().mockReturnValue(true),
            isButtonReleased: vi.fn().mockReturnValue(false),
        } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({
            isButtonDown: vi.fn().mockReturnValue(false),
            isButtonReleased: vi.fn().mockReturnValue(true),
        } as never);

        expect(BT.buttonReleased(BT.BTN_A, 0)).toBe(false);
    });
});

// #endregion

// #region BT.inputMap / BT.inputMapReset

describe('BT.inputMap / BT.inputMapReset', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        BT.inputMapReset();
    });

    it('remaps player 0 face buttons through the keyboard subsystem', () => {
        const isButtonDown = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, BT.BTN_A, 'KeyZ');

        expect(BT.buttonDown(BT.BTN_A, 0)).toBe(true);
        expect(isButtonDown).toHaveBeenCalledWith(['KeyZ']);
    });

    it('remaps player 1 independently of player 0', () => {
        const isButtonDown = vi.fn().mockImplementation((codes: readonly string[]) => codes.includes('Numpad9'));
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, BT.BTN_A, 'KeyX');
        BT.inputMap(1, BT.BTN_A, 'Numpad9');

        BT.buttonDown(BT.BTN_A, 0);
        expect(isButtonDown).toHaveBeenLastCalledWith(['KeyX']);

        BT.buttonDown(BT.BTN_A, 1);
        expect(isButtonDown).toHaveBeenLastCalledWith(['Numpad9']);
    });

    it('passes multiple keys per button for OR semantics', () => {
        const isButtonDown = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, BT.BTN_UP, 'ArrowUp', 'KeyW');

        BT.buttonDown(BT.BTN_UP, 0);
        expect(isButtonDown).toHaveBeenCalledWith(['ArrowUp', 'KeyW']);
    });

    it('restores default key lists for both keyboard players', () => {
        const isButtonDown = vi.fn().mockReturnValue(false);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, BT.BTN_UP, 'F1');
        BT.inputMap(1, BT.BTN_UP, 'F2');
        BT.inputMapReset();

        BT.buttonDown(BT.BTN_UP, 0);
        expect(isButtonDown).toHaveBeenCalledWith([
            ...(BT.DEFAULT_KEYBOARD_PLAYER1[BT.BTN_UP as FaceButtonCode] ?? []),
        ]);

        BT.buttonDown(BT.BTN_UP, 1);
        expect(isButtonDown).toHaveBeenCalledWith([
            ...(BT.DEFAULT_KEYBOARD_PLAYER2[BT.BTN_UP as FaceButtonCode] ?? []),
        ]);
    });

    it('ignores remap attempts for unsupported keyboard players', () => {
        const isButtonDown = vi.fn().mockReturnValue(false);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(2, BT.BTN_A, 'KeyZ');

        BT.buttonDown(BT.BTN_A, 0);
        expect(isButtonDown).toHaveBeenCalledWith([...(BT.DEFAULT_KEYBOARD_PLAYER1[BT.BTN_A as FaceButtonCode] ?? [])]);
    });

    it('ignores remap attempts with out-of-range face button ids', () => {
        const isButtonDown = vi.fn().mockReturnValue(false);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, 99, 'KeyZ');

        BT.buttonDown(BT.BTN_A, 0);
        expect(isButtonDown).toHaveBeenCalledWith([...(BT.DEFAULT_KEYBOARD_PLAYER1[BT.BTN_A as FaceButtonCode] ?? [])]);
    });

    it('allows clearing keyboard bindings with an empty key list', () => {
        const isButtonDown = vi.fn().mockReturnValue(false);
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonDown } as never);

        BT.inputMap(0, BT.BTN_A);

        BT.buttonDown(BT.BTN_A, 0);
        expect(isButtonDown).toHaveBeenCalledWith([]);
    });
});

// #endregion

// #region BT pointer queries

describe('BT.pointerPos', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns Vector2i.zero() when the engine is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue(null);

        const pos = BT.pointerPos();

        expect(pos.x).toBe(0);
        expect(pos.y).toBe(0);
    });

    it('delegates to the pointer subsystem with the supplied slot index', () => {
        const expected = new Vector2i(80, 60);
        const getPos = vi.fn().mockReturnValue(expected);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ getPos } as never);

        const pos = BT.pointerPos(2);

        expect(getPos).toHaveBeenCalledWith(2);
        expect(pos).toBe(expected);
    });

    it('defaults the pointer index to 0 (mouse)', () => {
        const getPos = vi.fn().mockReturnValue(new Vector2i());
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ getPos } as never);

        BT.pointerPos();

        expect(getPos).toHaveBeenCalledWith(0);
    });
});

describe('BT.pointerDelta', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns Vector2i.zero() when the engine is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue(null);

        const delta = BT.pointerDelta();

        expect(delta.x).toBe(0);
        expect(delta.y).toBe(0);
    });

    it('delegates to the pointer subsystem', () => {
        const expected = new Vector2i(5, -3);
        const getDelta = vi.fn().mockReturnValue(expected);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ getDelta } as never);

        expect(BT.pointerDelta(1)).toBe(expected);
        expect(getDelta).toHaveBeenCalledWith(1);
    });
});

describe('BT.pointerPosValid', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false when the engine is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue(null);

        expect(BT.pointerPosValid()).toBe(false);
    });

    it('delegates to the pointer subsystem', () => {
        const isValid = vi.fn().mockReturnValue(true);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ isValid } as never);

        expect(BT.pointerPosValid(0)).toBe(true);
        expect(isValid).toHaveBeenCalledWith(0);
    });
});

describe('BT.pointerScrollDelta', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 0 when the engine is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue(null);

        expect(BT.pointerScrollDelta).toBe(0);
    });

    it('delegates to the pointer subsystem', () => {
        const getScrollDelta = vi.fn().mockReturnValue(42);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ getScrollDelta } as never);

        expect(BT.pointerScrollDelta).toBe(42);
    });
});

// #endregion

// #region Pointer button constants

describe('Pointer button constants', () => {
    it('exposes BTN_POINTER_A..D as bit flags', () => {
        expect(BT.BTN_POINTER_A).toBe(1 << 12);
        expect(BT.BTN_POINTER_B).toBe(1 << 13);
        expect(BT.BTN_POINTER_C).toBe(1 << 14);
        expect(BT.BTN_POINTER_D).toBe(1 << 15);
    });
});

// #endregion

// #region BT gamepad constants and APIs / BT.keyDown / BT.keyPressed / BT.keyReleased

describe('BT gamepad constants and APIs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exposes player constants', () => {
        expect(BT.PLAYER_ONE).toBe(0);
        expect(BT.PLAYER_TWO).toBe(1);
        expect(BT.PLAYER_THREE).toBe(2);
        expect(BT.PLAYER_FOUR).toBe(3);
    });

    it('exposes axis constants', () => {
        expect(BT.AXIS_LEFT_X).toBe(0);
        expect(BT.AXIS_LEFT_Y).toBe(1);
        expect(BT.AXIS_RIGHT_X).toBe(2);
        expect(BT.AXIS_RIGHT_Y).toBe(3);
        expect(BT.AXIS_TRIGGER_L).toBe(4);
        expect(BT.AXIS_TRIGGER_R).toBe(5);
    });

    it('exposes combo constants', () => {
        expect(BT.BTN_ABXY).toBe(BT.BTN_A | BT.BTN_B | BT.BTN_X | BT.BTN_Y);
        expect(BT.BTN_SHOULDER).toBe(BT.BTN_L | BT.BTN_R);
        expect(BT.BTN_POINTER_ANY).toBe(BT.BTN_POINTER_A | BT.BTN_POINTER_B | BT.BTN_POINTER_C | BT.BTN_POINTER_D);
    });

    it('delegates getAxis/gamepadConnected/gamepadCount to gamepad subsystem', () => {
        const getAxis = vi.fn().mockReturnValue(0.25);
        const isConnected = vi.fn().mockReturnValue(true);
        const connectedCount = vi.fn().mockReturnValue(2);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({ getAxis, isConnected, connectedCount } as never);

        expect(BT.getAxis(BT.AXIS_LEFT_X, 1)).toBe(0.25);
        expect(getAxis).toHaveBeenCalledWith(BT.AXIS_LEFT_X, 1);
        expect(BT.gamepadConnected(1)).toBe(true);
        expect(isConnected).toHaveBeenCalledWith(1);
        expect(BT.gamepadCount).toBe(2);
        expect(connectedCount).toHaveBeenCalledWith();
    });

    it('returns 0 from getAxis when the gamepad subsystem is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue(null);

        expect(BT.getAxis(BT.AXIS_LEFT_X, 1)).toBe(0);
    });

    it('returns false from gamepadConnected when the gamepad subsystem is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue(null);

        expect(BT.gamepadConnected(1)).toBe(false);
    });

    it('returns 0 from gamepadCount when the gamepad subsystem is not initialized', () => {
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue(null);

        expect(BT.gamepadCount).toBe(0);
    });
});

describe('BT.keyDown', () => {
    it('returns false when the engine is not initialized', () => {
        expect(BT.keyDown('Space')).toBe(false);
    });
});

describe('BT.keyPressed', () => {
    it('returns false when the engine is not initialized', () => {
        expect(BT.keyPressed('ArrowUp')).toBe(false);
    });
});

describe('BT.keyReleased', () => {
    it('returns false when the engine is not initialized', () => {
        expect(BT.keyReleased('KeyA')).toBe(false);
    });
});

// #endregion

// #region BT.systemPrint / BT.systemPrintMeasure / BT.printFont

describe('BT.systemPrint', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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

    it('shows a missing await message for Promise font values', async () => {
        await withErrorContainer(async () => {
            BT.printFont(Promise.resolve({}) as unknown as BitmapFont, new Vector2i(0, 0), 'Hi');

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("Did you forget to use 'await' before BitmapFont.load()?");
        });
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
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
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

    it('shows a missing await message for Promise sprite sheet values', async () => {
        await withErrorContainer(async () => {
            BT.drawSprite(Promise.resolve({}) as unknown as SpriteSheet, new Rect2i(0, 0, 8, 8), new Vector2i(0, 0), 0);

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("Did you forget to use 'await' before SpriteSheet.load()?");
        });
    });

    it('shows engine-not-ready message when drawing before bootstrap completes', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue(null);

            BT.drawSprite(new SpriteSheet(mockImage), new Rect2i(0, 0, 8, 8), new Vector2i(0, 0), 0);

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("The engine isn't ready yet.");
        });
    });
});

// #endregion

// #region BT.effectAdd / BT.effectRemove / BT.effectClear

describe('BT.effectAdd / BT.effectRemove / BT.effectClear', () => {
    function makeStubEffect() {
        return {
            tier: 'pixel' as const,
            init: vi.fn(),
            updateUniforms: vi.fn(),
            encodePass: vi.fn(),
            dispose: vi.fn(),
        };
    }

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('effectAdd shows engine-not-ready when called before bootstrap', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue(null);

            BT.effectAdd(makeStubEffect());

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("The engine isn't ready yet.");
        });
    });

    it('effectRemove shows engine-not-ready when called before bootstrap', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue(null);

            BT.effectRemove(makeStubEffect());

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("The engine isn't ready yet.");
        });
    });

    it('effectClear shows engine-not-ready when called before bootstrap', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue(null);

            BT.effectClear();

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("The engine isn't ready yet.");
        });
    });

    it('effectAdd delegates to BTAPI.instance.effectAdd when renderer is ready', () => {
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
        const spy = vi.spyOn(BTAPI.instance, 'effectAdd').mockReturnValue(undefined);
        const effect = makeStubEffect();

        BT.effectAdd(effect);

        expect(spy).toHaveBeenCalledWith(effect);
    });

    it('effectRemove delegates to BTAPI.instance.effectRemove when renderer is ready', () => {
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
        const spy = vi.spyOn(BTAPI.instance, 'effectRemove').mockReturnValue(undefined);
        const effect = makeStubEffect();

        BT.effectRemove(effect);

        expect(spy).toHaveBeenCalledWith(effect);
    });

    it('effectClear delegates to BTAPI.instance.effectClear when renderer is ready', () => {
        vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
        const spy = vi.spyOn(BTAPI.instance, 'effectClear').mockReturnValue(undefined);

        BT.effectClear();

        expect(spy).toHaveBeenCalled();
    });

    it('effectAdd shows a clear software-renderer unsupported message', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
            vi.spyOn(BTAPI.instance, 'effectAdd').mockImplementation(() => {
                throw new Error(
                    "The software renderer doesn't support fullscreen effects. To use post-process effects, set backend to 'webgpu' in configure().",
                );
            });

            BT.effectAdd(makeStubEffect());

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("doesn't support fullscreen effects");
            expect(text).toContain("set backend to 'webgpu' in configure()");
        });
    });

    it('effectRemove shows a clear software-renderer unsupported message', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
            vi.spyOn(BTAPI.instance, 'effectRemove').mockImplementation(() => {
                throw new Error(
                    "The software renderer doesn't support fullscreen effects. To use post-process effects, set backend to 'webgpu' in configure().",
                );
            });

            BT.effectRemove(makeStubEffect());

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("doesn't support fullscreen effects");
        });
    });

    it('effectClear shows a clear software-renderer unsupported message', async () => {
        await withErrorContainer(async () => {
            vi.spyOn(BTAPI.instance, 'getRenderer').mockReturnValue({} as never);
            vi.spyOn(BTAPI.instance, 'effectClear').mockImplementation(() => {
                throw new Error(
                    "The software renderer doesn't support fullscreen effects. To use post-process effects, set backend to 'webgpu' in configure().",
                );
            });

            BT.effectClear();

            const text = document.getElementById(DEFAULT_CONTAINER_ID)?.textContent ?? '';
            expect(text).toContain("doesn't support fullscreen effects");
        });
    });
});

// #endregion

// #region BT.activeBackend

describe('BT.activeBackend', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to BTAPI.instance.getActiveBackend', () => {
        const spy = vi.spyOn(BTAPI.instance, 'getActiveBackend').mockReturnValue('webgpu');

        const result = BT.activeBackend;

        expect(spy).toHaveBeenCalled();
        expect(result).toBe('webgpu');
    });

    it('returns null before initialization', () => {
        vi.spyOn(BTAPI.instance, 'getActiveBackend').mockReturnValue(null);

        expect(BT.activeBackend).toBeNull();
    });

    it('returns software when BTAPI reports software backend active', () => {
        vi.spyOn(BTAPI.instance, 'getActiveBackend').mockReturnValue('software');

        expect(BT.activeBackend).toBe('software');
    });
});

// #endregion
