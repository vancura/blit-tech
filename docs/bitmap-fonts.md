# Bitmap Fonts in Blit-Tech

Blit-Tech uses a modern `.btfont` JSON format for bitmap fonts. This format supports variable-width glyphs,
per-character offsets, Unicode characters, and either embedded or external textures.

## Quick Start

```typescript
import { BitmapFont, BT, Color32, Vector2i } from 'blit-tech';

// Load a font
const font = await BitmapFont.load('fonts/MyFont.btfont');

// Render text
BT.printFont(font, new Vector2i(10, 10), 'Hello World!', Color32.white());

// Measure text width
const width = font.measureText('Hello');

// Access font properties
console.log(font.name); // "MyFont"
console.log(font.size); // 14
console.log(font.lineHeight); // 15
console.log(font.glyphCount); // 98
```

## Font File Format (.btfont)

The `.btfont` format is a JSON file with the following structure:

```json
{
  "name": "PragmataPro",
  "size": 14,
  "lineHeight": 15,
  "baseline": 13,
  "texture": "PragmataPro14.png",
  "glyphs": {
    " ": { "x": 169, "y": 54, "w": 5, "h": 17, "ox": -2, "oy": -1, "adv": 7 },
    "A": { "x": 80, "y": 18, "w": 9, "h": 17, "ox": -1, "oy": -1, "adv": 7 },
    "×": { "x": 0, "y": 54, "w": 9, "h": 17, "ox": -1, "oy": -1, "adv": 7 }
  }
}
```

### Properties

| Property     | Type   | Description                                                  |
| ------------ | ------ | ------------------------------------------------------------ |
| `name`       | string | Font display name                                            |
| `size`       | number | Original font size in points                                 |
| `lineHeight` | number | Pixels between baselines for multi-line text                 |
| `baseline`   | number | Pixels from top of line to baseline (for vertical alignment) |
| `texture`    | string | Texture source (see [Texture Options](#texture-options))     |
| `glyphs`     | object | Map of character → glyph data                                |

### Glyph Properties

| Property | Type   | Description                                                   |
| -------- | ------ | ------------------------------------------------------------- |
| `x`      | number | X position in texture atlas                                   |
| `y`      | number | Y position in texture atlas                                   |
| `w`      | number | Width of glyph in pixels                                      |
| `h`      | number | Height of glyph in pixels                                     |
| `ox`     | number | Horizontal offset when rendering (pen position adjustment)    |
| `oy`     | number | Vertical offset when rendering                                |
| `adv`    | number | Horizontal advance after drawing (distance to next character) |

## Texture Options

The `texture` field supports two formats:

### 1. Relative Path (Recommended for Development)

```json
{
  "texture": "MyFont.png"
}
```

The path is resolved relative to the `.btfont` file location. This is convenient during development as you can update
the PNG without regenerating the JSON.

### 2. Embedded Base64 (Recommended for Production)

```json
{
  "texture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

The entire texture is embedded as a base64-encoded data URI. This creates a single self-contained file, ideal for
distribution.

## Converting from BMFont Format

Most bitmap font tools export to the [BMFont format](https://www.angelcode.com/products/bmfont/) (`.fnt` + `.png`). Use
the included conversion script to convert these to `.btfont`:

### Using the Conversion Script

```bash
# From project root
node tools/convert-bmfont.mjs <input.fnt> <output.btfont> [--embed]

# Or via pnpm:
pnpm convert-font <input.fnt> <output.btfont> [--embed]

# Examples:
node tools/convert-bmfont.mjs tmp/MyFont.fnt examples/fonts/MyFont.btfont
node tools/convert-bmfont.mjs tmp/MyFont.fnt examples/fonts/MyFont.btfont --embed
```

Options:

- `--embed` - Embed the texture as base64 (recommended for production)

### Running on Different Platforms

The conversion script works best when run directly in your terminal:

**macOS/Linux:**

```bash
cd /path/to/blit-tech
node tools/convert-bmfont.mjs input.fnt output.btfont --embed
```

**Windows (PowerShell):**

```powershell
cd D:\path\to\blit-tech
node tools/convert-bmfont.mjs input.fnt output.btfont --embed
```

**Windows (CMD):**

```cmd
cd D:\path\to\blit-tech
node tools\convert-bmfont.mjs input.fnt output.btfont --embed
```

> **Note:** For best results with file I/O operations, running Node.js scripts directly from your terminal (not through
> an IDE's embedded shell) is recommended.

### Manual Conversion

If you prefer to convert manually:

1. **Parse the `.fnt` XML file** to extract:

- Font info: `face`, `size` from `<info>`
- Metrics: `lineHeight`, `base` from `<common>`
- Glyphs: All `<char>` elements

2. **For each `<char>` element**, create a glyph entry:

   ```xml
   <char id="65" x="80" y="18" width="9" height="17" xoffset="-1" yoffset="-1" xadvance="7" />
   ```

   Becomes:

   ```json
   "A": { "x": 80, "y": 18, "w": 9, "h": 17, "ox": -1, "oy": -1, "adv": 7 }
   ```

3. **Set the texture path** to the PNG filename, or embed it as base64.

## Creating Bitmap Fonts

### Recommended Tools

1. **[BMFont](https://www.angelcode.com/products/bmfont/)** (Windows)

- The original bitmap font generator
- Export as XML format, then convert to `.btfont`

2. **[Hiero](https://libgdx.com/wiki/tools/hiero)** (Cross-platform)

- Java-based, works on Mac/Linux/Windows
- Export as BMFont format

3. **[ShoeBox](https://renderhjs.net/shoebox/)** (Cross-platform)

- Adobe AIR application
- Can create bitmap fonts from existing images

4. **Custom Font Editor** (Coming Soon)

- Blit-Tech will include its own font editor
- Native `.btfont` export with embedded textures

### Tips for Creating Fonts

1. **Use power-of-two texture sizes** (256×128, 512×256, etc.) for best GPU compatibility

2. **Include an outline** (1-2px) for better readability on varied backgrounds

3. **Export with padding** between characters to prevent bleeding artifacts

4. **Use white glyphs** on transparent background - colors are applied at render time via tinting

5. **Include common symbols** beyond ASCII: `×`, `÷`, `·`, `—`, `…`, etc.

## API Reference

### BitmapFont

```typescript
class BitmapFont {
  // Load from .btfont file
  static async load(url: string): Promise<BitmapFont>;

  // Properties
  readonly name: string;
  readonly size: number;
  readonly lineHeight: number;
  readonly baseline: number;
  readonly glyphCount: number;

  // Methods
  getGlyph(char: string): Glyph | null;
  measureText(text: string): number;
  measureTextSize(text: string): { width: number; height: number };
  hasGlyph(char: string): boolean;
  getSpriteSheet(): SpriteSheet;
}
```

### BT.printFont()

```typescript
BT.printFont(
  font: BitmapFont,    // The loaded font
  pos: Vector2i,       // Position (top-left corner)
  text: string,        // Text to render
  color?: Color32      // Tint color (default: white)
): void;
```

## Examples

### Multi-line Text

```typescript
const lines = ['Line 1', 'Line 2', 'Line 3'];
let y = 10;

for (const line of lines) {
  BT.printFont(font, new Vector2i(10, y), line, Color32.white());
  y += font.lineHeight;
}
```

### Centered Text

```typescript
const text = 'Centered';
const textWidth = font.measureText(text);
const screenWidth = BT.displaySize().x;
const x = Math.floor((screenWidth - textWidth) / 2);

BT.printFont(font, new Vector2i(x, 10), text, Color32.white());
```

### Rainbow Text Effect

```typescript
let x = 10;
for (let i = 0; i < text.length; i++) {
  const hue = (i * 30 + animTime * 100) % 360;
  const color = hslToRgb(hue, 100, 60);
  const char = text[i];

  BT.printFont(font, new Vector2i(x, 10), char, color);

  const glyph = font.getGlyph(char);
  x += glyph ? glyph.advance : font.size;
}
```

## Troubleshooting

### Font not loading

- Check the browser console for error messages
- Verify the `.btfont` file path is correct (relative to the HTML file)
- Ensure the texture file exists and is accessible

### Characters appear at wrong positions

- Verify `ox` and `oy` (offset) values are correct
- Check that the texture coordinates match the actual glyph positions in the PNG

### Missing characters

- Check if the character is in the font's glyph map
- Use `font.hasGlyph('×')` to test
- Characters not in the font are silently skipped

### Blurry text

- Ensure the canvas is using nearest-neighbor scaling (CSS `image-rendering: pixelated`)
- Use integer positions for `BT.printFont()`
