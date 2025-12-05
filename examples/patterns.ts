/**
 * Patterns Demo
 *
 * Showcases various animated patterns and effects using primitive drawing.
 * Demonstrates mathematical curves and visual effects:
 * - Spiral: Expanding point pattern
 * - Radial Lines: Animated sun-ray effect
 * - Wave: Sinusoidal interference patterns
 * - Circle: Polygon approximation with rainbow colors
 * - Lissajous: Classic parametric curve
 * - Tunnel: Concentric rotating rectangles
 */

import { BitmapFont, BT, Color32, type HardwareSettings, type IBlitTechGame, Rect2i, Vector2i } from '../src/BlitTech';

/**
 * Demonstrates animated mathematical patterns using primitive drawing.
 * Each section shows a different algorithmic visual effect.
 */
class PatternsDemo implements IBlitTechGame {
    // #region Module State

    /** Animation time accumulator in seconds. */
    private animTime: number = 0;

    /** Bitmap font for text rendering. */
    private font: BitmapFont | null = null;

    // #endregion

    // #region Pre-allocated Reusable Objects (Performance)

    /** Reusable vector for drawing operations. */
    private readonly tempVec1 = new Vector2i(0, 0);

    /** Reusable vector for drawing operations. */
    private readonly tempVec2 = new Vector2i(0, 0);

    /** Reusable rect for drawing operations. */
    private readonly tempRect = new Rect2i(0, 0, 0, 0);

    // #endregion

    // #region IBlitTechGame Implementation

    /**
     * Configures a 320x240 display with 2x CSS upscaling for crisp patterns.
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
     * Initializes the demo and loads the bitmap font.
     *
     * @returns Promise resolving to true when font is loaded.
     */
    async initialize(): Promise<boolean> {
        console.log('[PatternsDemo] Initializing...');

        // Load bitmap font for text rendering.
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');
            console.log(`[PatternsDemo] Loaded font: ${this.font.name} (${this.font.glyphCount} glyphs)`);
        } catch (error) {
            console.error('[PatternsDemo] Failed to load font:', error);
            return false;
        }

        console.log('[PatternsDemo] Initialized');
        return true;
    }

    /**
     * Advances animation time (approximately 60 FPS).
     */
    update(): void {
        this.animTime += 0.016; // ~60 FPS
    }

    /**
     * Renders all pattern demonstrations in a 2x3 grid layout.
     */
    render(): void {
        // Clear to dark background.
        BT.clear(new Color32(15, 15, 25));

        if (!this.font) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading font...');
            return;
        }

        // Title.
        BT.printFont(this.font, new Vector2i(10, 5), 'Blit–Tech - Patterns Demo', Color32.white());

        // Draw different pattern sections.
        this.drawSpiral(new Vector2i(40, 50));
        this.drawRadialLines(new Vector2i(120, 50));
        this.drawWavePattern(new Vector2i(200, 50));
        this.drawCircleApproximation(new Vector2i(40, 130));
        this.drawLissajous(new Vector2i(120, 130));
        this.drawTunnel(new Vector2i(200, 130));

        // Labels.
        BT.printFont(this.font, new Vector2i(15, 95), 'Spiral', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(90, 95), 'Radial', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(175, 95), 'Wave', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(15, 175), 'Circle', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(85, 175), 'Lissajous', new Color32(200, 200, 200));
        BT.printFont(this.font, new Vector2i(175, 175), 'Tunnel', new Color32(200, 200, 200));

        // FPS counter.
        BT.printFont(
            this.font,
            new Vector2i(10, 225),
            `FPS: ${BT.fps()} | Time: ${this.animTime.toFixed(1)}s`,
            new Color32(150, 150, 150),
        );
    }

    // #endregion

    // #region Pattern Rendering

    /**
     * Draws an animated Archimedean spiral using pixels.
     * Points expand outward while rotating with rainbow colors.
     *
     * @param center - Center point of the spiral.
     */
    private drawSpiral(center: Vector2i): void {
        const points = 100;
        const maxRadius = 35;

        for (let i = 0; i < points; i++) {
            const t = (i / points) * Math.PI * 4 + this.animTime;
            const radius = (i / points) * maxRadius;

            const x = center.x + Math.cos(t) * radius;
            const y = center.y + Math.sin(t) * radius;

            const hue = (i / points) * 360 + this.animTime * 50;
            const color = this.hslToRgb(hue % 360, 100, 50);

            // Reuse vector to avoid allocation per pixel
            this.tempVec1.set(Math.floor(x), Math.floor(y));
            BT.drawPixel(this.tempVec1, color);
        }
    }

    /**
     * Draws animated radial lines from center like sun rays.
     * Line lengths pulse based on time offset.
     *
     * @param center - Center point of the radial pattern.
     */
    private drawRadialLines(center: Vector2i): void {
        const numLines = 12;
        const radius = 35;

        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2 + this.animTime;
            const length = radius * (0.5 + 0.5 * Math.sin(this.animTime * 2 + i));

            const x = center.x + Math.cos(angle) * length;
            const y = center.y + Math.sin(angle) * length;

            const hue = (i / numLines) * 360;
            const color = this.hslToRgb(hue, 80, 60);

            // Reuse vector to avoid allocation per line
            this.tempVec1.set(Math.floor(x), Math.floor(y));
            BT.drawLine(center, this.tempVec1, color);
        }
    }

    /**
     * Draws three overlapping wave patterns demonstrating interference.
     * Shows primary, secondary, and combined waves.
     *
     * @param center - Center point (waves drawn horizontally around this).
     */
    private drawWavePattern(center: Vector2i): void {
        const width = 60;

        // Pre-create colors outside loop
        const color1 = new Color32(100, 200, 255);
        const color2 = new Color32(255, 150, 100);
        const color3 = new Color32(150, 255, 150);

        for (let x = 0; x < width; x++) {
            const baseX = center.x - width / 2 + x;

            // Primary wave.
            const y1 = Math.sin((x + this.animTime * 20) * 0.2) * 15;
            this.tempVec1.set(baseX, center.y + Math.floor(y1));
            BT.drawPixel(this.tempVec1, color1);

            // Secondary wave.
            const y2 = Math.cos((x + this.animTime * 15) * 0.15) * 10;
            this.tempVec1.set(baseX, center.y + Math.floor(y2));
            BT.drawPixel(this.tempVec1, color2);

            // Interference pattern.
            const y3 = Math.sin((x + this.animTime * 20) * 0.2) * 15 + Math.cos((x + this.animTime * 15) * 0.15) * 10;
            this.tempVec1.set(baseX, center.y + Math.floor(y3 / 2));
            BT.drawPixel(this.tempVec1, color3);
        }
    }

    /**
     * Draws a rotating circle using line segment approximation.
     * Shows how circles can be rendered using only line primitives.
     *
     * @param center - Center point of the circle.
     */
    private drawCircleApproximation(center: Vector2i): void {
        const segments = 32;
        const radius = 30 + Math.sin(this.animTime * 2) * 5;

        for (let i = 0; i < segments; i++) {
            const angle1 = (i / segments) * Math.PI * 2;
            const angle2 = ((i + 1) / segments) * Math.PI * 2;

            const x1 = center.x + Math.cos(angle1 + this.animTime) * radius;
            const y1 = center.y + Math.sin(angle1 + this.animTime) * radius;
            const x2 = center.x + Math.cos(angle2 + this.animTime) * radius;
            const y2 = center.y + Math.sin(angle2 + this.animTime) * radius;

            const hue = (i / segments) * 360;
            const color = this.hslToRgb(hue, 100, 50);

            // Reuse vectors to avoid allocation per segment
            this.tempVec1.set(Math.floor(x1), Math.floor(y1));
            this.tempVec2.set(Math.floor(x2), Math.floor(y2));
            BT.drawLine(this.tempVec1, this.tempVec2, color);
        }
    }

    /**
     * Draws a Lissajous curve (parametric figure-8 variant).
     * Classic demonstration of harmonic oscillation patterns.
     * Uses frequency ratio 3:4 for the characteristic shape.
     *
     * @param center - Center point of the curve.
     */
    private drawLissajous(center: Vector2i): void {
        const points = 200;
        const a = 3;
        const b = 4;
        const radius = 30;

        let prevX = 0;
        let prevY = 0;

        for (let i = 0; i <= points; i++) {
            const t = (i / points) * Math.PI * 2;

            const x = center.x + Math.sin(a * t + this.animTime) * radius;
            const y = center.y + Math.sin(b * t) * radius;

            if (i > 0) {
                const hue = (i / points) * 360 + this.animTime * 30;
                const color = this.hslToRgb(hue % 360, 100, 50);

                // Reuse vectors to avoid allocation per segment
                this.tempVec1.set(Math.floor(prevX), Math.floor(prevY));
                this.tempVec2.set(Math.floor(x), Math.floor(y));
                BT.drawLine(this.tempVec1, this.tempVec2, color);
            }

            prevX = x;
            prevY = y;
        }
    }

    /**
     * Draws a psychedelic tunnel effect using concentric rectangles.
     * Rectangles rotate and wobble for depth illusion.
     *
     * @param center - Center point of the tunnel.
     */
    private drawTunnel(center: Vector2i): void {
        const numRects = 20;

        for (let i = 0; i < numRects; i++) {
            const t = i / numRects;
            const size = (1 - t) * 60 + Math.sin(this.animTime * 2 + i * 0.3) * 5;

            const angle = this.animTime + i * 0.2;
            const offsetX = Math.cos(angle) * i;
            const offsetY = Math.sin(angle) * i;

            const x = center.x - size / 2 + offsetX;
            const y = center.y - size / 2 + offsetY;

            const hue = (t * 360 + this.animTime * 50) % 360;
            const lightness = 30 + t * 40;
            const color = this.hslToRgb(hue, 100, lightness);

            // Reuse rect to avoid allocation per rectangle
            this.tempRect.set(Math.floor(x), Math.floor(y), Math.floor(size), Math.floor(size));
            BT.drawRect(this.tempRect, color);
        }
    }

    /**
     * Converts HSL color values to RGB Color32.
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
 * Validates WebGPU support and starts the patterns demo.
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

    const game = new PatternsDemo();

    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Patterns demo started successfully!');
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
