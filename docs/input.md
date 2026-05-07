# Input Guide

Blit-Tech provides DOM-backed input: **pointer** (mouse, touch, pen), **keyboard** (`KeyboardEvent.code` tracking and
virtual face buttons), **gamepad** (up to four players via `navigator.getGamepads()`), and **text accumulation** for UI
entry (`BT.inputString()`).

All pointer coordinates are returned in logical display space (the `displaySize` configured in `queryHardware()`),
independent of the canvas's CSS or backing-buffer size.

## Pointer Slot Model

The engine tracks up to four simultaneous pointers:

| Slot | Source                                       |
| ---- | -------------------------------------------- |
| 0    | Mouse (always reserved)                      |
| 1    | First touch / pen contact (in arrival order) |
| 2    | Second touch / pen contact                   |
| 3    | Third touch / pen contact                    |

Overflow contacts beyond slot 3 are dropped silently. The constant `POINTER_SLOT_COUNT` (exported from the library)
equals `4`.

### Mouse slot (slot 0)

- Becomes valid on the first `pointermove` inside the canvas.
- Stays valid while the mouse remains over the canvas; cleared on `pointerleave`.
- Tracks all four buttons (A, B, C, D).
- Position is preserved after the mouse leaves; a new `pointermove` re-syncs it.

### Touch / pen slots (slots 1-3)

- Allocated on `pointerdown` in the first free slot; freed on `pointerup`, `pointercancel`, or `pointerleave`.
- Only `BTN_POINTER_A` reports true while the contact is down; B, C, D always return false.
- Position and delta are preserved on release so release-frame code can read the final position and flick velocity.
- The engine calls `setPointerCapture` so off-canvas drags continue delivering events.

## Position and Delta

```ts
// Current position in display coordinates
const pos = BT.pointerPos(); // slot 0 (mouse)
const touch = BT.pointerPos(1); // slot 1 (first touch)

// Movement since the last frame
const delta = BT.pointerDelta(); // slot 0 (mouse)
const td = BT.pointerDelta(1); // slot 1

// Validity check — false means no live pointer in this slot
if (BT.pointerPosValid()) {
  /* mouse is over the canvas */
}
if (BT.pointerPosValid(1)) {
  /* touch slot 1 is active */
}
```

`BT.pointerPos()` returns `Vector2i.zero()` when the slot index is out of `[0, 3]` or the engine is not initialized.
`BT.pointerDelta()` similarly returns `Vector2i.zero()` for invalid slots.

## Buttons

Use `BT.buttonDown()`, `BT.buttonPressed()`, and `BT.buttonReleased()` with the `BTN_POINTER_*` constants. The second
parameter is the pointer slot (defaults to `0`):

```ts
// Hold detection
BT.buttonDown(BT.BTN_POINTER_A); // left mouse button held
BT.buttonDown(BT.BTN_POINTER_B); // right mouse button held
BT.buttonDown(BT.BTN_POINTER_C); // middle mouse button held
BT.buttonDown(BT.BTN_POINTER_D); // back / forward button held
BT.buttonDown(BT.BTN_POINTER_A, 1); // touch slot 1 in contact

// Edge detection (true only on the transition frame)
BT.buttonPressed(BT.BTN_POINTER_A); // left button just pressed
BT.buttonReleased(BT.BTN_POINTER_A); // left button just released
BT.buttonPressed(BT.BTN_POINTER_A, 2); // touch slot 2 just touched down
```

### Mouse button mapping

The mapping follows the RetroBlit canonical order, not the DOM `PointerEvent.button` index:

| Button constant | Mouse button         | DOM button index |
| --------------- | -------------------- | ---------------- |
| `BTN_POINTER_A` | Left                 | 0                |
| `BTN_POINTER_B` | Right                | 2                |
| `BTN_POINTER_C` | Middle / wheel click | 1                |
| `BTN_POINTER_D` | Back or forward      | 3 or 4           |

## Keyboard

Listeners attach to the canvas during `BT.init()`. For reliable delivery, ensure the canvas can receive focus (for
example `canvas.tabIndex = 0` and `canvas.focus()`). The library follows `KeyboardEvent.code` (physical-key semantics),
not `event.key` layout text.

### Raw key queries

Use these for direct key checks:

```ts
// Held state
if (BT.keyDown('KeyW')) {
  /* W key held */
}

// Edge and optional tick-based repeat (repeat interval in fixed-update ticks)
if (BT.keyPressed('ArrowUp', 10)) {
  /* first press or repeat every 10 ticks while held */
}

// Release edge
if (BT.keyReleased('Escape')) {
  /* Escape released this frame */
}
```

### Face buttons (`BTN_UP` through `BTN_SELECT`)

Face button constants are bit flags. You can pass a single button or a combined mask; matching uses **ANY** semantics:
`BT.buttonDown(BT.BTN_A | BT.BTN_B)` is true when either A or B is down.

For **player 0** and **player 1**, face-button reads merge keyboard maps and gamepad state (logical OR). For **player
2** and **player 3**, face-button reads use gamepad only.

`BT.buttonPressed` supports optional tick-based repeat via `repeatRate` (`0` or omitted = edge only), matching
`BT.keyPressed` semantics.

```ts
// Player 0 (default: WASD-style + Space / KeyB for A, etc.)
BT.buttonDown(BT.BTN_UP, 0);
BT.buttonPressed(BT.BTN_A, 0, 6); // edge + repeat every 6 ticks while held

// Player 1 (default: arrow keys + alternate bindings)
BT.buttonDown(BT.BTN_LEFT, 1);
```

Built-in defaults are exposed as read-only tables (same values the engine starts with):

- `BT.DEFAULT_KEYBOARD_PLAYER1`
- `BT.DEFAULT_KEYBOARD_PLAYER2`

### Remapping (`BT.inputMap` / `BT.inputMapReset`)

Override bindings at runtime. The first argument is the **zero-based player index** (`0` or `1` only; other values are
ignored). The second is the face button constant. Remaining arguments are `KeyboardEvent.code` strings.

```ts
BT.inputMap(0, BT.BTN_A, 'Space');
BT.inputMap(0, BT.BTN_UP, 'ArrowUp', 'KeyW'); // either key triggers UP for player 0
BT.inputMap(1, BT.BTN_START, 'Enter', 'NumpadEnter');

// Restore built-in defaults for both keyboard players (does not affect pointer or future gamepad state)
BT.inputMapReset();
```

Pass **no** key codes to clear keyboard bindings for that player and button until you map again:

```ts
BT.inputMap(0, BT.BTN_X); // player 0 X has no keyboard keys until remapped
```

### Gamepad API

```ts
BT.gamepadConnected(0); // true when player 0 has a connected gamepad
BT.gamepadCount(); // number of connected gamepads (0..4)

BT.getAxis(BT.AXIS_LEFT_X, 0); // -1.0 .. 1.0 (dead-zone filtered)
BT.getAxis(BT.AXIS_TRIGGER_L, 0); // 0.0 .. 1.0
```

Axis constants:

- `AXIS_LEFT_X`, `AXIS_LEFT_Y`
- `AXIS_RIGHT_X`, `AXIS_RIGHT_Y`
- `AXIS_TRIGGER_L`, `AXIS_TRIGGER_R`

Player constants:

- `PLAYER_ONE` (`0`)
- `PLAYER_TWO` (`1`)
- `PLAYER_THREE` (`2`)
- `PLAYER_FOUR` (`3`)

Default dead zone for analog sticks is `0.75` (`GamepadInput.DEFAULT_GAMEPAD_DEAD_ZONE`).

### Text input buffer

`BT.inputString()` returns characters accumulated from filtered `beforeinput` (and Tab / Escape where needed). The
buffer clears after each frame once the engine flushes input at end-of-frame. See public JSDoc on `BT.inputString` for
details.

## Scroll Delta

```ts
// Accumulated vertical scroll for the current frame, in pixels
const scroll = BT.pointerScrollDelta();

if (scroll > 0) {
  /* scrolled down */
}
if (scroll < 0) {
  /* scrolled up   */
}
```

The value aggregates all `WheelEvent.deltaY` values received since the last frame, normalizing line and page delta modes
to pixels. It resets to zero each frame. The engine also calls `preventDefault()` on wheel events so the page does not
scroll while the canvas has focus.

## Cursor Control

```ts
// In init(): hide the OS cursor and draw your own crosshair / sprite
BT.hideCursor();

// Restore at any time
BT.showCursor();
```

`hideCursor()` sets `canvas.style.cursor = 'none'`. `showCursor()` restores whatever the cursor was at `attach()` time.
Both are no-ops before the engine is initialized. The cursor is restored automatically when the engine stops.

## Frame-Timing Semantics

State is snapshotted at the **end** of each animation frame, after `demo.update()` and `demo.render()` have run. This
means:

- Any pointer event that fires between two frames is visible as a transition on the **next** `update()` call.
- `pointerDelta()` reflects movement between the last `update()` and the current one.
- Keyboard-held keys and edges follow the same end-of-frame snapshot timing as pointer input (`KeyboardInput.endFrame`
  aligns with pointer flush).
- Gamepad previous-state rollover also happens at end-of-frame, while current gamepad state is polled from the Gamepad
  API during button/axis queries.
- `buttonPressed()` / `buttonReleased()` edges are never lost even when a press and release both arrive in the same
  inter-frame gap (they appear as pressed-then-released across consecutive frames).

## Page-Interaction Guards

`attach()` installs three guards on the canvas to prevent browser defaults from interfering:

- `wheel` with `{ passive: false }` and `preventDefault()` — prevents page scroll on wheel events.
- `canvas.style.touchAction = 'none'` — prevents iOS Safari pinch-zoom and double-tap-zoom.
- `contextmenu` with `preventDefault()` — prevents the OS context menu on right-click so `BTN_POINTER_B` works.

`detach()` reverses all three and removes all event listeners. This happens automatically when the engine stops or when
`demo.init()` throws.

## Coordinate Conversion

Client coordinates from DOM events are converted to display space using the canvas bounding rect:

```text
display_x = floor((clientX - rect.left) / rect.width  * displaySize.x)
display_y = floor((clientY - rect.top)  / rect.height * displaySize.y)
```

Coordinates are clamped to `[0, displaySize - 1]` on each axis. The conversion is skipped when the canvas has zero size
(no layout yet) to avoid NaN coordinates.

## Implementation Notes

- `PointerInput`, `KeyboardInput`, and `GamepadInput` are internal; import from `blit-tech` and access through `BT.*`
  methods.
- Default keyboard tables live in `defaultKeyboardMap.ts`; runtime remaps are stored in the `BT` facade and reset with
  `BT.inputMapReset()`.
- The `POINTER_SLOT_COUNT` constant (value `4`) is exported for demos that iterate over slots.
- `PointerInput`, `KeyboardInput`, and `GamepadInput` are created and attached inside `BTAPI.init()`, so they are ready
  before `demo.init()` runs.
- `stop()` calls `detach()` on all three input subsystems and clears references to prevent listener leaks.
