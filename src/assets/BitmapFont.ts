import { Rect2i } from '../utils/Rect2i';
import type { Vector2i } from '../utils/Vector2i';
import { SpriteSheet } from './SpriteSheet';

/**
 * Character glyph information for bitmap font rendering.
 */
export interface Glyph {
    /** Source rectangle in the font texture */
    rect: Rect2i;
    /** Horizontal advance (how much to move cursor after drawing) */
    advance: number;
}

/**
 * Bitmap font asset for retro-style text rendering.
 * Supports both fixed-width and variable-width fonts loaded from sprite sheets.
 * Characters are mapped by their position in a character order string.
 */
export class BitmapFont {
    private spriteSheet: SpriteSheet;
    private glyphs: Map<string, Glyph> = new Map();
    private characterOrder: string;
    public readonly charSize: Vector2i;
    public readonly spacing: number;

    /**
     * Creates a bitmap font from a sprite sheet.
     * Use the static loadFixedWidth() method for easier loading.
     * @param spriteSheet - Sprite sheet containing font glyphs.
     * @param characterOrder - String defining character order in the sheet (e.g., "ABCD...0123").
     * @param charSize - Pixel dimensions of each character cell.
     * @param spacing - Horizontal spacing between characters when rendering (defaults to 1).
     */
    constructor(spriteSheet: SpriteSheet, characterOrder: string, charSize: Vector2i, spacing: number = 1) {
        this.spriteSheet = spriteSheet;
        this.characterOrder = characterOrder;
        this.charSize = charSize;
        this.spacing = spacing;

        this.buildGlyphs();
    }

    /**
     * Loads a fixed-width bitmap font from an image file.
     * Characters should be arranged in a grid, row by row.
     * @param url - Path to the font image file.
     * @param characterOrder - String containing characters in order (e.g., "ABCD...0123...").
     * @param charSize - Size of each character cell in pixels.
     * @param _charsPerRow - Number of characters per row (reserved for future use).
     * @param spacing - Spacing between characters when rendering (defaults to 1).
     * @returns Promise resolving to the loaded BitmapFont.
     */
    static async loadFixedWidth(
        url: string,
        characterOrder: string,
        charSize: Vector2i,
        _charsPerRow: number,
        spacing: number = 1,
    ): Promise<BitmapFont> {
        const spriteSheet = await SpriteSheet.load(url);
        const font = new BitmapFont(spriteSheet, characterOrder, charSize, spacing);
        return font;
    }

    /**
     * Builds the internal glyph lookup map.
     * Maps each character to its source rectangle in the sprite sheet.
     */
    private buildGlyphs(): void {
        const charsPerRow = Math.floor(this.spriteSheet.size.x / this.charSize.x);

        for (let i = 0; i < this.characterOrder.length; i++) {
            const char = this.characterOrder.charAt(i);
            const col = i % charsPerRow;
            const row = Math.floor(i / charsPerRow);

            const rect = new Rect2i(col * this.charSize.x, row * this.charSize.y, this.charSize.x, this.charSize.y);

            this.glyphs.set(char, {
                rect,
                advance: this.charSize.x + this.spacing,
            });
        }
    }

    /**
     * Gets glyph information for a specific character.
     * @param char - Single character to look up.
     * @returns Glyph data with source rect and advance, or null if character not in font.
     */
    getGlyph(char: string): Glyph | null {
        return this.glyphs.get(char) || null;
    }

    /**
     * Gets the underlying sprite sheet for direct rendering.
     * @returns The font's sprite sheet.
     */
    getSpriteSheet(): SpriteSheet {
        return this.spriteSheet;
    }

    /**
     * Measures the pixel width of a text string.
     * Accounts for character advances and spacing.
     * @param text - String to measure.
     * @returns Total width in pixels.
     */
    measureText(text: string): number {
        let width = 0;

        for (let i = 0; i < text.length; i++) {
            const glyph = this.getGlyph(text.charAt(i));
            if (glyph) {
                width += glyph.advance;
            }
        }

        // Remove spacing from last character
        if (text.length > 0) {
            width -= this.spacing;
        }

        return width;
    }

    /**
     * Gets the height of rendered text.
     * For bitmap fonts, all text has the same height.
     * @returns Character height in pixels.
     */
    getTextHeight(): number {
        return this.charSize.y;
    }
}
