/**
 * Sprite Effects & Tinting Demo
 *
 * Demonstrates practical sprite tinting effects commonly used in 2D games.
 * Shows how to use BT.drawSprite() with tint colors for various visual effects:
 * - Damage flash (red/white pulse on hit)
 * - Silhouettes and shadows (black tint)
 * - Ghost/fade effects (white tint + alpha)
 * - Environmental color grading (ambient lighting)
 * - Team colors (palette swaps via tinting)
 * - Day/night cycle color shifts
 */

import {
    BitmapFont,
    BT,
    Color32,
    type HardwareSettings,
    type IBlitTechGame,
    Rect2i,
    SpriteSheet,
    Vector2i,
} from '../src/BlitTech';

/**
 * Demonstrates practical sprite tinting effects for games.
 */
class SpriteEffectsDemo implements IBlitTechGame {
    // #region Module State

    /** Bitmap font for UI text. */
    private font: BitmapFont | null = null;

    /** Sprite sheet with character sprite. */
    private spriteSheet: SpriteSheet | null = null;

    /** Animation time for effects. */
    private animTime: number = 0;

    /** Damage flash trigger timer. */
    private damageFlashTick: number = 0;

    /** Source rectangle for character sprite in sheet. */
    private readonly charSprite = new Rect2i(0, 0, 32, 32);

    // #endregion

    // #region IBlitTechGame Implementation

    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            targetFPS: 60,
        };
    }

    async initialize(): Promise<boolean> {
        console.log('[SpriteEffectsDemo] Initializing...');

        // Load font
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');
            console.log(`[SpriteEffectsDemo] Loaded font: ${this.font.name}`);
        } catch (error) {
            console.error('[SpriteEffectsDemo] Failed to load font:', error);
            return false;
        }

        // Create character sprite sheet
        this.spriteSheet = await this.createCharacterSprite();
        console.log('[SpriteEffectsDemo] Created sprite sheet');

        console.log('[SpriteEffectsDemo] Initialization complete!');
        return true;
    }

    update(): void {
        this.animTime += 1 / 60;

        // Trigger damage flash periodically
        if (BT.ticks() % 180 === 0) {
            this.damageFlashTick = BT.ticks();
        }
    }

    render(): void {
        // Clear screen
        BT.clear(new Color32(25, 25, 35));

        if (!this.font || !this.spriteSheet) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading...');
            return;
        }

        // Title
        BT.printFont(this.font, new Vector2i(10, 8), 'SPRITE TINTING EFFECTS', Color32.white());

        // Draw all effect demonstrations
        this.drawEffectExamples();

        // Draw day/night cycle demo
        this.drawDayNightCycle();

        // FPS counter
        BT.printFont(this.font, new Vector2i(250, 225), `FPS: ${BT.fps()}`, new Color32(100, 100, 100));
    }

    // #endregion

    // #region Effect Demonstrations

    /**
     * Draws various sprite tinting effects side by side.
     */
    private drawEffectExamples(): void {
        if (!this.spriteSheet || !this.font) return;

        // Row 1: Basic tinting effects
        const row1Y = 35;
        const spacing = 55;

        // Normal (no tint)
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15, row1Y), Color32.white());
        BT.printFont(this.font, new Vector2i(10, row1Y + 36), 'Normal', new Color32(200, 200, 200));

        // Damage flash (pulsing red/white)
        const flashAge = BT.ticks() - this.damageFlashTick;
        let flashTint: Color32;
        if (flashAge < 30) {
            // Flash effect: alternate red and white rapidly
            const flashPhase = Math.floor(flashAge / 3) % 2;
            flashTint = flashPhase === 0 ? new Color32(255, 255, 255) : new Color32(255, 50, 50);
        } else {
            flashTint = Color32.white();
        }
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15 + spacing, row1Y), flashTint);
        BT.printFont(this.font, new Vector2i(10 + spacing, row1Y + 36), 'Damage', new Color32(255, 100, 100));

        // Silhouette (solid black)
        const silhouetteTint = new Color32(0, 0, 0);
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15 + spacing * 2, row1Y), silhouetteTint);
        BT.printFont(this.font, new Vector2i(10 + spacing * 2, row1Y + 36), 'Shadow', new Color32(150, 150, 150));

        // Ghost effect (white tint + reduced alpha)
        const ghostPulse = Math.sin(this.animTime * 3) * 0.3 + 0.5;
        const ghostTint = new Color32(200, 200, 255, Math.floor(ghostPulse * 255));
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15 + spacing * 3, row1Y), ghostTint);
        BT.printFont(this.font, new Vector2i(10 + spacing * 3, row1Y + 36), 'Ghost', new Color32(150, 150, 200));

        // Invincibility flash (rainbow)
        const invincHue = (this.animTime * 200) % 360;
        const invincTint = this.hslToRgb(invincHue, 100, 70);
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15 + spacing * 4, row1Y), invincTint);
        BT.printFont(this.font, new Vector2i(10 + spacing * 4, row1Y + 36), 'Invincible', new Color32(255, 200, 100));

        // Row 2: Team colors and environmental lighting
        const row2Y = 105;

        // Team Red
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15, row2Y), new Color32(255, 100, 100));
        BT.printFont(this.font, new Vector2i(10, row2Y + 36), 'Team Red', new Color32(255, 100, 100));

        // Team Blue
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15 + spacing, row2Y), new Color32(100, 100, 255));
        BT.printFont(this.font, new Vector2i(10 + spacing, row2Y + 36), 'Team Blue', new Color32(100, 150, 255));

        // Team Green
        BT.drawSprite(
            this.spriteSheet,
            this.charSprite,
            new Vector2i(15 + spacing * 2, row2Y),
            new Color32(100, 255, 100),
        );
        BT.printFont(this.font, new Vector2i(10 + spacing * 2, row2Y + 36), 'Team Green', new Color32(100, 255, 100));

        // Frozen (cyan/blue tint)
        BT.drawSprite(
            this.spriteSheet,
            this.charSprite,
            new Vector2i(15 + spacing * 3, row2Y),
            new Color32(150, 200, 255),
        );
        BT.printFont(this.font, new Vector2i(10 + spacing * 3, row2Y + 36), 'Frozen', new Color32(150, 200, 255));

        // Poisoned (green tint with pulse)
        const poisonPulse = Math.sin(this.animTime * 5) * 0.2 + 0.8;
        const poisonTint = new Color32(
            Math.floor(100 * poisonPulse),
            Math.floor(255 * poisonPulse),
            Math.floor(100 * poisonPulse),
        );
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15 + spacing * 4, row2Y), poisonTint);
        BT.printFont(this.font, new Vector2i(10 + spacing * 4, row2Y + 36), 'Poisoned', new Color32(100, 255, 100));
    }

    /**
     * Demonstrates day/night cycle color grading.
     */
    private drawDayNightCycle(): void {
        if (!this.spriteSheet || !this.font) return;

        const baseY = 175;

        BT.printFont(this.font, new Vector2i(10, baseY), 'Day/Night Cycle:', new Color32(255, 200, 100));

        // Cycle through different times of day
        const cycleTime = (this.animTime * 0.5) % 4;

        let timeName: string;
        let ambientTint: Color32;

        if (cycleTime < 1) {
            // Day
            timeName = 'Day';
            ambientTint = new Color32(255, 255, 255);
        } else if (cycleTime < 2) {
            // Sunset
            timeName = 'Sunset';
            ambientTint = new Color32(255, 180, 120);
        } else if (cycleTime < 3) {
            // Night
            timeName = 'Night';
            ambientTint = new Color32(80, 80, 150);
        } else {
            // Dawn
            timeName = 'Dawn';
            ambientTint = new Color32(180, 150, 200);
        }

        // Draw character with ambient lighting
        BT.drawSprite(this.spriteSheet, this.charSprite, new Vector2i(15, baseY + 20), ambientTint);

        // Time label
        BT.printFont(this.font, new Vector2i(10, baseY + 56), timeName, ambientTint);

        // Draw progression bar
        const barX = 60;
        const barY = baseY + 25;
        const barWidth = 240;
        const barHeight = 10;

        // Background
        BT.drawRectFill(new Rect2i(barX, barY, barWidth, barHeight), new Color32(30, 30, 30));

        // Progress indicator
        const progress = (cycleTime % 4) / 4;
        const indicatorX = barX + Math.floor(barWidth * progress);
        BT.drawRectFill(new Rect2i(indicatorX - 2, barY - 2, 4, barHeight + 4), ambientTint);

        // Border
        BT.drawRect(new Rect2i(barX, barY, barWidth, barHeight), new Color32(150, 150, 150));

        // Time labels
        BT.printFont(this.font, new Vector2i(barX, barY + 14), 'Day', new Color32(150, 150, 150));
        BT.printFont(this.font, new Vector2i(barX + 60, barY + 14), 'Sunset', new Color32(150, 150, 150));
        BT.printFont(this.font, new Vector2i(barX + 120, barY + 14), 'Night', new Color32(150, 150, 150));
        BT.printFont(this.font, new Vector2i(barX + 180, barY + 14), 'Dawn', new Color32(150, 150, 150));
    }

    // #endregion

    // #region Sprite Creation

    /**
     * Creates a simple character sprite for demonstration.
     */
    private async createCharacterSprite(): Promise<SpriteSheet> {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('[SpriteEffectsDemo] Failed to acquire 2D canvas context');
        }

        // Clear background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, size, size);

        // Draw simple character in white
        ctx.fillStyle = 'white';

        // Head
        ctx.beginPath();
        ctx.arc(16, 10, 6, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(12, 16, 8, 10);

        // Arms
        ctx.fillRect(8, 18, 4, 6);
        ctx.fillRect(20, 18, 4, 6);

        // Legs
        ctx.fillRect(12, 26, 4, 6);
        ctx.fillRect(16, 26, 4, 6);

        // Convert to image
        const dataUrl = canvas.toDataURL();
        const image = new Image();
        await new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.src = dataUrl;
        });

        return new SpriteSheet(image);
    }

    // #endregion

    // #region Helper Functions

    /**
     * Converts HSL to RGB color.
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

function showError(title: string, message: string): void {
    const container = document.getElementById('canvas-container');
    if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText =
            'padding: 40px; text-align: center; color: #ff6b6b; background: #2a0000; border-radius: 8px;';

        const heading = document.createElement('h2');
        heading.textContent = `[X] ${title}`;
        errorDiv.appendChild(heading);

        const msg = document.createElement('p');
        msg.style.cssText = 'margin: 20px 0;';
        msg.textContent = message;
        errorDiv.appendChild(msg);

        const consoleMsg = document.createElement('p');
        consoleMsg.style.cssText = 'font-size: 0.9em; color: #ff9999;';
        consoleMsg.textContent = 'Check the browser console for more details.';
        errorDiv.appendChild(consoleMsg);

        container.innerHTML = '';
        container.appendChild(errorDiv);
    }
}

// #endregion

// #region Main Logic

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

    const game = new SpriteEffectsDemo();

    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Sprite effects demo started successfully!');
    } else {
        showError('Initialization Failed', 'Failed to initialize Blit–Tech engine. Check console for details.');
    }
}

// #endregion

// #region App Lifecycle

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

// #endregion
