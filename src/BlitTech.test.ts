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
    afterEach(() => {
        vi.restoreAllMocks();
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
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({ isButtonPressed: isButtonPressedKeyboard } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({ isButtonPressed: isButtonPressedGamepad } as never);

        BT.buttonPressed(BT.BTN_A, 0, 6);

        expect(isButtonPressedKeyboard).toHaveBeenCalledWith(expect.any(Array), 6, 120);
        expect(isButtonPressedGamepad).toHaveBeenCalledWith(BT.BTN_A, 0, 6, 120);
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
        vi.spyOn(BTAPI.instance, 'getKeyboard').mockReturnValue({
            isButtonReleased: isButtonReleasedKeyboard,
        } as never);
        vi.spyOn(BTAPI.instance, 'getGamepad').mockReturnValue({ isButtonReleased } as never);

        expect(BT.buttonReleased(BT.BTN_A, 1)).toBe(true);
        expect(isButtonReleased).toHaveBeenCalledWith(BT.BTN_A, 1);
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

        expect(BT.pointerScrollDelta()).toBe(0);
    });

    it('delegates to the pointer subsystem', () => {
        const getScrollDelta = vi.fn().mockReturnValue(42);
        vi.spyOn(BTAPI.instance, 'getPointer').mockReturnValue({ getScrollDelta } as never);

        expect(BT.pointerScrollDelta()).toBe(42);
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

// #region BT.keyDown / BT.keyPressed / BT.keyReleased

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
        expect(BT.gamepadConnected(1)).toBe(true);
        expect(BT.gamepadCount()).toBe(2);
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
