/**
 * Default keyboard bindings for face buttons (VV-435 key mapping).
 *
 * Values are `KeyboardEvent.code` strings. Logical button state is the OR of
 * all listed keys for that button.
 */

/** Button codes matching `BT.BTN_UP` … `BT.BTN_SELECT` (0–11). */
export type FaceButtonCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/**
 * Player 1 default keyboard map (WASD, Space/KeyB, etc.).
 */
export const DEFAULT_KEYBOARD_PLAYER1: Readonly<Record<FaceButtonCode, readonly string[]>> = {
    0: ['KeyW'],
    1: ['KeyS'],
    2: ['KeyA'],
    3: ['KeyD'],
    4: ['Space', 'KeyB'],
    5: ['KeyN'],
    6: [],
    7: [],
    8: [],
    9: [],
    10: ['Digit5'],
    11: ['Escape'],
};

/**
 * Player 2 default keyboard map (arrows, numpad alternates).
 */
export const DEFAULT_KEYBOARD_PLAYER2: Readonly<Record<FaceButtonCode, readonly string[]>> = {
    0: ['ArrowUp'],
    1: ['ArrowDown'],
    2: ['ArrowLeft'],
    3: ['ArrowRight'],
    4: ['Semicolon', 'Numpad1'],
    5: ['Quote', 'Numpad2'],
    6: [],
    7: [],
    8: [],
    9: [],
    10: ['Backspace', 'NumpadDivide'],
    11: [],
};
