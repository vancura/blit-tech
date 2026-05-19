import {
    assertImageElementWithinLimits,
    AssetLimitError,
    BTFONT_EMBEDDED_TEXTURE_PREFIX,
    validateBtfontEmbeddedTextureUri,
    validateBtfontGlyphAtlasBounds,
    validateBtfontGlyphDataPreAtlas,
    validateBtfontJsonByteSize,
    validateGlyphCount,
} from '../utils/AssetLimits';
import { btfontGlyphEntryNotObjectError } from '../utils/errorMessages';
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

    // #region Static Factories

    /**
     * Creates a bitmap font synchronously from pre-built glyph data.
     *
     * Used for embedded fonts (e.g. the built-in system font) where the sprite
     * sheet and glyph map are already constructed in memory. The sprite sheet
     * should already contain indexed pixel data via
     * {@link SpriteSheet.fromIndexedPixels}.
     *
     * @param spriteSheet - Texture atlas containing all font glyphs.
     * @param glyphs - Map of character strings to glyph metadata.
     * @param name - Font display name.
     * @param size - Font size in points.
     * @param lineHeight - Vertical spacing between lines in pixels.
     * @param baseline - Distance from top to text baseline in pixels.
     * @returns Fully constructed BitmapFont ready for rendering.
     */
    static createFromGlyphs(
        spriteSheet: SpriteSheet,
        glyphs: Map<string, Glyph>,
        name: string,
        size: number,
        lineHeight: number,
        baseline: number,
    ): BitmapFont {
        const asciiGlyphs: (Glyph | null)[] = new Array<Glyph | null>(ASCII_CACHE_SIZE).fill(null);

        for (const [char, glyph] of glyphs) {
            if (char.length === 1) {
                const code = char.charCodeAt(0);

                if (code < ASCII_CACHE_SIZE) {
                    // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
                    asciiGlyphs[code] = glyph;
                }
            }
        }

        return new BitmapFont(spriteSheet, glyphs, asciiGlyphs, name, size, lineHeight, baseline);
    }

    // #endregion

    // #region Loading

    /**
     * Loads a bitmap font from a `.btfont` JSON file.
     *
     * The font descriptor can reference either an embedded PNG data URI
     * (`data:image/png;base64,...`) or a texture file path relative to the font JSON file.
     *
     * @param url - Path to the .btfont file.
     * @returns Loaded bitmap font instance.
     * @throws Error if the font descriptor or texture cannot be loaded.
     */
    static async load(url: string): Promise<BitmapFont> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(BitmapFont.buildFontLoadErrorMessage(url, response.status));
        }

        const { data, glyphEntries } = BitmapFont.parseBtfontFile(url, await response.text());

        BitmapFont.validateGlyphEntriesPreAtlas(glyphEntries);

        // Load texture - embedded PNG data URIs and relative PNG paths are both allowed.
        const image = await BitmapFont.loadTexture(data.texture, url);
        const spriteSheet = new SpriteSheet(image);
        const atlasWidth = spriteSheet.width;
        const atlasHeight = spriteSheet.height;

        const { glyphs, asciiGlyphs } = BitmapFont.buildGlyphsFromEntries(glyphEntries, atlasWidth, atlasHeight);
        const size = BitmapFont.resolvePositiveFontMetric(data.size, 12);
        const lineHeight = BitmapFont.resolvePositiveFontMetric(data.lineHeight, size);
        const baseline = BitmapFont.resolvePositiveFontMetric(data.baseline, size);

        return new BitmapFont(spriteSheet, glyphs, asciiGlyphs, data.name || 'Unknown', size, lineHeight, baseline);
    }

    // #region Loading Helpers

    /**
     * Coerces a `.btfont` metadata field to a positive finite number.
     *
     * @param value - Raw JSON value for `size`, `lineHeight`, or `baseline`.
     * @param fallback - Value used when `value` is missing or invalid.
     * @returns Safe positive metric for {@link BitmapFont} construction.
     */
    private static resolvePositiveFontMetric(value: unknown, fallback: number): number {
        const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        return fallback;
    }

    /**
     * Parses and validates a `.btfont` JSON payload after byte-size checks.
     *
     * @param url - Path to the `.btfont` file (used in error messages).
     * @param jsonText - Raw JSON text from the font file.
     * @returns Parsed font descriptor and glyph map entries.
     */
    private static parseBtfontFile(
        url: string,
        jsonText: string,
    ): { data: FontFileData; glyphEntries: Array<[string, GlyphData]> } {
        const jsonByteLength = new TextEncoder().encode(jsonText).length;
        const jsonSizeError = validateBtfontJsonByteSize(jsonByteLength);

        if (jsonSizeError) {
            throw new AssetLimitError(jsonSizeError);
        }

        let data: FontFileData;

        try {
            data = JSON.parse(jsonText) as FontFileData;
        } catch {
            throw new Error(
                `The font file '${url}' is broken or not a valid .btfont file. Check that it's the right file.` +
                    BitmapFont.buildExtensionHint(url, '.btfont'),
            );
        }

        if (
            typeof data.texture !== 'string' ||
            data.texture.length === 0 ||
            data.glyphs === null ||
            typeof data.glyphs !== 'object' ||
            Array.isArray(data.glyphs)
        ) {
            throw new Error(
                `The font file '${url}' is broken or not a valid .btfont file. Check that it's the right file.` +
                    BitmapFont.buildExtensionHint(url, '.btfont'),
            );
        }

        const glyphEntries = Object.entries(data.glyphs);
        const glyphCountError = validateGlyphCount(glyphEntries.length);

        if (glyphCountError) {
            throw new AssetLimitError(glyphCountError);
        }

        const embeddedTextureError = validateBtfontEmbeddedTextureUri(data.texture);

        if (embeddedTextureError) {
            throw new AssetLimitError(embeddedTextureError);
        }

        return { data, glyphEntries };
    }

    /**
     * Validates glyph entries before the font atlas image is decoded.
     *
     * @param glyphEntries - Glyph map entries from the parsed font file.
     */
    private static validateGlyphEntriesPreAtlas(glyphEntries: Array<[string, GlyphData]>): void {
        for (const [char, glyphData] of glyphEntries) {
            if (glyphData === null || typeof glyphData !== 'object' || Array.isArray(glyphData)) {
                throw new AssetLimitError(btfontGlyphEntryNotObjectError(BitmapFont.formatGlyphCharLabel(char)));
            }

            const glyphError = validateBtfontGlyphDataPreAtlas(glyphData, BitmapFont.formatGlyphCharLabel(char));

            if (glyphError) {
                throw new AssetLimitError(glyphError);
            }
        }
    }

    /**
     * Converts validated `.btfont` glyph entries into runtime glyph maps.
     *
     * @param glyphEntries - Glyph map entries from the parsed font file.
     * @param atlasWidth - Font texture atlas width in pixels.
     * @param atlasHeight - Font texture atlas height in pixels.
     * @returns Glyph lookup tables for Unicode and ASCII fast paths.
     */
    private static buildGlyphsFromEntries(
        glyphEntries: Array<[string, GlyphData]>,
        atlasWidth: number,
        atlasHeight: number,
    ): { glyphs: Map<string, Glyph>; asciiGlyphs: (Glyph | null)[] } {
        const glyphs = new Map<string, Glyph>();
        const asciiGlyphs: (Glyph | null)[] = new Array<Glyph | null>(ASCII_CACHE_SIZE).fill(null);

        for (const [char, glyphData] of glyphEntries) {
            const glyphError = validateBtfontGlyphAtlasBounds(
                glyphData,
                atlasWidth,
                atlasHeight,
                BitmapFont.formatGlyphCharLabel(char),
            );

            if (glyphError) {
                throw new AssetLimitError(glyphError);
            }

            const glyph: Glyph = {
                rect: new Rect2i(glyphData.x, glyphData.y, glyphData.w, glyphData.h),
                offsetX: glyphData.ox,
                offsetY: glyphData.oy,
                advance: glyphData.adv,
            };

            glyphs.set(char, glyph);

            if (char.length === 1) {
                const code = char.charCodeAt(0);

                if (code < ASCII_CACHE_SIZE) {
                    // eslint-disable-next-line security/detect-object-injection -- Index is bounds-checked above
                    asciiGlyphs[code] = glyph;
                }
            }
        }

        return { glyphs, asciiGlyphs };
    }

    /**
     * Loads a texture from either a base64 data URI or a relative path.
     *
     * @param texture - Data URI (starts with "data:") or relative path.
     * @param fontUrl - URL of the .btfont file (used to resolve relative paths).
     * @returns Loaded texture image for the font atlas.
     */
    private static loadTexture(texture: string, fontUrl: string): Promise<HTMLImageElement> {
        // Embedded PNG data URIs are validated in parseBtfontFile before decode.
        if (texture.startsWith(BTFONT_EMBEDDED_TEXTURE_PREFIX)) {
            return BitmapFont.loadImage(texture);
        }

        // Otherwise, resolve the path relative to the font file.
        const baseUrl = fontUrl.substring(0, fontUrl.lastIndexOf('/') + 1);
        const textureUrl = baseUrl + texture;

        return BitmapFont.loadImage(textureUrl);
    }

    /**
     * Returns a user-friendly load error for a font request.
     *
     * @param url - Font file path that failed to load.
     * @param status - HTTP status code from fetch.
     * @returns Beginner-friendly message with useful hints.
     */
    private static buildFontLoadErrorMessage(url: string, status: number): string {
        const statusMessage =
            status === 404
                ? `Can't find the font file '${url}'. Check that the file exists and the path is spelled correctly.`
                : `The server had a problem loading the font file '${url}'. Try refreshing the page.`;

        const hints: string[] = [];
        const pathHint = BitmapFont.buildPathHint(url, 'fonts');
        const extensionHint = BitmapFont.buildExtensionHint(url, '.btfont');

        if (pathHint) {
            hints.push(pathHint);
        }

        if (extensionHint) {
            hints.push(extensionHint);
        }

        return hints.length > 0 ? `${statusMessage} ${hints.join(' ')}` : statusMessage;
    }

    /**
     * Suggests common absolute and relative URL forms when the path looks ambiguous.
     *
     * @param url - Original URL string.
     * @param folderName - Typical folder prefix to suggest.
     * @returns Hint text or an empty string.
     */
    private static buildPathHint(url: string, folderName: string): string {
        if (BitmapFont.isExplicitUrl(url) || url.startsWith('/') || url.startsWith('./')) {
            return '';
        }

        return `Did you mean '/${folderName}/${url}' or './${folderName}/${url}'?`;
    }

    /**
     * Suggests a corrected extension when the URL uses a different file type.
     *
     * @param url - Original URL string.
     * @param expectedExtension - Extension that should be used.
     * @returns Hint text or an empty string.
     */
    private static buildExtensionHint(url: string, expectedExtension: string): string {
        const slashIndex = url.lastIndexOf('/');
        const rawFileName = slashIndex >= 0 ? url.slice(slashIndex + 1) : url;
        const queryIndex = rawFileName.indexOf('?');
        const hashIndex = rawFileName.indexOf('#');
        const cutIndex =
            queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
        const fileName = cutIndex === -1 ? rawFileName : rawFileName.slice(0, cutIndex);
        const dotIndex = fileName.lastIndexOf('.');
        const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';

        if (extension === '' || extension === expectedExtension) {
            return '';
        }

        return `The extension '${extension}' looks wrong for this file. Did you mean '${expectedExtension}'?`;
    }

    /**
     * Formats a glyph character label for user-facing validation errors.
     *
     * @param char - Glyph map key from the `.btfont` file.
     * @returns Printable label or a Unicode code point for control characters.
     */
    private static formatGlyphCharLabel(char: string): string {
        if (char.length === 1) {
            const code = char.charCodeAt(0);

            if (code < 32 || code === 127) {
                return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
            }
        }

        return char;
    }

    /**
     * Returns whether the URL already has an explicit scheme or protocol.
     *
     * @param url - URL to inspect.
     * @returns True when no relative-path hint is needed.
     */
    private static isExplicitUrl(url: string): boolean {
        const lowerUrl = url.toLowerCase();
        return (
            lowerUrl.startsWith('//') ||
            lowerUrl.includes('://') ||
            lowerUrl.startsWith('data:') ||
            lowerUrl.startsWith('blob:')
        );
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

            image.onload = () => {
                try {
                    assertImageElementWithinLimits('font texture', image);
                } catch (error) {
                    reject(error);
                    return;
                }

                resolve(image);
            };
            image.onerror = () =>
                reject(
                    new Error(
                        `Can't find the font texture image '${src.substring(0, 50)}'. ` +
                            'Check for typos, wrong letter casing, or a missing file extension.',
                    ),
                );

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
                // Unicode fallback - index is guaranteed valid within loop bounds.
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
