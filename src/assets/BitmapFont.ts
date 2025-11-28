import { Rect2i } from '../utils/Rect2i';
import { SpriteSheet } from './SpriteSheet';

/**
 * Glyph data for a single character in a bitmap font.
 * Contains texture coordinates, dimensions, rendering offsets, and advance width.
 */
export interface Glyph {
    /** Source rectangle in the font texture atlas. */
    rect: Rect2i;

    /** Horizontal offset from pen position when rendering. */
    offsetX: number;

    /** Vertical offset from pen position when rendering. */
    offsetY: number;

    /** Horizontal advance after drawing (distance to next character). */
    advance: number;
}

/**
 * Raw glyph data as stored in the .btfont JSON file.
 * Uses short property names for compact file size.
 */
interface GlyphData {
    /** X position in texture atlas. */
    x: number;

    /** Y position in texture atlas. */
    y: number;

    /** Width of glyph in pixels. */
    w: number;

    /** Height of glyph in pixels. */
    h: number;

    /** Horizontal offset when rendering. */
    ox: number;

    /** Vertical offset when rendering. */
    oy: number;

    /** Horizontal advance width. */
    adv: number;
}

/**
 * Font file format (.btfont) structure.
 * JSON file with texture reference (embedded base64 or relative path).
 */
interface FontFileData {
    /** Font display name. */
    name: string;

    /** Original font size in points. */
    size: number;

    /** Pixels between baselines for multi-line text. */
    lineHeight: number;

    /** Pixels from top of line to baseline (for alignment). */
    baseline: number;

    /**
     * Texture source. Can be:
     * - Base64-encoded PNG data URI (e.g., "data:image/png;base64,...")
     * - Relative path to PNG file (resolved relative to .btfont file)
     */
    texture: string;

    /** Map of character to glyph data. Supports Unicode characters as keys. */
    glyphs: Record<string, GlyphData>;
}

/**
 * Modern bitmap font for variable-width text rendering.
 *
 * Loads from `.btfont` JSON files with embedded base64 textures.
 * Supports Unicode characters and per-glyph rendering offsets.
 *
 * @example
 * ```typescript
 * const font = await BitmapFont.load('fonts/MyFont.btfont');
 * BT.printFont(font, new Vector2i(10, 10), 'Hello World!', Color32.white());
 * ```
 */
export class BitmapFont {
    private spriteSheet: SpriteSheet;
    private glyphs: Map<string, Glyph> = new Map();

    /** Font display name. */
    public readonly name: string;

    /** Original font size in points. */
    public readonly size: number;

    /** Pixels between baselines for multi-line text. */
    public readonly lineHeight: number;

    /** Pixels from top of line to baseline. */
    public readonly baseline: number;

    /**
     * Creates a BitmapFont instance.
     * Use the static `load()` method to load from a .btfont file.
     * @param spriteSheet
     * @param glyphs
     * @param name
     * @param size
     * @param lineHeight
     * @param baseline
     */
    private constructor(
        spriteSheet: SpriteSheet,
        glyphs: Map<string, Glyph>,
        name: string,
        size: number,
        lineHeight: number,
        baseline: number,
    ) {
        this.spriteSheet = spriteSheet;
        this.glyphs = glyphs;
        this.name = name;
        this.size = size;
        this.lineHeight = lineHeight;
        this.baseline = baseline;
    }

    /**
     * Loads a bitmap font from a .btfont JSON file.
     *
     * The file format is a JSON object with:
     * - `name`: Font display name
     * - `size`: Original font size in points
     * - `lineHeight`: Pixels between baselines
     * - `baseline`: Pixels from top to baseline
     * - `texture`: Base64 data URI or relative path to PNG
     * - `glyphs`: Map of character to glyph data
     *
     * @param url - Path to the .btfont file.
     * @returns Promise resolving to the loaded BitmapFont.
     * @throws Error if the file cannot be loaded or parsed.
     */
    static async load(url: string): Promise<BitmapFont> {
        // Fetch and parse the JSON file
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to load font: ${url} (${response.status} ${response.statusText})`);
        }

        const data: FontFileData = await response.json();

        // Validate required fields
        if (!data.texture || !data.glyphs) {
            throw new Error(`Invalid font file: ${url} - missing texture or glyphs`);
        }

        // Load texture - either from data URI or relative path
        const image = await BitmapFont.loadTexture(data.texture, url);
        const spriteSheet = new SpriteSheet(image);

        // Convert glyph data to internal format
        const glyphs = new Map<string, Glyph>();

        for (const [char, glyphData] of Object.entries(data.glyphs)) {
            glyphs.set(char, {
                rect: new Rect2i(glyphData.x, glyphData.y, glyphData.w, glyphData.h),
                offsetX: glyphData.ox,
                offsetY: glyphData.oy,
                advance: glyphData.adv,
            });
        }

        return new BitmapFont(
            spriteSheet,
            glyphs,
            data.name || 'Unknown',
            data.size || 12,
            data.lineHeight || data.size || 12,
            data.baseline || data.size || 12,
        );
    }

    /**
     * Loads a texture from either a base64 data URI or a relative path.
     * @param texture - Data URI (starts with "data:") or relative path.
     * @param fontUrl - URL of the .btfont file (used to resolve relative paths).
     * @returns Promise resolving to the loaded HTMLImageElement.
     */
    private static loadTexture(texture: string, fontUrl: string): Promise<HTMLImageElement> {
        // Check if it's a data URI (embedded base64)
        if (texture.startsWith('data:')) {
            return BitmapFont.loadImage(texture);
        }

        // Otherwise, resolve the path relative to the font file
        const baseUrl = fontUrl.substring(0, fontUrl.lastIndexOf('/') + 1);
        const textureUrl = baseUrl + texture;

        return BitmapFont.loadImage(textureUrl);
    }

    /**
     * Loads an image from a URL or data URI.
     * @param src - Image source (URL or data URI).
     * @returns Promise resolving to the loaded HTMLImageElement.
     */
    private static loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load font texture: ${src.substring(0, 50)}...`));

            image.src = src;
        });
    }

    /**
     * Gets glyph information for a specific character.
     * @param char - Single character to look up (supports Unicode).
     * @returns Glyph data with source rect, offsets, and advance, or null if not found.
     */
    getGlyph(char: string): Glyph | null {
        return this.glyphs.get(char) || null;
    }

    /**
     * Gets the underlying sprite sheet for rendering.
     * @returns The font's texture atlas as a SpriteSheet.
     */
    getSpriteSheet(): SpriteSheet {
        return this.spriteSheet;
    }

    /**
     * Measures the pixel width of a text string.
     * @param text - String to measure.
     * @returns Total width in pixels.
     */
    measureText(text: string): number {
        let width = 0;

        for (const char of text) {
            const glyph = this.glyphs.get(char);

            if (glyph) {
                width += glyph.advance;
            }
        }

        return width;
    }

    /**
     * Measures the pixel dimensions of a text string.
     * For single-line text, height equals lineHeight.
     * @param text - String to measure.
     * @returns Object with width and height in pixels.
     */
    measureTextSize(text: string): { width: number; height: number } {
        return {
            width: this.measureText(text),
            height: this.lineHeight,
        };
    }

    /**
     * Checks if the font contains a glyph for the given character.
     * @param char - Character to check.
     * @returns True if the font can render this character.
     */
    hasGlyph(char: string): boolean {
        return this.glyphs.has(char);
    }

    /**
     * Gets the number of glyphs in this font.
     * @returns Total glyph count.
     */
    get glyphCount(): number {
        return this.glyphs.size;
    }
}
