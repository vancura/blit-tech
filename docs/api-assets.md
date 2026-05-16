# API: Assets

Sprite sheets, bitmap fonts, and asset loading.

---

## Loading Assets

`AssetLoader` caches images by URL so repeated loads share the same `HTMLImageElement`.

```ts
import { AssetLoader } from 'blit-tech';

// Load multiple images in parallel
const images = await AssetLoader.loadImages(['sprites.png', 'tiles.png']);

// Check cache before loading
if (AssetLoader.isLoaded('sprites.png')) {
  // already cached
}
```

---

## Sprite Setup — Preferred Path

Use `SpriteSheet.loadIndexed()` for all standard sprite setup. It combines color registration, image loading, and
palette indexization in one call.

```ts
import { SpriteSheet, Palette } from 'blit-tech';

const palette = new Palette(256);

const indexed = await SpriteSheet.loadIndexed(
  'sprites/hero.png', // URL
  palette, // palette to populate
  10, // startSlot — first palette slot to write colors into
  { sort: 'luminance' }, // optional: color order in palette ('luminance' | 'none')
);

BT.paletteSet(palette); // activate AFTER loadIndexed returns

// Draw using the returned sheet and source rectangle:
BT.drawSprite(indexed.sheet, indexed.srcRect, new Vector2i(20, 20));

// indexed.colors — list of Color32 values registered into the palette
// indexed.srcRect — Rect2i spanning the full image
```

Colors are sorted by perceived luminance (darkest-first) by default. Pass `{ sort: 'none' }` to preserve row-major scan
order. Slot 0 is never touched — transparent pixels in the image map to slot 0 at draw time.

---

## Sprite Setup — Manual Path

Use this only when you need fine-grained control over the palette layout or want to load several sheets into the same
palette sequentially.

```ts
// Step 1: register colors from each image into the palette
const colors = await SpriteSheet.loadColorsIntoPalette('hero.png', palette, 10);
const tileColors = await SpriteSheet.loadColorsIntoPalette('tiles.png', palette, 10 + colors.length);

// Step 2: load the image into a SpriteSheet
const sheet = await SpriteSheet.load('hero.png');

// Step 3: convert RGBA pixels to palette indices
sheet.indexize(palette);

BT.paletteSet(palette);
```

To create a sheet from raw palette-indexed pixel data (advanced / test use):

```ts
const sheet = SpriteSheet.fromIndexedPixels(width, height, indexedPixels);
```

---

## Palette Offset

Pass a `paletteOffset` to `BT.drawSprite()` to shift the entire sprite's color range by N slots. Useful for team-color
variations and damage flashes. Full semantics in [API: Rendering](api-rendering.md).

```ts
BT.drawSprite(sheet, srcRect, pos, 16); // render in "blue team" color range
```

---

## Bitmap Fonts

Load `.btfont` files for proportional, palette-indexed bitmap fonts.

```ts
import { BitmapFont } from 'blit-tech';

const font = await BitmapFont.load('fonts/MyFont.btfont');
BT.printFont(font, new Vector2i(10, 10), 'Hello!');
BT.printFont(font, new Vector2i(10, 10), 'Hello!', paletteOffset); // tinted variant
```

The font's internal sprite sheet is indexized automatically when loaded. Font rendering goes through the same sprite
pipeline as `BT.drawSprite()` and is auto-batched.

See [Bitmap Fonts Guide](bitmap-fonts.md) for the `.btfont` format specification and the BMFont conversion workflow
(`pnpm convert-font`).

---

## System Font

A built-in 6×14 monospace font covering printable ASCII (characters 32–126). No load step needed.

```ts
BT.systemPrint(new Vector2i(10, 10), paletteIndex, 'Score: 100');
BT.systemPrintMeasure('Score: 100'); // → Vector2i (pixel width, height)
```

Use `BT.systemPrint()` for debug overlays and simple HUDs. For styled variable-width text, use a bitmap font instead.

---

## See Also

| Guide                                 | What it covers                          |
| ------------------------------------- | --------------------------------------- |
| [API: Core](api-core.md)              | bootstrap, init, game loop, core types  |
| [API: Rendering](api-rendering.md)    | primitives, sprites, text, post-process |
| [API: Palette](api-palette.md)        | palette setup, presets, effects         |
| [Palette Guide](palette-guide.md)     | palette-first setup, offsets, refresh   |
| [Palette Presets](palette-presets.md) | built-in preset reference               |
| [Bitmap Fonts](bitmap-fonts.md)       | .btfont format, BMFont conversion       |
