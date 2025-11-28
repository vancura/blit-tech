/**
 * Font Demo
 *
 * Shows how to use bitmap fonts for text rendering in Blit-Tech.
 * Demonstrates:
 * - Loading/creating bitmap fonts
 * - Colored text rendering
 * - Rainbow and pulsing text effects
 * - Text measurement
 *
 * To use your own bitmap font:
 * 1. Create a font image with fixed-width characters
 * 2. Use BitmapFont.loadFixedWidth() to load it
 * 3. Render with BT.printFont()
 */

import {
    BitmapFont,
    BT,
    Color32,
    type HardwareSettings,
    type IBlitTechGame,
    SpriteSheet,
    Vector2i,
} from '../src/BlitTech';

/**
 * Demonstrates bitmap font rendering with various text effects.
 * Creates a programmatic font for demo purposes.
 */
class FontDemo implements IBlitTechGame {
    /** Loaded bitmap font for text rendering. */
    private font: BitmapFont | null = null;

    /** Animation time accumulator in seconds. */
    private animTime: number = 0;

    /**
     * Configures display with 2x upscaling for crisp pixel text.
     * @returns Hardware configuration.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            mapSize: new Vector2i(128, 128),
            mapLayers: 4,
            chunkSize: new Vector2i(16, 16),
            targetFPS: 60,
        };
    }

    /**
     * Creates a demo font programmatically using canvas.
     * In production, you'd load from an image file instead.
     * @returns Promise resolving to true when font is created.
     */
    async initialize(): Promise<boolean> {
        console.log('[FontDemo] Initializing...');

        // Create a simple programmatic font for demonstration
        this.font = await this.createSimpleFont();

        console.log('[FontDemo] Font loaded successfully!');
        return true;
    }

    /**
     * Creates a simple 8x8 bitmap font programmatically.
     * Uses canvas text rendering to generate glyph texture.
     *
     * In a real game, you'd load from an image file:
     * ```
     * const font = await BitmapFont.loadFixedWidth(
     *     'path/to/font.png',
     *     'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!? ',
     *     new Vector2i(8, 8),
     *     16  // characters per row
     * );
     * ```
     * @returns Promise resolving to the created BitmapFont.
     */
    private async createSimpleFont(): Promise<BitmapFont> {
        // Character set
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:- ';
        const charWidth = 8;
        const charHeight = 8;
        const charsPerRow = 16;
        const rows = Math.ceil(charset.length / charsPerRow);

        // Create canvas for font texture
        const canvas = document.createElement('canvas');
        canvas.width = charsPerRow * charWidth;
        canvas.height = rows * charHeight;
        const ctx = canvas.getContext('2d')!;

        // Fill with transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw simple characters
        ctx.fillStyle = 'white';
        ctx.font = '8px monospace';
        ctx.textBaseline = 'top';

        for (let i = 0; i < charset.length; i++) {
            const col = i % charsPerRow;
            const row = Math.floor(i / charsPerRow);
            const x = col * charWidth + 1;
            const y = row * charHeight;
            ctx.fillText(charset.charAt(i), x, y);
        }

        // Convert canvas to image
        const dataUrl = canvas.toDataURL();
        const image = new Image();
        await new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.src = dataUrl;
        });

        // Create sprite sheet and font
        const spriteSheet = new SpriteSheet(image);
        return new BitmapFont(spriteSheet, charset, new Vector2i(charWidth, charHeight), 1);
    }

    /**
     * Advances animation time for text effects.
     */
    update(): void {
        this.animTime += 0.016;
    }

    /**
     * Renders text demonstrations with various colors and effects.
     * Shows static colors, rainbow animation, and pulsing brightness.
     */
    render(): void {
        // Clear to dark blue
        BT.clear(new Color32(20, 30, 50));

        if (!this.font) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading font...');
            return;
        }

        // Title
        BT.printFont(this.font, new Vector2i(10, 10), 'BLITTECH FONT DEMO', Color32.white());

        // Different colors
        BT.printFont(this.font, new Vector2i(10, 30), 'RED TEXT', new Color32(255, 100, 100));
        BT.printFont(this.font, new Vector2i(10, 45), 'GREEN TEXT', new Color32(100, 255, 100));
        BT.printFont(this.font, new Vector2i(10, 60), 'BLUE TEXT', new Color32(100, 100, 255));
        BT.printFont(this.font, new Vector2i(10, 75), 'YELLOW TEXT', new Color32(255, 255, 100));

        // Animated rainbow text
        const rainbowText = 'RAINBOW ANIMATION';
        let x = 10;
        for (let i = 0; i < rainbowText.length; i++) {
            const hue = (i * 20 + this.animTime * 100) % 360;
            const color = this.hslToRgb(hue, 100, 60);
            const char = rainbowText.charAt(i);
            BT.printFont(this.font, new Vector2i(x, 95), char, color);
            const glyph = this.font.getGlyph(char);
            x += glyph ? glyph.advance : 0;
        }

        // Pulsing text
        const pulse = Math.sin(this.animTime * 3) * 0.5 + 0.5;
        const pulseColor = new Color32(Math.floor(100 + pulse * 155), Math.floor(100 + pulse * 155), Math.floor(255));
        BT.printFont(this.font, new Vector2i(10, 115), 'PULSING TEXT', pulseColor);

        // Multi-line text
        BT.printFont(this.font, new Vector2i(10, 140), 'MULTI-LINE TEXT:', Color32.white());
        BT.printFont(this.font, new Vector2i(10, 155), 'LINE 1', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(10, 170), 'LINE 2', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(10, 185), 'LINE 3', new Color32(200, 200, 200));

        // Instructions
        BT.printFont(this.font, new Vector2i(10, 210), 'USE YOUR OWN FONT:', new Color32(255, 200, 100));

        // FPS (using old placeholder print for comparison)
        BT.print(new Vector2i(10, 225), new Color32(150, 150, 150), `FPS: ${BT.fps()}`);
        BT.printFont(this.font, new Vector2i(100, 225), `TICKS: ${BT.ticks()}`, new Color32(150, 150, 150));
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

        return new Color32(Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255));
    }
}

/**
 * Displays an error message in the page UI.
 * @param title - Error heading.
 * @param message - Error details.
 */
function showError(title: string, message: string) {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ff6b6b; background: #2a0000; border-radius: 8px;">
                <h2>❌ ${title}</h2>
                <p style="margin: 20px 0;">${message}</p>
                <p style="font-size: 0.9em; color: #ff9999;">Check the browser console for more details.</p>
            </div>
        `;
    }
}

/**
 * Application entry point.
 * Validates WebGPU support and starts the font demo.
 */
async function main() {
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
        showError('Initialization Failed', 'Failed to initialize Blit-Tech engine. Check console for details.');
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
