/**
 * 32-bit RGBA color with 8-bit channels (0-255).
 * Inspired by RetroBlit's Color32.
 *
 * Performance notes:
 * - Use static color constants like white or black—they return cached singletons.
 * - Use fromRGBAUnchecked() for trusted values in hot paths to skip validation.
 * - Use writeToFloat32Array() to write to pre-allocated buffers instead of allocating.
 */

// #region Constants

/**
 * Reciprocal of 255 for fast normalization (1/255).
 * Multiplication is faster than division in most JavaScript engines.
 * Exported for use in other color-related utilities.
 */
export const INV_255 = 1 / 255;

/**
 * Pre-computed hex lookup table for fast byte-to-hex conversion.
 * Trades ~2 KB memory for faster hex string generation.
 */
const HEX_TABLE: string[] = new Array(256);
for (let i = 0; i < 256; i++) {
    HEX_TABLE[i] = i.toString(16).padStart(2, '0'); // eslint-disable-line security/detect-object-injection
}

// #endregion

// #region Color32 Class

/**
 * 32-bit RGBA color with 8-bit channels (0-255).
 * Provides comprehensive color manipulation and conversion utilities.
 */
export class Color32 {
    // #region Static Color Constants

    /** The cached singleton for white color. */
    private static readonly _white: Color32 = Object.freeze(Color32.fromRGBAUnchecked(255, 255, 255, 255));

    /** The cached singleton for black color. */
    private static readonly _black: Color32 = Object.freeze(Color32.fromRGBAUnchecked(0, 0, 0, 255));

    /** The cached singleton for transparent color. */
    private static readonly _transparent: Color32 = Object.freeze(Color32.fromRGBAUnchecked(0, 0, 0, 0));

    /** The cached singleton for red color. */
    private static readonly _red: Color32 = Object.freeze(Color32.fromRGBAUnchecked(255, 0, 0, 255));

    /** The cached singleton for green color. */
    private static readonly _green: Color32 = Object.freeze(Color32.fromRGBAUnchecked(0, 255, 0, 255));

    /** The cached singleton for blue color. */
    private static readonly _blue: Color32 = Object.freeze(Color32.fromRGBAUnchecked(0, 0, 255, 255));

    /** The cached singleton for yellow color. */
    private static readonly _yellow: Color32 = Object.freeze(Color32.fromRGBAUnchecked(255, 255, 0, 255));

    /** The cached singleton for cyan color. */
    private static readonly _cyan: Color32 = Object.freeze(Color32.fromRGBAUnchecked(0, 255, 255, 255));

    /** Cached singleton for magenta color. */
    private static readonly _magenta: Color32 = Object.freeze(Color32.fromRGBAUnchecked(255, 0, 255, 255));

    // #endregion

    // #region Instance Properties

    /** Red channel (0-255). */
    public r: number;

    /** Green channel (0-255). */
    public g: number;

    /** Blue channel (0-255). */
    public b: number;

    /** Alpha channel (0-255). */
    public a: number;

    // #endregion

    // #region Constructor

    /**
     * Creates a new 32-bit RGBA color.
     * All values are clamped to 0-255 range and truncated to integers.
     *
     * @param r - Red channel (0-255, defaults to 255).
     * @param g - Green channel (0-255, defaults to 255).
     * @param b - Blue channel (0-255, defaults to 255).
     * @param a - Alpha channel (0-255, defaults to 255 = opaque).
     */
    constructor(r: number = 255, g: number = 255, b: number = 255, a: number = 255) {
        // Clamp and truncate to integer using optimized clampByte helper.
        this.r = clampByte(r);
        this.g = clampByte(g);
        this.b = clampByte(b);
        this.a = clampByte(a);
    }

    // #endregion

    // #region Static Color Getters

    /**
     * Returns pure white color (255, 255, 255, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque white color (cached).
     */
    static white(): Color32 {
        return Color32._white;
    }

    /**
     * Returns pure black color (0, 0, 0, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque black color (cached).
     */
    static black(): Color32 {
        return Color32._black;
    }

    /**
     * Returns fully transparent color (0, 0, 0, 0).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Transparent black color (cached).
     */
    static transparent(): Color32 {
        return Color32._transparent;
    }

    /**
     * Returns pure red color (255, 0, 0, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque red color (cached).
     */
    static red(): Color32 {
        return Color32._red;
    }

    /**
     * Returns pure green color (0, 255, 0, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque green color (cached).
     */
    static green(): Color32 {
        return Color32._green;
    }

    /**
     * Returns pure blue color (0, 0, 255, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque blue color (cached).
     */
    static blue(): Color32 {
        return Color32._blue;
    }

    /**
     * Returns yellow color (255, 255, 0, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque yellow color (cached).
     */
    static yellow(): Color32 {
        return Color32._yellow;
    }

    /**
     * Returns cyan color (0, 255, 255, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque cyan color (cached).
     */
    static cyan(): Color32 {
        return Color32._cyan;
    }

    /**
     * Returns magenta color (255, 0, 255, 255).
     * Returns a cached frozen singleton - do not modify.
     *
     * @returns Opaque magenta color (cached).
     */
    static magenta(): Color32 {
        return Color32._magenta;
    }

    /**
     * Creates a grayscale color with equal RGB values.
     *
     * @param value - Brightness level (0-255).
     * @returns Opaque gray color.
     */
    static gray(value: number): Color32 {
        return new Color32(value, value, value, 255);
    }

    // #endregion

    // #region Static Factory Methods

    /**
     * Creates a Color32 from RGBA values without validation or clamping.
     * Use this in hot paths when values are guaranteed to be valid integers 0-255.
     *
     * WARNING: Passing invalid values will result in undefined behavior.
     * Only use when certain the values are valid.
     *
     * @param r - Red channel (must be integer 0-255).
     * @param g - Green channel (must be integer 0-255).
     * @param b - Blue channel (must be integer 0-255).
     * @param a - Alpha channel (must be integer 0-255).
     * @returns New Color32 with the specified values.
     */
    static fromRGBAUnchecked(r: number, g: number, b: number, a: number): Color32 {
        const color = Object.create(Color32.prototype) as Color32;
        color.r = r;
        color.g = g;
        color.b = b;
        color.a = a;

        return color;
    }

    /**
     * Creates a color from a packed 32-bit unsigned integer (ABGR format).
     * Inverse of toUint32().
     *
     * @param uint32 - Packed color value (A << 24 | B << 16 | G << 8 | R).
     * @returns New color unpacked from the integer.
     */
    static fromUint32(uint32: number): Color32 {
        return Color32.fromRGBAUnchecked(
            uint32 & 0xff, // R.
            (uint32 >>> 8) & 0xff, // G.
            (uint32 >>> 16) & 0xff, // B.
            (uint32 >>> 24) & 0xff, // A.
        );
    }

    /**
     * Parses a CSS hex color string into a Color32.
     * Supports formats: #RGB, #RGBA, #RRGGBB, #RRGGBBAA.
     *
     * @param hex - Hex color string with or without leading #.
     * @returns Parsed color.
     * @throws Error if the hex string format is invalid.
     */
    static fromHex(hex: string): Color32 {
        // Skip # if present (charCode 35 = '#').
        const start = hex.charCodeAt(0) === 35 ? 1 : 0;
        const len = hex.length - start;

        let r: number;
        let g: number;
        let b: number;
        let a: number = 255;

        if (len === 6 || len === 8) {
            // Parse RGB as a single integer, then extract bytes (reduces parseInt calls).
            const rgb = parseInt(hex.substring(start, start + 6), 16);

            if (Number.isNaN(rgb)) {
                throw new Error(`Invalid hex color: ${hex}`);
            }

            r = (rgb >> 16) & 0xff;
            g = (rgb >> 8) & 0xff;
            b = rgb & 0xff;

            if (len === 8) {
                a = parseInt(hex.substring(start + 6, start + 8), 16);

                if (Number.isNaN(a)) {
                    throw new Error(`Invalid hex color: ${hex}`);
                }
            }
        } else if (len === 3 || len === 4) {
            // Parse RGB as a single integer, then extract nibbles and expand to bytes.
            // For a short hex, each digit represents a nibble that expands: F -> FF (0xF * 17 = 0xFF).
            const rgb = parseInt(hex.substring(start, start + 3), 16);

            if (Number.isNaN(rgb)) {
                throw new Error(`Invalid hex color: ${hex}`);
            }

            r = ((rgb >> 8) & 0xf) * 17;
            g = ((rgb >> 4) & 0xf) * 17;
            b = (rgb & 0xf) * 17;

            if (len === 4) {
                const parsedA = parseInt(hex.charAt(start + 3), 16);

                if (Number.isNaN(parsedA)) {
                    throw new Error(`Invalid hex color: ${hex}`);
                }

                a = parsedA * 17;
            }
        } else {
            throw new Error(`Invalid hex color: ${hex}`);
        }

        // Validation passed, use unchecked factory.
        return Color32.fromRGBAUnchecked(r, g, b, a);
    }

    /**
     * Creates a color from normalized float values (0.0-1.0 range).
     * Useful when working with shader outputs or HDR values.
     *
     * @param r - Red channel (0.0-1.0).
     * @param g - Green channel (0.0-1.0).
     * @param b - Blue channel (0.0-1.0).
     * @param a - Alpha channel (0.0-1.0, defaults to 1.0).
     * @returns New color converted from float values.
     */
    static fromFloat(r: number, g: number, b: number, a: number = 1): Color32 {
        return new Color32(r * 255, g * 255, b * 255, a * 255);
    }

    /**
     * Creates a color from HSL (Hue, Saturation, Lightness) values.
     * Useful for generating colors based on color-wheel positions.
     *
     * @param h - Hue in degrees (0-360).
     * @param s - Saturation as percentage (0-100).
     * @param l - Lightness as percentage (0-100).
     * @param a - Alpha channel (0-255, defaults to 255).
     * @returns New color converted from HSL values.
     */
    static fromHSL(h: number, s: number, l: number, a: number = 255): Color32 {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return new Color32(Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255), a);
    }

    // #endregion

    // #region Conversion Methods

    /**
     * Converts color to Float32Array for WebGPU uniform buffers.
     * Values are normalized to the 0.0-1.0 range.
     *
     * Note: This allocates a new Float32Array. For hot paths, use
     * writeToFloat32Array() with a pre-allocated buffer instead.
     *
     * @returns Float32Array with [r, g, b, a] in 0.0-1.0 range.
     */
    toFloat32Array(): Float32Array {
        return new Float32Array([this.r * INV_255, this.g * INV_255, this.b * INV_255, this.a * INV_255]);
    }

    /**
     * Writes normalized color values to an existing Float32Array.
     * This avoids allocation and is preferred for render loops.
     *
     * Note: For maximum performance in tight loops, consider accessing
     * r/g/b/a directly and dividing by 255 inline to avoid method call overhead.
     *
     * @param target - The Float32Array to write to.
     * @param offset - Starting index in the array (default: 0).
     */
    writeToFloat32Array(target: Float32Array, offset: number = 0): void {
        // Using direct index assignment for the best performance.
        // This is safe: offset is truncated to integer, the target is a typed Float32Array.
        const i = offset | 0;
        target[i] = this.r * INV_255; // eslint-disable-line security/detect-object-injection
        target[i + 1] = this.g * INV_255;
        target[i + 2] = this.b * INV_255;
        target[i + 3] = this.a * INV_255;
    }

    /**
     * Converts color to normalized float values (0.0-1.0).
     * Useful for shader uniforms and GPU operations.
     *
     * Note: This allocates a new object. For hot paths, consider
     * accessing r/g/b/a directly and dividing by 255.
     *
     * @returns Object with r, g, b, a properties in 0.0-1.0 range.
     */
    toFloatRGBA(): { r: number; g: number; b: number; a: number } {
        return {
            r: this.r * INV_255,
            g: this.g * INV_255,
            b: this.b * INV_255,
            a: this.a * INV_255,
        };
    }

    /**
     * Packs color into a 32-bit unsigned integer (ABGR format).
     * Little-endian format compatible with typed array views.
     *
     * @returns 32-bit color value as (A << 24 | B << 16 | G << 8 | R).
     */
    toUint32(): number {
        return (this.a << 24) | (this.b << 16) | (this.g << 8) | this.r;
    }

    /**
     * Converts color to CSS hex string format.
     *
     * @returns Hex string in the format "#RRGGBBAA".
     */
    toHex(): string {
        return `#${HEX_TABLE[this.r]}${HEX_TABLE[this.g]}${HEX_TABLE[this.b]}${HEX_TABLE[this.a]}`;
    }

    /**
     * Converts color to CSS rgba() string format.
     * Useful for DOM styling and canvas operations.
     *
     * @returns CSS string in the format "rgba(r, g, b, a)" where a is 0.0-1.0.
     */
    toCSS(): string {
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${(this.a * INV_255).toFixed(3)})`;
    }

    /**
     * Formats the color as a readable string.
     *
     * @returns String in format "Color32(r, g, b, a)".
     */
    toString(): string {
        return `Color32(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }

    // #endregion

    // #region Comparison Methods

    /**
     * Checks if this color equals another (all channels match).
     *
     * @param other - Color to compare with.
     * @returns True if all RGBA channels are identical.
     */
    equals(other: Color32): boolean {
        // Simple comparison with early exit on the first mismatch.
        // Modern JS engines optimize this well.
        return (
            other !== null &&
            other !== undefined &&
            this.r === other.r &&
            this.g === other.g &&
            this.b === other.b &&
            this.a === other.a
        );
    }

    // #endregion

    // #region Modification Methods

    /**
     * Creates an independent copy of this color.
     *
     * @returns New Color32 with same RGBA values.
     */
    clone(): Color32 {
        // Use unchecked factory since values are already valid.
        return Color32.fromRGBAUnchecked(this.r, this.g, this.b, this.a);
    }

    /**
     * Creates a new color with modified alpha, keeping RGB unchanged.
     *
     * @param alpha - New alpha value (0-255).
     * @returns New color with updated alpha.
     */
    withAlpha(alpha: number): Color32 {
        return Color32.fromRGBAUnchecked(this.r, this.g, this.b, clampByte(alpha));
    }

    /**
     * Creates a new color with modified RGB, keeping alpha unchanged.
     *
     * @param r - New red value (0-255).
     * @param g - New green value (0-255).
     * @param b - New blue value (0-255).
     * @returns New color with updated RGB.
     */
    withRGB(r: number, g: number, b: number): Color32 {
        return new Color32(r, g, b, this.a);
    }

    /**
     * Returns the inverted color (negative).
     * Alpha channel remains unchanged.
     *
     * @returns New color with RGB channels inverted.
     */
    invert(): Color32 {
        return Color32.fromRGBAUnchecked(255 - this.r, 255 - this.g, 255 - this.b, this.a);
    }

    // #endregion

    // #region Blending Methods

    /**
     * Linearly interpolates between this color and another.
     * Useful for color transitions and gradients.
     *
     * @param other - Target color to blend toward.
     * @param t - Interpolation factor (0.0 = this color, 1.0 = other color).
     * @returns New color blended between this and other.
     */
    lerp(other: Color32, t: number): Color32 {
        // Clamp t to [0, 1] ranges using branchless-style ternary (avoids Math.max/min calls).
        t = t < 0 ? 0 : t > 1 ? 1 : t;

        // Optimized lerp: use formula a * (1-t) + b * t to reduce operations.
        const oneMinusT = 1 - t;

        return Color32.fromRGBAUnchecked(
            (this.r * oneMinusT + other.r * t) | 0,
            (this.g * oneMinusT + other.g * t) | 0,
            (this.b * oneMinusT + other.b * t) | 0,
            (this.a * oneMinusT + other.a * t) | 0,
        );
    }

    /**
     * Linearly interpolates this color toward another, modifying in place.
     * Use this in hot loops to avoid object allocation.
     *
     * @param other - Target color to blend toward.
     * @param t - Interpolation factor (0.0 = this color, 1.0 = other color).
     * @returns This color instance for chaining.
     */
    lerpInPlace(other: Color32, t: number): this {
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const oneMinusT = 1 - t;
        this.r = (this.r * oneMinusT + other.r * t) | 0;
        this.g = (this.g * oneMinusT + other.g * t) | 0;
        this.b = (this.b * oneMinusT + other.b * t) | 0;
        this.a = (this.a * oneMinusT + other.a * t) | 0;

        return this;
    }

    /**
     * Multiplies this color by another color component-wise.
     * Useful for tinting and color modulation.
     *
     * @param other - Color to multiply with.
     * @returns New color with each channel multiplied and normalized.
     */
    multiply(other: Color32): Color32 {
        return Color32.fromRGBAUnchecked(
            (this.r * other.r * INV_255) | 0,
            (this.g * other.g * INV_255) | 0,
            (this.b * other.b * INV_255) | 0,
            (this.a * other.a * INV_255) | 0,
        );
    }

    /**
     * Multiplies this color by another color component-wise, modifying in place.
     * Use this in hot loops to avoid object allocation.
     *
     * @param other - Color to multiply with.
     * @returns This color instance for chaining.
     */
    multiplyInPlace(other: Color32): this {
        this.r = (this.r * other.r * INV_255) | 0;
        this.g = (this.g * other.g * INV_255) | 0;
        this.b = (this.b * other.b * INV_255) | 0;
        this.a = (this.a * other.a * INV_255) | 0;

        return this;
    }

    /**
     * Adds another color to this one, clamping to valid range.
     * Useful for additive blending effects.
     *
     * @param other - Color to add.
     * @returns New color with summed channels (clamped to 0-255).
     */
    add(other: Color32): Color32 {
        return new Color32(this.r + other.r, this.g + other.g, this.b + other.b, this.a + other.a);
    }

    /**
     * Adds another color to this one in place, clamping to valid range.
     * Use this in hot loops to avoid object allocation.
     *
     * @param other - Color to add.
     * @returns This color instance for chaining.
     */
    addInPlace(other: Color32): this {
        this.r = clampByte(this.r + other.r);
        this.g = clampByte(this.g + other.g);
        this.b = clampByte(this.b + other.b);
        this.a = clampByte(this.a + other.a);

        return this;
    }

    /**
     * Returns a new color with premultiplied alpha.
     * Alpha multiplies RGB channels, useful for blending operations.
     *
     * @returns New color with premultiplied alpha.
     */
    premultiplyAlpha(): Color32 {
        const alphaMul = this.a * INV_255;

        return Color32.fromRGBAUnchecked(
            (this.r * alphaMul) | 0,
            (this.g * alphaMul) | 0,
            (this.b * alphaMul) | 0,
            this.a,
        );
    }

    // #endregion

    // #region Mutation Methods

    /**
     * Sets all RGBA channels at once, with validation.
     * Use this to reuse a Color32 instance instead of creating a new one.
     *
     * @param r - Red channel (0-255).
     * @param g - Green channel (0-255).
     * @param b - Blue channel (0-255).
     * @param a - Alpha channel (0-255).
     * @returns This color instance for chaining.
     */
    setRGBA(r: number, g: number, b: number, a: number): this {
        this.r = clampByte(r);
        this.g = clampByte(g);
        this.b = clampByte(b);
        this.a = clampByte(a);

        return this;
    }

    /**
     * Sets all RGBA channels at once without validation.
     * Use this in hot paths when values are guaranteed to be valid integers 0-255.
     *
     * WARNING: Passing invalid values will result in undefined behavior.
     *
     * @param r - Red channel (must be integer 0-255).
     * @param g - Green channel (must be integer 0-255).
     * @param b - Blue channel (must be integer 0-255).
     * @param a - Alpha channel (must be integer 0-255).
     * @returns This color instance for chaining.
     */
    setRGBAUnchecked(r: number, g: number, b: number, a: number): this {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;

        return this;
    }

    /**
     * Copies values from another Color32 instance.
     * Use this to reuse a Color32 instance instead of creating a new one.
     *
     * @param other - Color to copy from.
     * @returns This color instance for chaining.
     */
    copyFrom(other: Color32): this {
        this.r = other.r;
        this.g = other.g;
        this.b = other.b;
        this.a = other.a;

        return this;
    }

    // #endregion

    // #region Utility Methods

    /**
     * Calculates the perceived luminance (brightness) of the color.
     * Uses the standard relative luminance formula from WCAG.
     *
     * @returns Luminance value in range 0.0-1.0.
     */
    luminance(): number {
        // Use standard relative luminance coefficients.
        return (0.2126 * this.r + 0.7152 * this.g + 0.0722 * this.b) * INV_255;
    }

    // #endregion
}

// #endregion

// #region Helper Functions

/**
 * Clamps a number to the 0-255 byte range and truncates to integer.
 * Optimized for the common case of color channel clamping.
 * Exported for use in other utilities that work with byte values.
 *
 * @param n - Value to clamp.
 * @returns Integer in range 0-255.
 */
export function clampByte(n: number): number {
    // Bitwise operations: if n < 0, use 0; if n > 255, use 255; else truncate n.
    // This is faster than Math.max(0, Math.min(255, n)) | 0.
    return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

/**
 * Converts a single channel value to a 2-digit hex string.
 * Defined at module level to avoid closure allocation in toHex().
 * Exported for use in other utilities that need hex conversion.
 *
 * @param n - Channel value (0-255).
 * @returns Two-character hex string.
 */
export function channelToHex(n: number): string {
    return n.toString(16).padStart(2, '0');
}

// #endregion
