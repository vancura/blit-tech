/**
 * Sprite Demo
 *
 * Shows how to use sprite sheets and textured rendering in Blit-Tech.
 * Demonstrates:
 * - Loading/creating sprite sheets
 * - Drawing sprites with source rectangles
 * - Color tinting and alpha blending
 * - Animated sprite effects
 *
 * To use your own sprites:
 * 1. Load a sprite sheet with SpriteSheet.load('path/to/sprites.png')
 * 2. Define sprite regions with Rect2i (source rectangle in texture)
 * 3. Render with BT.drawSprite(spriteSheet, srcRect, destPos, tint)
 */

import { BT, Color32, type HardwareSettings, type IBlitTechGame, Rect2i, SpriteSheet, Vector2i } from '../src/BlitTech';

/**
 * Demonstrates sprite rendering with various tint and animation effects.
 * Creates a programmatic sprite sheet with basic shapes for demo purposes.
 */
class SpriteDemo implements IBlitTechGame {
    /** Loaded sprite sheet containing shape sprites. */
    private spriteSheet: SpriteSheet | null = null;

    /** Animation time accumulator in seconds. */
    private animTime: number = 0;

    /** Source rectangles for each sprite in the sheet. */
    private readonly sprites = {
        square: new Rect2i(0, 0, 32, 32),
        circle: new Rect2i(32, 0, 32, 32),
        triangle: new Rect2i(64, 0, 32, 32),
        star: new Rect2i(96, 0, 32, 32),
        heart: new Rect2i(0, 32, 32, 32),
        diamond: new Rect2i(32, 32, 32, 32),
    };

    /**
     * Configures display with 2x upscaling for crisp pixel sprites.
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
     * Creates a demo sprite sheet with basic shapes.
     * In production, you'd load from an image file instead.
     * @returns Promise resolving to true when sprites are created.
     */
    async initialize(): Promise<boolean> {
        console.log('[SpriteDemo] Initializing...');

        // Create a simple sprite sheet programmatically for demonstration
        this.spriteSheet = await this.createDemoSpriteSheet();

        console.log('[SpriteDemo] Sprite sheet created successfully!');
        return true;
    }

    /**
     * Creates a sprite sheet with geometric shapes using canvas drawing.
     *
     * In a real game, you'd load from an image file:
     * ```
     * const spriteSheet = await SpriteSheet.load('path/to/sprites.png');
     * ```
     * @returns Promise resolving to the created SpriteSheet.
     */
    private async createDemoSpriteSheet(): Promise<SpriteSheet> {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;

        // Fill with transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw simple shapes as sprites
        ctx.fillStyle = 'white';

        // Square (0, 0)
        ctx.fillRect(4, 4, 24, 24);

        // Circle (32, 0)
        ctx.beginPath();
        ctx.arc(48, 16, 12, 0, Math.PI * 2);
        ctx.fill();

        // Triangle (64, 0)
        ctx.beginPath();
        ctx.moveTo(80, 4);
        ctx.lineTo(92, 28);
        ctx.lineTo(68, 28);
        ctx.closePath();
        ctx.fill();

        // Star (96, 0)
        this.drawStar(ctx, 112, 16, 5, 12, 6);

        // Heart (0, 32)
        this.drawHeart(ctx, 16, 40, 10);

        // Diamond (32, 32)
        ctx.beginPath();
        ctx.moveTo(48, 36);
        ctx.lineTo(56, 48);
        ctx.lineTo(48, 60);
        ctx.lineTo(40, 48);
        ctx.closePath();
        ctx.fill();

        // Convert canvas to image
        const dataUrl = canvas.toDataURL();
        const image = new Image();
        await new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.src = dataUrl;
        });

        return new SpriteSheet(image);
    }

    /**
     * Draws a star polygon on a canvas context.
     * @param ctx - Canvas 2D rendering context.
     * @param cx - Center X coordinate.
     * @param cy - Center Y coordinate.
     * @param spikes - Number of star points.
     * @param outerRadius - Radius to outer points.
     * @param innerRadius - Radius to inner valleys.
     */
    private drawStar(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        spikes: number,
        outerRadius: number,
        innerRadius: number,
    ): void {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draws a heart shape using bezier curves.
     * @param ctx - Canvas 2D rendering context.
     * @param cx - Center X coordinate.
     * @param cy - Top center Y coordinate.
     * @param size - Heart size scale factor.
     */
    private drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
        ctx.beginPath();
        const topCurveHeight = size * 0.3;

        ctx.moveTo(cx, cy + topCurveHeight);
        // Left half
        ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight);
        ctx.bezierCurveTo(
            cx - size / 2,
            cy + (size + topCurveHeight) / 2,
            cx,
            cy + (size + topCurveHeight) * 1.3,
            cx,
            cy + size * 1.7,
        );
        // Right half
        ctx.bezierCurveTo(
            cx,
            cy + (size + topCurveHeight) * 1.3,
            cx + size / 2,
            cy + (size + topCurveHeight) / 2,
            cx + size / 2,
            cy + topCurveHeight,
        );
        ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Advances animation time for sprite effects.
     */
    update(): void {
        this.animTime += 0.016;
    }

    /**
     * Renders sprite demonstrations with tinting and animation.
     * Shows static colors, rainbow tints, pulsing alpha, and bouncing motion.
     */
    render(): void {
        // Clear to dark background
        BT.clear(new Color32(30, 20, 40));

        if (!this.spriteSheet) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading sprites...');
            return;
        }

        // Title
        BT.print(new Vector2i(10, 10), Color32.white(), 'BLITTECH SPRITE DEMO');

        // Row 1: Basic sprites with different colors
        BT.print(new Vector2i(10, 30), new Color32(200, 200, 200), 'Colored Sprites:');
        BT.drawSprite(this.spriteSheet, this.sprites.square, new Vector2i(10, 45), new Color32(255, 100, 100));
        BT.drawSprite(this.spriteSheet, this.sprites.circle, new Vector2i(50, 45), new Color32(100, 255, 100));
        BT.drawSprite(this.spriteSheet, this.sprites.triangle, new Vector2i(90, 45), new Color32(100, 100, 255));
        BT.drawSprite(this.spriteSheet, this.sprites.star, new Vector2i(130, 45), new Color32(255, 255, 100));

        // Row 2: Animated rainbow tints
        BT.print(new Vector2i(10, 85), new Color32(200, 200, 200), 'Rainbow Tints:');
        const hue1 = (this.animTime * 60) % 360;
        const hue2 = (this.animTime * 60 + 90) % 360;
        const hue3 = (this.animTime * 60 + 180) % 360;
        const hue4 = (this.animTime * 60 + 270) % 360;

        BT.drawSprite(this.spriteSheet, this.sprites.heart, new Vector2i(10, 100), this.hslToRgb(hue1, 100, 60));
        BT.drawSprite(this.spriteSheet, this.sprites.diamond, new Vector2i(50, 100), this.hslToRgb(hue2, 100, 60));
        BT.drawSprite(this.spriteSheet, this.sprites.circle, new Vector2i(90, 100), this.hslToRgb(hue3, 100, 60));
        BT.drawSprite(this.spriteSheet, this.sprites.star, new Vector2i(130, 100), this.hslToRgb(hue4, 100, 60));

        // Row 3: Pulsing opacity
        BT.print(new Vector2i(10, 140), new Color32(200, 200, 200), 'Pulsing:');
        const pulse = Math.sin(this.animTime * 3) * 0.5 + 0.5;
        const alpha = Math.floor(100 + pulse * 155);
        BT.drawSprite(this.spriteSheet, this.sprites.square, new Vector2i(10, 155), new Color32(255, 255, 255, alpha));
        BT.drawSprite(this.spriteSheet, this.sprites.circle, new Vector2i(50, 155), new Color32(255, 255, 255, alpha));
        BT.drawSprite(
            this.spriteSheet,
            this.sprites.triangle,
            new Vector2i(90, 155),
            new Color32(255, 255, 255, alpha),
        );

        // Row 4: Bouncing sprites
        BT.print(new Vector2i(10, 195), new Color32(200, 200, 200), 'Animated:');
        const bounce1 = Math.sin(this.animTime * 4) * 10;
        const bounce2 = Math.sin(this.animTime * 4 + 1) * 10;
        const bounce3 = Math.sin(this.animTime * 4 + 2) * 10;

        BT.drawSprite(this.spriteSheet, this.sprites.star, new Vector2i(10, 210 + bounce1), Color32.white());
        BT.drawSprite(
            this.spriteSheet,
            this.sprites.heart,
            new Vector2i(50, 210 + bounce2),
            new Color32(255, 100, 150),
        );
        BT.drawSprite(
            this.spriteSheet,
            this.sprites.diamond,
            new Vector2i(90, 210 + bounce3),
            new Color32(100, 200, 255),
        );

        // Instructions
        BT.print(new Vector2i(170, 30), new Color32(150, 150, 150), 'Load your own');
        BT.print(new Vector2i(170, 45), new Color32(150, 150, 150), 'sprite sheets:');
        BT.print(new Vector2i(170, 65), new Color32(100, 150, 200), 'const sheet =');
        BT.print(new Vector2i(170, 80), new Color32(100, 150, 200), '  await');
        BT.print(new Vector2i(170, 95), new Color32(100, 150, 200), '  SpriteSheet');
        BT.print(new Vector2i(170, 110), new Color32(100, 150, 200), '  .load(url);');
        BT.print(new Vector2i(170, 130), new Color32(100, 150, 200), 'BT.drawSprite(');
        BT.print(new Vector2i(170, 145), new Color32(100, 150, 200), '  sheet,');
        BT.print(new Vector2i(170, 160), new Color32(100, 150, 200), '  srcRect,');
        BT.print(new Vector2i(170, 175), new Color32(100, 150, 200), '  destPos,');
        BT.print(new Vector2i(170, 190), new Color32(100, 150, 200), '  tint');
        BT.print(new Vector2i(170, 205), new Color32(100, 150, 200), ');');
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
 * Validates WebGPU support and starts the sprite demo.
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

    const game = new SpriteDemo();

    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Sprite demo started successfully!');
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
