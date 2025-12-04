/**
 * Primitives Demo
 *
 * Showcases all basic drawing functions in Blit–Tech:
 * - drawPixel: Single pixel rendering
 * - drawLine: Bresenham line algorithm
 * - drawRect: Rectangle outlines
 * - drawRectFill: Filled rectangles
 * - clearRect: Region clearing
 */

import { BitmapFont, BT, Color32, type HardwareSettings, type IBlitTechGame, Rect2i, Vector2i } from '../src/BlitTech';

/**
 * Demonstrates all primitive drawing operations with animated examples.
 * Each section shows a different drawing function in action.
 */
class PrimitivesDemo implements IBlitTechGame {
    // #region Module State

    /** Animation tick counter for time-based effects. */
    private animTicks: number = 0;

    /** Bitmap font for text rendering. */
    private font: BitmapFont | null = null;

    // #endregion

    // #region IBlitTechGame Implementation

    /**
     * Configures a 320x240 display with 2x CSS upscaling for crisp pixels.
     * @returns Hardware configuration for primitive rendering demo.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            targetFPS: 60,
        };
    }

    /**
     * Initializes the demo and loads the bitmap font.
     * @returns Promise resolving to true when font is loaded.
     */
    async initialize(): Promise<boolean> {
        console.log('[PrimitivesDemo] Initializing...');

        // Load bitmap font for text rendering.
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');
            console.log(`[PrimitivesDemo] Loaded font: ${this.font.name} (${this.font.glyphCount} glyphs)`);
        } catch (error) {
            console.error('[PrimitivesDemo] Failed to load font:', error);
            return false;
        }

        console.log('[PrimitivesDemo] Initialized');
        return true;
    }

    /**
     * Advances animation timer each frame.
     */
    update(): void {
        this.animTicks++;
    }

    /**
     * Renders all primitive demonstrations.
     * Shows pixels, lines, rect outlines, filled rects, clear regions, and a combined graph.
     */
    render(): void {
        // Clear background to dark blue
        BT.clear(new Color32(20, 30, 50));

        if (!this.font) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading font...');
            return;
        }

        // Title.
        BT.printFont(this.font, new Vector2i(10, 10), 'Blit–Tech - Primitives Demo', Color32.white());

        // Section 1: Pixels.
        BT.printFont(this.font, new Vector2i(10, 30), 'Pixels:', new Color32(255, 200, 100));

        // Draw random-ish pixels.
        for (let i = 0; i < 50; i++) {
            const x = 10 + ((i * 13) % 60);
            const y = 45 + ((i * 7) % 20);
            const hue = (i * 17 + this.animTicks) % 360;
            const color = this.hslToRgb(hue, 100, 50);
            BT.drawPixel(new Vector2i(x, y), color);
        }

        // Section 2: Lines.
        BT.printFont(this.font, new Vector2i(10, 75), 'Lines:', new Color32(255, 200, 100));

        // Horizontal line.
        BT.drawLine(new Vector2i(10, 90), new Vector2i(70, 90), new Color32(255, 100, 100));

        // Vertical line.
        BT.drawLine(new Vector2i(20, 95), new Vector2i(20, 115), new Color32(100, 255, 100));

        // Diagonal line.
        BT.drawLine(new Vector2i(30, 95), new Vector2i(60, 115), new Color32(100, 100, 255));

        // Animated rotating line.
        const angle = (this.animTicks * 2 * Math.PI) / 180;
        const centerX = 50;
        const centerY = 105;
        const radius = 15;
        const endX = centerX + Math.cos(angle) * radius;
        const endY = centerY + Math.sin(angle) * radius;
        BT.drawLine(new Vector2i(centerX, centerY), new Vector2i(Math.floor(endX), Math.floor(endY)), Color32.white());

        // Section 3: Rectangle Outlines.
        BT.printFont(this.font, new Vector2i(90, 30), 'Rect Outlines:', new Color32(255, 200, 100));

        // Static rectangles.
        BT.drawRect(new Rect2i(90, 45, 40, 25), new Color32(255, 100, 100));
        BT.drawRect(new Rect2i(140, 45, 30, 30), new Color32(100, 255, 100));
        BT.drawRect(new Rect2i(180, 45, 25, 35), new Color32(100, 100, 255));

        // Animated pulsing rectangle.
        const pulse = Math.floor(10 + Math.sin(this.animTicks * 0.1) * 5);
        BT.drawRect(new Rect2i(220, 45, pulse * 2, pulse * 2), new Color32(255, 255, 100));

        // Section 4: Filled Rectangles.
        BT.printFont(this.font, new Vector2i(90, 90), 'Rect Fills:', new Color32(255, 200, 100));

        // Static filled rectangles.
        BT.drawRectFill(new Rect2i(90, 105, 40, 25), new Color32(255, 100, 100));
        BT.drawRectFill(new Rect2i(140, 105, 30, 30), new Color32(100, 255, 100));
        BT.drawRectFill(new Rect2i(180, 105, 25, 35), new Color32(100, 100, 255));

        // Animated sliding rectangle.
        const slideX = 220 + Math.floor(Math.sin(this.animTicks * 0.05) * 20);
        BT.drawRectFill(new Rect2i(slideX, 105, 20, 20), new Color32(255, 255, 100));

        // Section 5: Clear Rect.
        BT.printFont(this.font, new Vector2i(10, 135), 'Clear Rect:', new Color32(255, 200, 100));

        // Draw a background pattern.
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 5; j++) {
                BT.drawRectFill(new Rect2i(10 + i * 10, 150 + j * 10, 8, 8), new Color32(100, 150, 200));
            }
        }

        // Clear a rectangular region.
        const clearX = 30 + Math.floor(Math.sin(this.animTicks * 0.03) * 15);
        BT.clearRect(new Color32(20, 30, 50), new Rect2i(clearX, 160, 40, 30));

        // Section 6: Combined Demo.
        BT.printFont(this.font, new Vector2i(120, 150), 'Combined:', new Color32(255, 200, 100));

        // Draw a simple animated "graph".
        const graphX = 120;
        const graphY = 170;
        const graphW = 180;
        const graphH = 50;

        // Graph background.
        BT.drawRectFill(new Rect2i(graphX, graphY, graphW, graphH), new Color32(10, 15, 25));

        // Graph border.
        BT.drawRect(new Rect2i(graphX, graphY, graphW, graphH), new Color32(100, 100, 100));

        // Draw sine wave.
        for (let x = 0; x < graphW - 1; x++) {
            const y1 = Math.floor(graphH / 2 + Math.sin((x + this.animTicks) * 0.1) * (graphH / 3));
            const y2 = Math.floor(graphH / 2 + Math.sin((x + 1 + this.animTicks) * 0.1) * (graphH / 3));

            BT.drawLine(
                new Vector2i(graphX + x, graphY + y1),
                new Vector2i(graphX + x + 1, graphY + y2),
                new Color32(100, 255, 255),
            );
        }

        // FPS counter.
        BT.printFont(
            this.font,
            new Vector2i(10, 225),
            `FPS: ${BT.fps()} | Ticks: ${BT.ticks()}`,
            new Color32(150, 150, 150),
        );
    }

    // #endregion

    // #region Helper Functions

    /**
     * Converts HSL color values to RGB Color32.
     * Used for rainbow color effects.
     *
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

    // #endregion
}

// #region Helper Functions

/**
 * Displays an error message in the page UI.
 *
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
 * Validates WebGPU support and starts the demo.
 */
async function main(): Promise<void> {
    // Check WebGPU support
    if (!navigator.gpu) {
        showError(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU. Please use Chrome/Edge 113+ or Firefox Nightly with WebGPU enabled.',
        );
        return;
    }

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('[Main] Canvas element not found');
        return;
    }

    const game = new PrimitivesDemo();

    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Primitives demo started successfully!');
    } else {
        showError('Initialization Failed', 'Failed to initialize the Blit–Tech engine. Check console for details.');
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
