/**
 * Font Demo
 *
 * Shows how to use bitmap fonts for text rendering in Blit–Tech.
 * Demonstrates:
 * - Loading bitmap fonts from .btfont files
 * - Colored text rendering
 * - Rainbow and pulsing text effects
 * - Text measurement
 *
 * Font file format (.btfont):
 * - JSON with embedded base64 texture or relative path to PNG
 * - Supports variable-width glyphs with per-character offsets
 * - Unicode support for special characters
 */

import { BitmapFont, BT, Color32, type HardwareSettings, type IBlitTechGame, Vector2i } from '../src/BlitTech';

/**
 * Demonstrates bitmap font rendering with various text effects.
 */
class FontDemo implements IBlitTechGame {
    // #region Module State

    /** Loaded bitmap font for text rendering. */
    private font: BitmapFont | null = null;

    /** Animation time accumulator in seconds. */
    private animTime: number = 0;

    // #endregion

    // #region IBlitTechGame Implementation

    /**
     * Configures display with 2x upscaling for crisp pixel text.
     *
     * @returns Hardware configuration.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            targetFPS: 60,
        };
    }

    /**
     * Loads the bitmap font from a .btfont file.
     *
     * @returns Promise resolving to true when font is loaded.
     */
    async initialize(): Promise<boolean> {
        console.log('[FontDemo] Initializing...');

        // Load font from .btfont file.
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');

            console.log(`[FontDemo] Loaded font: ${this.font.name}`);
            console.log(`  Size: ${this.font.size}pt`);
            console.log(`  Line height: ${this.font.lineHeight}px`);
            console.log(`  Glyphs: ${this.font.glyphCount}`);
        } catch (error) {
            console.error('[FontDemo] Failed to load font:', error);

            return false;
        }

        console.log('[FontDemo] Font loaded successfully!');
        return true;
    }

    /**
     * Advances animation time for text effects.
     */
    update(): void {
        this.animTime += 1 / 60; // Assuming 60 FPS
    }

    /**
     * Renders text demonstrations with various colors and effects.
     * Shows static colors, rainbow animation, and pulsing brightness.
     */
    render(): void {
        // Clear to dark blue.
        BT.clear(new Color32(20, 30, 50));

        if (!this.font) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading font...');

            return;
        }

        const lineHeight = this.font.lineHeight + 2;
        let y = 10;

        // Title.
        BT.printFont(this.font, new Vector2i(10, y), 'Blit–Tech Font Demo', Color32.white());

        y += lineHeight + 4;

        // Different colors.
        BT.printFont(this.font, new Vector2i(10, y), 'Red Text', new Color32(255, 100, 100));

        y += lineHeight;

        BT.printFont(this.font, new Vector2i(10, y), 'Green Text', new Color32(100, 255, 100));

        y += lineHeight;

        BT.printFont(this.font, new Vector2i(10, y), 'Blue Text', new Color32(100, 100, 255));

        y += lineHeight;

        BT.printFont(this.font, new Vector2i(10, y), 'Yellow Text', new Color32(255, 255, 100));

        y += lineHeight + 4;

        // Animated rainbow text.
        const rainbowText = 'Rainbow Animation!';
        let x = 10;
        for (const char of rainbowText) {
            const hue = (x * 3 + this.animTime * 100) % 360;
            const color = this.hslToRgb(hue, 100, 60);

            BT.printFont(this.font, new Vector2i(x, y), char, color);

            const glyph = this.font.getGlyph(char);

            x += glyph ? glyph.advance : 7;
        }

        y += lineHeight + 4;

        // Pulsing text.
        const pulse = Math.sin(this.animTime * 3) * 0.5 + 0.5;
        const pulseColor = new Color32(Math.floor(100 + pulse * 155), Math.floor(100 + pulse * 155), 255);

        BT.printFont(this.font, new Vector2i(10, y), 'Pulsing Text', pulseColor);

        y += lineHeight + 4;

        // Unicode special characters.
        BT.printFont(this.font, new Vector2i(10, y), 'Special: 3 x 4 = 12', Color32.white());

        y += lineHeight;

        // Text measurement demo.
        const measureText = 'Measured Width';
        const textWidth = this.font.measureText(measureText);

        BT.printFont(this.font, new Vector2i(10, y), measureText, new Color32(200, 200, 200));

        // Draw underline showing measured width.
        BT.drawLine(
            new Vector2i(10, y + lineHeight - 2),
            new Vector2i(10 + textWidth, y + lineHeight - 2),
            new Color32(255, 200, 100),
        );

        y += lineHeight + 4;

        // Font info.
        BT.printFont(
            this.font,
            new Vector2i(10, y),
            `Font: ${this.font.name} (${this.font.glyphCount} glyphs)`,
            new Color32(150, 150, 150),
        );

        y += lineHeight;

        // FPS counter.
        BT.printFont(
            this.font,
            new Vector2i(10, y),
            `FPS: ${BT.fps()} | Ticks: ${BT.ticks()}`,
            new Color32(100, 100, 100),
        );
    }

    /**
     * Converts HSL color values to RGB Color32.
     * @param h - Hue in degrees (0-360).
     * @param s - Saturation percentage (0-100).
     * @param l - Lightness percentage (0-100).
     * @returns Color32 with converted RGB values.
     */
    private hslToRgb(h: number, s: number, l: number): Color32 {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r: number, g: number, b: number;

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

        return new Color32(Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255));
    }
}

/**
 * Displays an error message in the page UI.
 * @param title - Error heading.
 * @param message - Error details.
 */
function showError(title: string, message: string): void {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ff6b6b; background: #2a0000; border-radius: 8px;">
                <h2>[X] ${title}</h2>
                <p style="margin: 20px 0;">${message}</p>
                <p style="font-size: 0.9em; color: #ff9999;">Check the browser console for more details.</p>
            </div>
        `;
    }
}

// #endregion

// #region Main Logic

/**
 * Application entry point.
 * Validates WebGPU support and starts the font demo.
 */
async function main(): Promise<void> {
    if (!navigator.gpu) {
        showError(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU. Please use Chrome/Edge 113+ or Firefox Nightly.',
        );
        return;
    }

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('[Main] Canvas element not found');
        return;
    }

    const game = new FontDemo();

    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Font demo started successfully!');
    } else {
        showError('Initialization Failed', 'Failed to initialize Blit–Tech engine. Check console for details.');
    }
}

// #endregion

// #region App Lifecycle

// Auto-start when DOM is ready.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

// #endregion
