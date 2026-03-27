import { Rect2i } from '../utils/Rect2i';
import { SpriteSheet } from './SpriteSheet';

// #region Type Definitions

/**
 * Runtime glyph metadata used by the renderer.
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
 * Serialized glyph entry stored in `.btfont` files.
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
 * Serialized bitmap-font descriptor loaded from disk.
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
 * Measured text dimensions in pixels.
 */
export interface TextSize {
    /** Width of the text in pixels. */
    width: number;

    /** Height of the text in pixels. */
    height: number;
}

// #endregion

// #region Constants

/**
 * Maximum number of cached string-width measurements retained at once.
 *
 * The cache uses insertion order and evicts the oldest entry when it reaches
 * this limit.
 */
const MAX_MEASURE_CACHE_SIZE = 256;

/**
 * Size of the direct lookup table used for ASCII glyphs (`0-127`).
 */
const ASCII_CACHE_SIZE = 128;

// #endregion

/**
 * Bitmap font backed by a sprite-sheet texture atlas.
 *
 * The class is responsible for:
 * - loading `.btfont` metadata and its referenced texture
 * - exposing glyph lookup by character or character code
 * - measuring string widths with a small reusable cache
 * - providing the underlying {@link SpriteSheet} used for rendering glyph quads
 */
export class BitmapFont {
    // #region Module State

    /** Font display name. */
    public readonly name: string;

    /** Original font size in points. */
    public readonly size: number;

    /** Pixels between baselines for multi-line text. */
    public readonly lineHeight: number;

    /** Pixels from top of line to baseline. */
    public readonly baseline: number;

    /** Sprite sheet containing the font texture atlas. */
    private readonly spriteSheet: SpriteSheet;

    /** Map of character strings to glyph metadata (for Unicode characters). */
    private glyphs: Map<string, Glyph> = new Map();

    /** Direct array lookup for ASCII characters (codes 0-127) for fast access. */
    private readonly asciiGlyphs: (Glyph | null)[] = new Array<Glyph | null>(ASCII_CACHE_SIZE).fill(null);

    /** Cache for text measurement results to avoid repeated calculations. */
    private measureCache: Map<string, number> = new Map();

    /** Reusable result object for measureTextSize to avoid allocations. */
    private readonly textSizeResult: TextSize = { width: 0, height: 0 };

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

    // #region Metadata

    /**
     * Returns the total number of glyphs loaded into the font.
     *
     * @returns Total glyph count.
     */
    get glyphCount(): number {
        return this.glyphs.size;
    }

    // #endregion

    // #region Loading

    /**
     * Loads a bitmap font from a `.btfont` JSON file.
     *
     * The font descriptor can reference either an embedded data URI or a
     * texture file path relative to the font JSON file.
     *
     * @param url - Path to the .btfont file.
     * @returns Loaded bitmap font instance.
     * @throws Error if the font descriptor or texture cannot be loaded.
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

    // #region Loading Helpers

    /**
     * Loads a texture from either a base64 data URI or a relative path.
     *
     * @param texture - Data URI (starts with "data:") or relative path.
     * @param fontUrl - URL of the .btfont file (used to resolve relative paths).
     * @returns Loaded texture image for the font atlas.
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

    // #endregion

    // #region Glyph Access

    /**
     * Loads an image from a URL or data URI.
     *
     * @param src - Image source (URL or data URI).
     * @returns Loaded image element for the font texture.
     */
    private static loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load font texture: ${src.substring(0, 50)}`));

            image.src = src;
        });
    }

    /**
     * Returns glyph data for a character.
     *
     * Uses the ASCII lookup table for single-byte characters and falls back to
     * the Unicode glyph map for everything else.
     *
     * @param char - Single character to look up (supports Unicode).
     * @returns Glyph metadata, or `null` when the font does not contain the character.
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
     * Returns glyph data by numeric character code.
     *
     * Uses the ASCII lookup table for codes below `128` and falls back to the
     * Unicode glyph map for all other values.
     *
     * @param charCode - Character code to look up.
     * @returns Glyph metadata, or `null` when no glyph exists for the code.
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
     * Returns the sprite sheet that owns the font texture atlas.
     *
     * @returns Sprite sheet used when rendering glyph quads.
     */
    getSpriteSheet(): SpriteSheet {
        return this.spriteSheet;
    }

    // #endregion

    // #region Text Measurement

    /**
     * Measures the horizontal pixel width of a text string.
     *
     * Results are cached for repeated measurements and use an optimized ASCII
     * fast path during width calculation.
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
     * Measures the pixel size of a single-line text string.
     *
     * Returns a reusable internal object to avoid allocations. Copy the values
     * before calling `measureTextSize()` again if you need to retain them.
     *
     * @param text - String to measure.
     * @returns Reused width/height pair for the measured text.
     */
    measureTextSize(text: string): TextSize {
        this.textSizeResult.width = this.measureText(text);
        this.textSizeResult.height = this.lineHeight;

        return this.textSizeResult;
    }

    /**
     * Measures the pixel size of a single-line text string into a caller-owned object.
     *
     * @param text - String to measure.
     * @param result - Object that receives the measured width and height.
     * @returns The same `result` object after being populated.
     */
    measureTextSizeInto(text: string, result: TextSize): TextSize {
        result.width = this.measureText(text);
        result.height = this.lineHeight;

        return result;
    }

    /**
     * Checks whether the font contains a glyph for a character.
     *
     * Uses the same ASCII fast path as `getGlyph()` for single-byte characters.
     *
     * @param char - Character to check.
     * @returns `true` if the font can render the character.
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
     * Clears cached text measurement results.
     *
     * Useful after profiling, tests, or when you want to bound cache growth
     * across distinct text workloads.
     */
    clearMeasureCache(): void {
        this.measureCache.clear();
    }

    // #endregion
}
