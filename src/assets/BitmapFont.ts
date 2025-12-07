import { Rect2i } from '../utils/Rect2i';
import { SpriteSheet } from './SpriteSheet';

// #region Type Definitions

/**
 * Glyph data for a single character in a bitmap font.
 * Contains texture coordinates, dimensions, rendering offsets, and advance width.
 */
export interface Glyph {
    /** Source rectangle in the font texture atlas. */
    rect: Rect2i;

    /** Horizontal offset from the pen position when rendering. */
    offsetX: number;

    /** Vertical offset from the pen position when rendering. */
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
     * - Relative path to the PNG file (resolved relative to .btfont file)
     */
    texture: string;

    /** Map of character to glyph data. Supports Unicode characters as keys. */
    glyphs: Record<string, GlyphData>;
}

/**
 * Result object for text size measurements.
 * Reused to avoid allocations in hot paths.
 */
export interface TextSize {
    /** Width of the text in pixels. */
    width: number;

    /** Height of the text in pixels. */
    height: number;
}

// #endregion

// #region Constants

/** Maximum number of cached measurement results. */
const MAX_MEASURE_CACHE_SIZE = 256;

/** Number of ASCII characters to cache for fast lookup. */
const ASCII_CACHE_SIZE = 128;

// #endregion

/**
 * Modern bitmap font for variable-width text rendering.
 *
 * Loads from `.btfont` JSON files with embedded base64 textures.
 * Supports Unicode characters and per-glyph rendering offsets.
 *
 * Performance optimizations:
 * - ASCII glyphs cached in a direct array for O(1) lookup
 * - Text measurement results cached with LRU eviction
 * - Reusable result objects to minimize allocations
 * - Optimized loops using charCodeAt for ASCII text
 *
 * @example
 * ```typescript
 * const font = await BitmapFont.load('fonts/MyFont.btfont');
 * BT.printFont(font, new Vector2i(10, 10), 'Hello World!', Color32.white());
 * ```
 */
export class BitmapFont {
    // #region Module State

    /** Sprite sheet containing the font texture atlas. */
    private spriteSheet: SpriteSheet;

    /** Map of character strings to glyph metadata (for Unicode characters). */
    private glyphs: Map<string, Glyph> = new Map();

    /** Direct array lookup for ASCII characters (codes 0-127) for fast access. */
    private asciiGlyphs: (Glyph | null)[] = new Array<Glyph | null>(ASCII_CACHE_SIZE).fill(null);

    /** Cache for text measurement results to avoid repeated calculations. */
    private measureCache: Map<string, number> = new Map();

    /** Reusable result object for measureTextSize to avoid allocations. */
    private readonly textSizeResult: TextSize = { width: 0, height: 0 };

    /** Font display name. */
    public readonly name: string;

    /** Original font size in points. */
    public readonly size: number;

    /** Pixels between baselines for multi-line text. */
    public readonly lineHeight: number;

    /** Pixels from top of line to baseline. */
    public readonly baseline: number;

    // #endregion

    // #region Constructor

    /**
     * Creates a BitmapFont instance.
     * Use the static `load()` method to load from a .btfont file.
     *
     * @param spriteSheet - Texture atlas containing all font glyphs.
     * @param glyphs - Map of character strings to glyph metadata.
     * @param asciiGlyphs - Pre-populated ASCII lookup array.
     * @param name - Font display name.
     * @param size - Original font size in points.
     * @param lineHeight - Vertical spacing between lines.
     * @param baseline - Distance from top to text baseline.
     */
    private constructor(
        spriteSheet: SpriteSheet,
        glyphs: Map<string, Glyph>,
        asciiGlyphs: (Glyph | null)[],
        name: string,
        size: number,
        lineHeight: number,
        baseline: number,
    ) {
        this.spriteSheet = spriteSheet;
        this.glyphs = glyphs;
        this.asciiGlyphs = asciiGlyphs;
        this.name = name;
        this.size = size;
        this.lineHeight = lineHeight;
        this.baseline = baseline;
    }

    // #endregion

    // #region Static Factory

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
     * @throws Error if the file can't be loaded or parsed.
     */
    static async load(url: string): Promise<BitmapFont> {
        // Fetch and parse the JSON file.
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to load font: ${url} (${response.status} ${response.statusText})`);
        }

        const data: FontFileData = await response.json();

        // Validate required fields.
        if (!data.texture || !data.glyphs) {
            throw new Error(`Invalid font file: ${url} - missing texture or glyphs`);
        }

        // Load texture – either from data URI or relative path.
        const image = await BitmapFont.loadTexture(data.texture, url);
        const spriteSheet = new SpriteSheet(image);

        // Convert glyph data to internal format.
        const glyphs = new Map<string, Glyph>();
        const asciiGlyphs: (Glyph | null)[] = new Array<Glyph | null>(ASCII_CACHE_SIZE).fill(null);

        for (const [char, glyphData] of Object.entries(data.glyphs)) {
            const glyph: Glyph = {
                rect: new Rect2i(glyphData.x, glyphData.y, glyphData.w, glyphData.h),
                offsetX: glyphData.ox,
                offsetY: glyphData.oy,
                advance: glyphData.adv,
            };

            glyphs.set(char, glyph);

            // Populate the ASCII fast-lookup array for single-byte characters.
            if (char.length === 1) {
                const code = char.charCodeAt(0);

                if (code < ASCII_CACHE_SIZE) {
                    // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
                    asciiGlyphs[code] = glyph;
                }
            }
        }

        return new BitmapFont(
            spriteSheet,
            glyphs,
            asciiGlyphs,
            data.name || 'Unknown',
            data.size || 12,
            data.lineHeight || data.size || 12,
            data.baseline || data.size || 12,
        );
    }

    // #endregion

    // #region Helper Functions

    /**
     * Loads a texture from either a base64 data URI or a relative path.
     *
     * @param texture - Data URI (starts with "data:") or relative path.
     * @param fontUrl - URL of the .btfont file (used to resolve relative paths).
     * @returns Promise resolving to the loaded HTMLImageElement.
     */
    private static loadTexture(texture: string, fontUrl: string): Promise<HTMLImageElement> {
        // Check if it's a data URI (embedded base64).
        if (texture.startsWith('data:')) {
            return BitmapFont.loadImage(texture);
        }

        // Otherwise, resolve the path relative to the font file.
        const baseUrl = fontUrl.substring(0, fontUrl.lastIndexOf('/') + 1);
        const textureUrl = baseUrl + texture;

        return BitmapFont.loadImage(textureUrl);
    }

    /**
     * Loads an image from a URL or data URI.
     *
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

    // #endregion

    // #region Accessors

    /**
     * Gets glyph information for a specific character.
     * Uses fast array lookup for ASCII characters, falls back to Map for Unicode.
     *
     * @param char - Single character to look up (supports Unicode).
     * @returns Glyph data with source rect, offsets and advance, or null if not found.
     */
    getGlyph(char: string): Glyph | null {
        // Fast path for ASCII characters.
        if (char.length === 1) {
            const code = char.charCodeAt(0);

            if (code < ASCII_CACHE_SIZE) {
                // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
                return this.asciiGlyphs[code] ?? null;
            }
        }

        // Fallback for Unicode characters.
        return this.glyphs.get(char) ?? null;
    }

    /**
     * Gets glyph information by character code.
     * Optimized for hot paths where character code is already known.
     *
     * @param charCode - Character code to look up.
     * @returns Glyph data or null if not found.
     */
    getGlyphByCode(charCode: number): Glyph | null {
        // Fast path for ASCII.
        if (charCode < ASCII_CACHE_SIZE) {
            // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
            return this.asciiGlyphs[charCode] ?? null;
        }

        // Fallback for Unicode - convert code to character.
        return this.glyphs.get(String.fromCharCode(charCode)) ?? null;
    }

    /**
     * Gets the underlying sprite sheet for rendering.
     *
     * @returns The font's texture atlas as a SpriteSheet.
     */
    getSpriteSheet(): SpriteSheet {
        return this.spriteSheet;
    }

    /**
     * Gets the number of glyphs in this font.
     *
     * @returns Total glyph count.
     */
    get glyphCount(): number {
        return this.glyphs.size;
    }

    // #endregion

    // #region Text Measurement

    /**
     * Measures the pixel width of a text string.
     * Results are cached for frequently measured strings.
     * Uses optimized charCodeAt loop for better performance.
     *
     * @param text - String to measure.
     * @returns Total width in pixels.
     */
    measureText(text: string): number {
        // Check the cache first.
        const cached = this.measureCache.get(text);

        if (cached !== undefined) {
            return cached;
        }

        // Calculate width using optimized loop.
        let width = 0;
        const len = text.length;

        for (let i = 0; i < len; i++) {
            const code = text.charCodeAt(i);
            let glyph: Glyph | null = null;

            // Fast path for ASCII characters.
            if (code < ASCII_CACHE_SIZE) {
                // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
                glyph = this.asciiGlyphs[code] ?? null;
            } else {
                // Unicode fallback – index is guaranteed valid within loop bounds.
                // eslint-disable-next-line security/detect-object-injection -- Index is within loop bounds
                const char = text[i];

                if (char !== undefined) {
                    glyph = this.glyphs.get(char) ?? null;
                }
            }

            if (glyph) {
                width += glyph.advance;
            }
        }

        // Cache the result with FIFO eviction when full.
        if (this.measureCache.size >= MAX_MEASURE_CACHE_SIZE) {
            // Remove oldest inserted entry (first key in Map insertion order).
            const firstKey = this.measureCache.keys().next().value;

            if (firstKey !== undefined) {
                this.measureCache.delete(firstKey);
            }
        }

        this.measureCache.set(text, width);

        return width;
    }

    /**
     * Measures the pixel dimensions of a text string.
     * For single-line text, height equals lineHeight.
     *
     * WARNING: Returns a reusable internal object to avoid allocations.
     * Don't store the returned reference – copy the values if needed.
     *
     * @param text - String to measure.
     * @returns Object with width and height in pixels (reused, don't store reference).
     */
    measureTextSize(text: string): TextSize {
        this.textSizeResult.width = this.measureText(text);
        this.textSizeResult.height = this.lineHeight;

        return this.textSizeResult;
    }

    /**
     * Measures the pixel dimensions of a text string and copies to the provided object.
     * Use this when you need to store the result.
     *
     * @param text - String to measure.
     * @param result - Object to store the result in.
     * @returns The result object with width and height populated.
     */
    measureTextSizeInto(text: string, result: TextSize): TextSize {
        result.width = this.measureText(text);
        result.height = this.lineHeight;

        return result;
    }

    /**
     * Checks if the font contains a glyph for the given character.
     * Uses fast ASCII lookup when possible.
     *
     * @param char - Character to check.
     * @returns True if the font can render this character.
     */
    hasGlyph(char: string): boolean {
        // Fast path for ASCII.
        if (char.length === 1) {
            const code = char.charCodeAt(0);

            if (code < ASCII_CACHE_SIZE) {
                // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
                return (this.asciiGlyphs[code] ?? null) !== null;
            }
        }

        return this.glyphs.has(char);
    }

    /**
     * Clears the text measurement cache.
     * Call this if font metrics change or to free memory.
     */
    clearMeasureCache(): void {
        this.measureCache.clear();
    }

    // #endregion
}
