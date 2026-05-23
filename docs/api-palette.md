# API: Palette

Palette setup, built-in presets, HUD preset, serialization, and palette effects.

The palette is the single color authority for all rendering. Index `0` is always transparent and is never drawn. Set an
active palette with `BT.paletteSet()` before any draw calls. Valid sizes: `2, 4, 16, 32, 64, 128, 256`.

---

## Palette Setup

```ts
// Create
const palette = new Palette(256);
const palette = BT.paletteCreate(256); // equivalent BT-namespace shorthand

// Set and get colors
palette.set(1, new Color32(255, 0, 0, 255)); // red at slot 1
palette.get(1); // → Color32 (defensive copy)
palette.getRef(1); // → Color32 (live reference - do not store)

// Activate for rendering
BT.paletteSet(palette);
BT.palette; // → active Palette; throws if none set
```

---

## Built-in Presets

Each preset returns a fully populated `Palette` instance.

```ts
Palette.vga(); // VGA 256-color
Palette.cga(); // CGA 16-color
Palette.c64(); // Commodore 64 16-color
Palette.gameboy(); // Game Boy 4-shade
Palette.pico8(); // PICO-8 16-color
Palette.nes(); // NES 64-color
```

---

## HUD Preset

Fills six consecutive UI-purpose slots into an existing palette and registers `hud_*` name aliases.

```ts
palette.applyHUD(); // fills slots 1-6 (default startSlot = 1)
palette.applyHUD(10); // fills slots 10-15
BT.paletteSet(palette);
```

The six slots in order, by alias:

| Alias        | Purpose                 |
| ------------ | ----------------------- |
| `hud_white`  | Foreground / label text |
| `hud_bg`     | Panel background        |
| `hud_label`  | Secondary label         |
| `hud_header` | Header / title text     |
| `hud_dim`    | Dimmed / inactive text  |
| `hud_code`   | Code / monospace text   |

Override individual slots after `applyHUD()`:

```ts
palette.applyHUD(1);
palette.set(2, new Color32(20, 16, 32)); // override hud_bg
BT.paletteSet(palette);
```

---

## Named Slot Aliases

```ts
palette.setNamed('player', 3); // alias 'player' → slot 3
palette.getNamed('player'); // → 3 (the slot index)
palette.getNamedColor('player'); // → Color32 at that slot
```

`hud_*` aliases are registered automatically by `applyHUD()`.

---

## Serialization

```ts
// JSON round-trip (preserves colors and named aliases)
const json = palette.toJSON();
const restored = Palette.fromJSON(json);

// Raw byte arrays (RGB triplets, no alpha channel)
const bytes = palette.toUint8Array(); // Uint8Array, 3 bytes per slot
const p = Palette.fromUint8Array(bytes); // auto-detect size
const p = Palette.fromUint8Array(bytes, 16); // explicit size

// Clone
const copy = palette.clone();

// Search
const slot = palette.findColor(color); // → index, or -1 if not found
```

---

## Palette Effects

Animated effects run automatically each frame in the engine's end-of-frame pass (after `demo.render()`, before the GPU
upload). Multiple effects can run simultaneously on different palette ranges and will not conflict. Effects process via
the `dirty` flag - no polling needed.

```ts
// Cycle a range of slots (water, fire, plasma)
BT.paletteCycle(start, end, speed);
// speed: steps/second, positive = forward, negative = backward

// Fade entire palette toward a target
BT.paletteFade(targetPalette, durationMs);
BT.paletteFade(targetPalette, durationMs, 'ease-in-out');

// Fade a sub-range only
BT.paletteFadeRange(start, end, targetPalette, durationMs);
BT.paletteFadeRange(start, end, targetPalette, durationMs, 'ease-out');

// Flash all non-zero slots to a color then restore (lightning, damage)
BT.paletteFlash(Color32.white, 200); // 200 ms

// Instant swap of two slots
BT.paletteSwap(indexA, indexB);

// Cancel all active effects (palette stays at its current state)
BT.paletteClearEffects();
```

---

## Easing Functions

Used by `paletteFade` and `paletteFadeRange`. Type: `EasingFunction`.

| Value           | Curve                                |
| --------------- | ------------------------------------ |
| `'linear'`      | Constant rate (default when omitted) |
| `'ease-in'`     | Slow start, fast end                 |
| `'ease-out'`    | Fast start, slow end                 |
| `'ease-in-out'` | Slow start and end                   |

---

## Timing Note

Effects are applied after `demo.render()` but before the GPU palette upload in `Renderer.endFrame()`. This means user
draw calls and palette effects see the same consistent snapshot within a frame - they never interleave mid-frame.

Effects that auto-remove (fade, flash) clean up when their duration elapses. `paletteCycle` runs indefinitely until
`paletteClearEffects()` is called.

---

## See Also

| Guide                                 | What it covers                             |
| ------------------------------------- | ------------------------------------------ |
| [API: Core](api-core.md)              | bootstrap, init, game loop, core types     |
| [API: Rendering](api-rendering.md)    | primitives, sprites, text, post-process    |
| [API: Assets](api-assets.md)          | sprite sheets, bitmap fonts, asset loading |
| [Palette Guide](palette-guide.md)     | end-to-end palette workflow and best usage |
| [Palette Presets](palette-presets.md) | exact built-in palette and HUD color data  |
| [Testing](testing.md)                 | test tiers and palette testing patterns    |
