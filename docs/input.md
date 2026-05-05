# Input Guide

Blit-Tech provides a DOM-backed pointer input subsystem that handles mouse, touch, and pen contacts through a unified
four-slot model. All coordinates are returned in logical display space (the `displaySize` configured in
`queryHardware()`), independent of the canvas's CSS or backing-buffer size.

Keyboard and gamepad input APIs exist as stubs (`BT.keyDown()`, `BT.buttonDown()` with `BTN_UP..BTN_SELECT`) but are not
yet implemented and always return `false`.

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
// In initialize(): hide the OS cursor and draw your own crosshair / sprite
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
- `buttonPressed()` / `buttonReleased()` edges are never lost even when a press and release both arrive in the same
  inter-frame gap (they appear as pressed-then-released across consecutive frames).

## Page-Interaction Guards

`attach()` installs three guards on the canvas to prevent browser defaults from interfering:

- `wheel` with `{ passive: false }` and `preventDefault()` — prevents page scroll on wheel events.
- `canvas.style.touchAction = 'none'` — prevents iOS Safari pinch-zoom and double-tap-zoom.
- `contextmenu` with `preventDefault()` — prevents the OS context menu on right-click so `BTN_POINTER_B` works.

`detach()` reverses all three and removes all event listeners. This happens automatically when the engine stops or when
`demo.initialize()` throws.

## Coordinate Conversion

Client coordinates from DOM events are converted to display space using the canvas bounding rect:

```
display_x = floor((clientX - rect.left) / rect.width  * displaySize.x)
display_y = floor((clientY - rect.top)  / rect.height * displaySize.y)
```

Coordinates are clamped to `[0, displaySize - 1]` on each axis. The conversion is skipped when the canvas has zero size
(no layout yet) to avoid NaN coordinates.

## Implementation Notes

- `PointerInput` is internal to the engine; import from `blit-tech` and access through `BT.*` methods.
- The `POINTER_SLOT_COUNT` constant (value `4`) is exported for demos that iterate over slots.
- `PointerInput` is created and `attach()`-ed inside `BTAPI.initialize()`, so it is ready before `demo.initialize()`
  runs.
- `stop()` calls `detach()` and clears the reference to prevent DOM listener leaks.
