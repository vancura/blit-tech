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

// #region Imports

import { BitmapFont, BT, Color32, type HardwareSettings, type IBlitTechGame, Vector2i } from '../src/BlitTech';

// #endregion

// #region Game Class

/**
 * Demonstrates bitmap font rendering with various text effects.
 * Shows static colors, animated rainbow effects, and text measurement.
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
     * Configures hardware settings for this demo.
     * Sets up a 320×240 internal resolution with 2× CSS upscaling.
     *
     * @returns Hardware configuration specifying display size and target FPS.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            targetFPS: 60,
        };
    }

    /**
     * Initializes the demo after the engine is ready.
     * Loads the bitmap font from a .btfont file.
     *
     * @returns Promise resolving to true when initialization succeeds.
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
     * Updates the animation state each tick.
     * Increments the animation timer for time-based effects.
     */
    update(): void {
        this.animTime += 1 / 60; // Assuming 60 FPS.
    }

    /**
     * Renders text demonstrations with various colors and effects.
     * Shows static colors, rainbow animation, pulsing brightness, and text measurement.
     */
    render(): void {
        // Clear to dark blue.
        BT.clear(new Color32(20, 30, 50));

        if (!this.font) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading font...');

            return;
        }

        let y = 10;
        const lineHeight = this.font.lineHeight + 2;

        // Title.
        BT.printFont(this.font, new Vector2i(10, y), 'Blit–Tech Font Demo', Color32.white());

        y += lineHeight + 4;

        // Render demonstration sections.
        y = this.renderColoredText(y, lineHeight);
        y = this.renderRainbowText(y, lineHeight);
        y = this.renderPulsingText(y, lineHeight);
        y = this.renderSpecialCharacters(y, lineHeight);
        y = this.renderTextMeasurement(y, lineHeight);

        this.renderFontInfo(y, lineHeight);
    }

    // #endregion

    // #region Rendering Helpers

    /**
     * Renders text in different colors.
     *
     * @param y - Starting Y position.
     * @param lineHeight - Height between lines.
     * @returns Next Y position after rendering.
     */
    private renderColoredText(y: number, lineHeight: number): number {
        if (!this.font) return y;

        BT.printFont(this.font, new Vector2i(10, y), 'Red Text', new Color32(255, 100, 100));
        y += lineHeight;

        BT.printFont(this.font, new Vector2i(10, y), 'Green Text', new Color32(100, 255, 100));
        y += lineHeight;

        BT.printFont(this.font, new Vector2i(10, y), 'Blue Text', new Color32(100, 100, 255));
        y += lineHeight;

        BT.printFont(this.font, new Vector2i(10, y), 'Yellow Text', new Color32(255, 255, 100));
        y += lineHeight + 4;

        return y;
    }

    /**
     * Renders animated rainbow text with per-character color cycling.
     *
     * @param y - Starting Y position.
     * @param lineHeight - Height between lines.
     * @returns Next Y position after rendering.
     */
    private renderRainbowText(y: number, lineHeight: number): number {
        if (!this.font) return y;

        const rainbowText = 'Rainbow Animation!';
        let x = 10;

        for (const char of rainbowText) {
            const hue = (x * 3 + this.animTime * 100) % 360;
            const color = Color32.fromHSL(hue, 100, 60);

            BT.printFont(this.font, new Vector2i(x, y), char, color);

            const glyph = this.font.getGlyph(char);

            x += glyph ? glyph.advance : 7;
        }

        return y + lineHeight + 4;
    }

    /**
     * Renders pulsing text with brightness animation.
     *
     * @param y - Starting Y position.
     * @param lineHeight - Height between lines.
     * @returns Next Y position after rendering.
     */
    private renderPulsingText(y: number, lineHeight: number): number {
        if (!this.font) return y;

        const pulse = Math.sin(this.animTime * 3) * 0.5 + 0.5;
        const pulseColor = new Color32(Math.floor(100 + pulse * 155), Math.floor(100 + pulse * 155), 255);

        BT.printFont(this.font, new Vector2i(10, y), 'Pulsing Text', pulseColor);

        return y + lineHeight + 4;
    }

    /**
     * Renders text with special characters.
     *
     * @param y - Starting Y position.
     * @param lineHeight - Height between lines.
     * @returns Next Y position after rendering.
     */
    private renderSpecialCharacters(y: number, lineHeight: number): number {
        if (!this.font) return y;

        BT.printFont(this.font, new Vector2i(10, y), 'Special: 3 x 4 = 12', Color32.white());

        return y + lineHeight;
    }

    /**
     * Renders text measurement demonstration with an underline.
     *
     * @param y - Starting Y position.
     * @param lineHeight - Height between lines.
     * @returns Next Y position after rendering.
     */
    private renderTextMeasurement(y: number, lineHeight: number): number {
        if (!this.font) return y;

        const measureText = 'Measured Width';
        const textWidth = this.font.measureText(measureText);

        BT.printFont(this.font, new Vector2i(10, y), measureText, new Color32(200, 200, 200));

        // Draw underline showing measured width.
        BT.drawLine(
            new Vector2i(10, y + lineHeight - 2),
            new Vector2i(10 + textWidth, y + lineHeight - 2),
            new Color32(255, 200, 100),
        );

        return y + lineHeight + 4;
    }

    /**
     * Renders font information and FPS counter.
     *
     * @param y - Starting Y position.
     * @param lineHeight - Height between lines.
     */
    private renderFontInfo(y: number, lineHeight: number): void {
        if (!this.font) return;

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

    // #endregion
}

// #endregion

// #region Helper Functions

/**
 * Displays an error message in the page UI.
 * Replaces the canvas container with a styled error box.
 *
 * @param title - Error heading text.
 * @param message - Detailed error description.
 */
function displayErrorMessage(title: string, message: string): void {
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

/**
 * Checks if WebGPU is supported in the current browser.
 *
 * @returns True if WebGPU is available, false otherwise.
 */
function checkWebGPUSupport(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Retrieves the game canvas element from the DOM.
 *
 * @returns The canvas element if found and valid, null otherwise.
 */
function getCanvasElement(): HTMLCanvasElement | null {
    const canvas = document.getElementById('game-canvas');

    return canvas instanceof HTMLCanvasElement ? canvas : null;
}

// #endregion

// #region Main Logic

/**
 * Application entry point.
 * Validates WebGPU support, retrieves canvas, and initializes the font demo.
 */
async function initializeApplication(): Promise<void> {
    // Validate WebGPU support.
    if (!checkWebGPUSupport()) {
        displayErrorMessage(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU. Please use Chrome/Edge 113+ or Firefox Nightly.',
        );

        return;
    }

    // Retrieve canvas element.
    const canvas = getCanvasElement();

    if (!canvas) {
        console.error('[Main] Canvas element not found or is not a <canvas>');

        return;
    }

    // Create a game instance.
    const game = new FontDemo();

    // Initialize the engine.
    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Font demo started successfully!');
    } else {
        displayErrorMessage(
            'Initialization Failed',
            'Failed to initialize Blit–Tech engine. Check console for details.',
        );
    }
}

// #endregion

// #region App Lifecycle

/**
 * Handles DOM ready state and starts the application.
 * Waits for DOM to be ready if still loading, otherwise starts immediately.
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    initializeApplication();
}

// #endregion
