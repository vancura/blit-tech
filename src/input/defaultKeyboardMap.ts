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

/**
 * Deep-copies default face-button rows into a mutable map (`button` → `KeyboardEvent.code` list).
 *
 * Used by {@link BT.inputMapReset} so exported defaults are never mutated.
 *
 * @param source - One player's default record (`DEFAULT_KEYBOARD_PLAYER1` or `DEFAULT_KEYBOARD_PLAYER2`).
 * @returns Map with keys `0`…`11` and copied string arrays.
 */
export function cloneDefaultKeyboardPlayerMap(
    source: Readonly<Record<FaceButtonCode, readonly string[]>>,
): Map<number, string[]> {
    const result = new Map<number, string[]>();

    for (let button = 0; button <= 11; button++) {
        const codes = source[button as FaceButtonCode];

        result.set(button, [...codes]);
    }

    return result;
}

/**
 * Fresh runtime maps for keyboard players 0 and 1 from built-in defaults.
 *
 * @returns Tuple `[player0Map, player1Map]`.
 */
export function createDefaultKeyboardRuntimeMaps(): [Map<number, string[]>, Map<number, string[]>] {
    return [
        cloneDefaultKeyboardPlayerMap(DEFAULT_KEYBOARD_PLAYER1),
        cloneDefaultKeyboardPlayerMap(DEFAULT_KEYBOARD_PLAYER2),
    ];
}
