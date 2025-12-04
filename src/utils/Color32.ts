/**
 * 32-bit RGBA color with 8-bit channels (0-255).
 * Inspired by RetroBlit's Color32.
 */
export class Color32 {
    // #region Properties

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
     * All values are clamped to 0-255 range and floored to integers.
     *
     * @param r - Red channel (0-255, defaults to 255).
     * @param g - Green channel (0-255, defaults to 255).
     * @param b - Blue channel (0-255, defaults to 255).
     * @param a - Alpha channel (0-255, defaults to 255 = opaque).
     */
    constructor(r: number = 255, g: number = 255, b: number = 255, a: number = 255) {
        this.r = Math.max(0, Math.min(255, Math.floor(r)));
        this.g = Math.max(0, Math.min(255, Math.floor(g)));
        this.b = Math.max(0, Math.min(255, Math.floor(b)));
        this.a = Math.max(0, Math.min(255, Math.floor(a)));
    }

    // #endregion

    // #region Conversions

    /**
     * Converts color to Float32Array for WebGPU uniform buffers.
     * Values are normalized to 0.0-1.0 range.
     *
     * @returns Float32Array with [r, g, b, a] in 0.0-1.0 range.
     */
    toFloat32Array(): Float32Array {
        return new Float32Array([this.r / 255, this.g / 255, this.b / 255, this.a / 255]);
    }

    /**
     * Converts color to normalized float values (0.0-1.0).
     * Useful for shader uniforms and GPU operations.
     *
     * @returns Object with r, g, b, a properties in 0.0-1.0 range.
     */
    toFloatRGBA(): { r: number; g: number; b: number; a: number } {
        return {
            r: this.r / 255,
            g: this.g / 255,
            b: this.b / 255,
            a: this.a / 255,
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
     * @returns Hex string in format "#RRGGBBAA".
     */
    toHex(): string {
        const hex = (n: number) => n.toString(16).padStart(2, '0');

        return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex(this.a)}`;
    }

    // #endregion

    // #region Comparison

    /**
     * Checks if this color equals another (all channels match).
     *
     * @param other - Color to compare with.
     * @returns True if all RGBA channels are identical.
     */
    equals(other: Color32): boolean {
        return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
    }

    // #endregion

    // #region Utility

    /**
     * Creates an independent copy of this color.
     *
     * @returns New Color32 with same RGBA values.
     */
    clone(): Color32 {
        return new Color32(this.r, this.g, this.b, this.a);
    }

    /**
     * Formats the color as a readable string.
     *
     * @returns String in format "Color32(r, g, b, a)".
     */
    toString(): string {
        return `Color32(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }

    /**
     * Creates a new color with modified alpha, keeping RGB unchanged.
     *
     * @param alpha - New alpha value (0-255).
     * @returns New color with updated alpha.
     */
    withAlpha(alpha: number): Color32 {
        return new Color32(this.r, this.g, this.b, alpha);
    }

    /**
     * Linearly interpolates between this color and another.
     * Useful for color transitions and gradients.
     *
     * @param other - Target color to blend toward.
     * @param t - Interpolation factor (0.0 = this color, 1.0 = other color).
     * @returns New color blended between this and other.
     */
    lerp(other: Color32, t: number): Color32 {
        t = Math.max(0, Math.min(1, t));

        return new Color32(
            this.r + (other.r - this.r) * t,
            this.g + (other.g - this.g) * t,
            this.b + (other.b - this.b) * t,
            this.a + (other.a - this.a) * t,
        );
    }

    // #endregion

    // #region Static Color Constants

    /**
     * Creates pure white color (255, 255, 255, 255).
     *
     * @returns Opaque white color.
     */
    static white(): Color32 {
        return new Color32(255, 255, 255, 255);
    }

    /**
     * Creates pure black color (0, 0, 0, 255).
     *
     * @returns Opaque black color.
     */
    static black(): Color32 {
        return new Color32(0, 0, 0, 255);
    }

    /**
     * Creates fully transparent color (0, 0, 0, 0).
     *
     * @returns Transparent black color.
     */
    static transparent(): Color32 {
        return new Color32(0, 0, 0, 0);
    }

    /**
     * Creates pure red color (255, 0, 0, 255).
     *
     * @returns Opaque red color.
     */
    static red(): Color32 {
        return new Color32(255, 0, 0, 255);
    }

    /**
     * Creates pure green color (0, 255, 0, 255).
     *
     * @returns Opaque green color.
     */
    static green(): Color32 {
        return new Color32(0, 255, 0, 255);
    }

    /**
     * Creates pure blue color (0, 0, 255, 255).
     *
     * @returns Opaque blue color.
     */
    static blue(): Color32 {
        return new Color32(0, 0, 255, 255);
    }

    /**
     * Creates yellow color (255, 255, 0, 255).
     *
     * @returns Opaque yellow color.
     */
    static yellow(): Color32 {
        return new Color32(255, 255, 0, 255);
    }

    /**
     * Creates cyan color (0, 255, 255, 255).
     *
     * @returns Opaque cyan color.
     */
    static cyan(): Color32 {
        return new Color32(0, 255, 255, 255);
    }

    /**
     * Creates magenta color (255, 0, 255, 255).
     *
     * @returns Opaque magenta color.
     */
    static magenta(): Color32 {
        return new Color32(255, 0, 255, 255);
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

    // #region Static Parsers

    /**
     * Parses a CSS hex color string into a Color32.
     * Supports formats: #RGB, #RGBA, #RRGGBB, #RRGGBBAA.
     *
     * @param hex - Hex color string with or without leading #.
     * @returns Parsed color.
     * @throws Error if hex string format is invalid.
     */
    static fromHex(hex: string): Color32 {
        hex = hex.replace('#', '');

        let r: number,
            g: number,
            b: number,
            a: number = 255;

        if (hex.length === 3) {
            r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
            g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
            b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
        } else if (hex.length === 4) {
            r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
            g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
            b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
            a = parseInt(hex.charAt(3) + hex.charAt(3), 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (hex.length === 8) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
            a = parseInt(hex.substring(6, 8), 16);
        } else {
            throw new Error(`Invalid hex color: ${hex}`);
        }

        return new Color32(r, g, b, a);
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

    // #endregion
}
