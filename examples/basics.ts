/**
 * Basic Blit–Tech Example
 *
 * Demonstrates the minimal setup required for a Blit–Tech game.
 * This example creates a simple moving square that bounces around the screen.
 * Note: Keyboard input (WASD, Arrow Keys) is planned but not yet implemented.
 */

import { BitmapFont, BT, Color32, type HardwareSettings, type IBlitTechGame, Rect2i, Vector2i } from '../src/BlitTech';

/**
 * A minimal game demonstrating core Blit–Tech functionality.
 * Shows hardware configuration, game loop, and basic rendering.
 * Note: Input handling is planned but not yet implemented in Phase 1.
 */
class BasicGame implements IBlitTechGame {
    // #region Module State

    /** Player position. */
    private playerPos: Vector2i = new Vector2i(160, 120);

    /** Player velocity. */
    private playerVel: Vector2i = new Vector2i(2, 1);

    /** Player size. */
    private playerSize: Vector2i = new Vector2i(16, 16);

    /** Background color. */
    private bgColor: Color32 = new Color32(50, 100, 150);

    /** Player color. */
    private playerColor: Color32 = Color32.white();

    /** Font for text rendering. */
    private font: BitmapFont | null = null;

    // #endregion

    // #region IBlitTechGame Implementation

    /**
     * Configures hardware settings for this game.
     * Sets up a 320×240 internal resolution with 2x CSS upscaling.
     *
     * @returns Hardware configuration specifying display size and target FPS.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240), // Internal rendering resolution.
            canvasDisplaySize: new Vector2i(640, 480), // CSS display size (2x upscale).
            targetFPS: 60,
        };
    }

    /**
     * Initializes game state after the engine is ready.
     * Centers the player on screen and loads bitmap font.
     *
     * @returns Promise resolving to true when initialization succeeds.
     */
    async initialize(): Promise<boolean> {
        console.log('[BasicGame] Initializing...');

        // Load bitmap font from .btfont file.
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');
            console.log(`[BasicGame] Loaded font: ${this.font.name} (${this.font.glyphCount} glyphs)`);
        } catch (error) {
            console.warn('[BasicGame] Failed to load font, will use fallback:', error);
        }

        // Center player on screen.
        const displaySize = BT.displaySize();
        this.playerPos = new Vector2i(
            Math.floor(displaySize.x / 2 - this.playerSize.x / 2),
            Math.floor(displaySize.y / 2 - this.playerSize.y / 2),
        );

        console.log('[BasicGame] Initialization complete!');

        return true;
    }

    /**
     * Updates animation state based on ticks.
     * Auto-moves the square and bounces off-screen edges.
     * Note: Keyboard input (WASD, Arrow Keys) is planned but not yet implemented.
     */
    update(): void {
        // Update position.
        this.playerPos = this.playerPos.add(this.playerVel);

        // Bounce off screen edges.
        const displaySize = BT.displaySize();

        // Bounce off screen edges horizontally.
        if (this.playerPos.x <= 0 || this.playerPos.x >= displaySize.x - this.playerSize.x) {
            this.playerVel.x = -this.playerVel.x;
            this.playerPos.x = Math.max(0, Math.min(displaySize.x - this.playerSize.x, this.playerPos.x));
        }

        // Bounce off screen edges vertically.
        if (this.playerPos.y <= 0 || this.playerPos.y >= displaySize.y - this.playerSize.y) {
            this.playerVel.y = -this.playerVel.y;
            this.playerPos.y = Math.max(0, Math.min(displaySize.y - this.playerSize.y, this.playerPos.y));
        }
    }

    /**
     * Renders game graphics.
     * Clears screen, draws player square, and displays UI text using bitmap font.
     */
    render(): void {
        // Clear screen.
        BT.clear(this.bgColor);

        // Draw player.
        const playerRect = new Rect2i(this.playerPos.x, this.playerPos.y, this.playerSize.x, this.playerSize.y);
        BT.drawRectFill(playerRect, this.playerColor);

        // Draw UI with bitmap font.
        if (this.font) {
            BT.printFont(this.font, new Vector2i(10, 10), `FPS: ${BT.fps()}`, Color32.white());

            BT.printFont(
                this.font,
                new Vector2i(10, 26),
                `Position: ${this.playerPos.x}, ${this.playerPos.y}`,
                Color32.white(),
            );

            BT.printFont(
                this.font,
                new Vector2i(10, 42),
                'Auto-bouncing (input not yet implemented)',
                new Color32(180, 180, 180),
            );
        } else {
            // Fallback to basic print if font not loaded.
            BT.print(new Vector2i(10, 10), Color32.white(), 'Font not loaded');
        }
    }

    // #endregion
}

// #region Helper Functions

/**
 * Displays an error message in the page UI.
 * Replaces the canvas container with a styled error box.
 *
 * @param title - Error heading text.
 * @param message - Detailed error description (HTML supported).
 */
function showError(title: string, message: string): void {
    const container = document.getElementById('canvas-container');

    if (container) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ff6b6b; background: #2a0000; border: 2px solid #ff0000; border-radius: 8px; max-width: 600px;">
                <h2 style="margin-top: 0; font-size: 24px;">[X] ${title}</h2>
                <p style="margin: 20px 0; line-height: 1.6;">${message}</p>
                <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">Check the browser console for more details.</p>
            </div>
        `;
    }
}

/**
 * Checks if WebGPU is supported in the current browser.
 *
 * @returns True if WebGPU is available, false otherwise.
 */
function isWebGPUSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Gets the game canvas element from the DOM.
 *
 * @returns The canvas element, or null if not found.
 */
function getGameCanvas(): HTMLCanvasElement | null {
    return document.getElementById('game-canvas') as HTMLCanvasElement | null;
}

// #endregion

// #region Main Logic

/**
 * Application entry point.
 * Checks WebGPU support, creates game instance, and starts the engine.
 */
async function main(): Promise<void> {
    console.log('[Main] Starting Basic Example...');

    // Check WebGPU support.
    if (!isWebGPUSupported()) {
        showError(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU.<br><br>' +
                '<strong>Supported browsers:</strong><br>' +
                '• Chrome/Edge 113+<br>' +
                '• Firefox Nightly (with the flag enabled)<br><br>' +
                'Please update your browser or try a different one.',
        );

        console.error('[Main] WebGPU not supported');

        return;
    }

    // Get canvas element.
    const canvas = getGameCanvas();

    if (!canvas) {
        console.error('[Main] Canvas element not found!');

        showError('Canvas Error', 'Failed to find canvas element.');

        return;
    }

    // Create game instance.
    const game = new BasicGame();

    // Initialize engine.
    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Game started successfully!');
    } else {
        console.error('[Main] Failed to initialize game');

        showError(
            'Initialization Failed',
            'The game engine failed to initialize.<br><br>' +
                'This usually means WebGPU could not access your GPU.<br>' +
                'Check the console for detailed error messages.',
        );
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
