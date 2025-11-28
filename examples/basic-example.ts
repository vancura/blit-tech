/**
 * Basic Blit-Tech Example
 *
 * Demonstrates the minimal setup required for a Blit-Tech game.
 * This example creates a simple moving square that responds to keyboard input.
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
 * A minimal game demonstrating core Blit-Tech functionality.
 * Shows hardware configuration, game loop, input handling, and basic rendering.
 */
class BasicGame implements IBlitTechGame {
    // Player state
    private playerPos: Vector2i = new Vector2i(160, 120);
    private playerVel: Vector2i = new Vector2i(0, 0);
    private playerSize: Vector2i = new Vector2i(16, 16);

    // Game state
    private bgColor: Color32 = new Color32(50, 100, 150);
    private playerColor: Color32 = Color32.white();

    // Font for text rendering
    private font: BitmapFont | null = null;

    /**
     * Configures hardware settings for this game.
     * Sets up a 320x240 internal resolution with 2x CSS upscaling.
     * @returns Hardware configuration specifying display size, map dimensions, and target FPS.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240), // Internal rendering resolution
            canvasDisplaySize: new Vector2i(640, 480), // CSS display size (2x upscale)
            mapSize: new Vector2i(128, 128),
            mapLayers: 4,
            chunkSize: new Vector2i(16, 16),
            targetFPS: 60,
        };
    }

    /**
     * Initializes game state after the engine is ready.
     * Centers the player on screen and loads bitmap font.
     * @returns Promise resolving to true when initialization succeeds.
     */
    async initialize(): Promise<boolean> {
        console.log('[BasicGame] Initializing...');

        // Create a simple bitmap font for text rendering
        this.font = await this.createSimpleFont();

        // Center player on screen
        const displaySize = BT.displaySize();
        this.playerPos = new Vector2i(
            Math.floor(displaySize.x / 2 - this.playerSize.x / 2),
            Math.floor(displaySize.y / 2 - this.playerSize.y / 2),
        );

        console.log('[BasicGame] Initialization complete!');
        return true;
    }

    /**
     * Creates a simple 8x8 bitmap font programmatically.
     * Uses canvas text rendering to generate glyph texture.
     * @returns Promise resolving to the created BitmapFont.
     */
    private async createSimpleFont(): Promise<BitmapFont> {
        // Character set for basic text rendering
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
     * Updates game logic at fixed 60 FPS.
     * Handles WASD/Arrow key input for player movement and clamps to screen bounds.
     */
    update(): void {
        // Reset velocity
        this.playerVel = Vector2i.zero();

        // Handle keyboard input
        const moveSpeed = 2;

        if (BT.keyDown('ArrowLeft') || BT.keyDown('KeyA')) {
            this.playerVel.x = -moveSpeed;
        }
        if (BT.keyDown('ArrowRight') || BT.keyDown('KeyD')) {
            this.playerVel.x = moveSpeed;
        }
        if (BT.keyDown('ArrowUp') || BT.keyDown('KeyW')) {
            this.playerVel.y = -moveSpeed;
        }
        if (BT.keyDown('ArrowDown') || BT.keyDown('KeyS')) {
            this.playerVel.y = moveSpeed;
        }

        // Update position
        this.playerPos = this.playerPos.add(this.playerVel);

        // Clamp to screen bounds
        const displaySize = BT.displaySize();
        this.playerPos.x = Math.max(0, Math.min(displaySize.x - this.playerSize.x, this.playerPos.x));
        this.playerPos.y = Math.max(0, Math.min(displaySize.y - this.playerSize.y, this.playerPos.y));

        // Debug: Log position every 60 frames
        if (BT.ticks() % 60 === 0) {
            console.log(`[BasicGame] Tick ${BT.ticks()}, Player at (${this.playerPos.x}, ${this.playerPos.y})`);
        }
    }

    /**
     * Renders game graphics.
     * Clears screen, draws player square, and displays UI text using bitmap font.
     */
    render(): void {
        // Clear screen
        BT.clear(this.bgColor);

        // Draw player
        const playerRect = new Rect2i(this.playerPos.x, this.playerPos.y, this.playerSize.x, this.playerSize.y);
        BT.drawRectFill(playerRect, this.playerColor);

        // Draw UI with bitmap font
        if (this.font) {
            BT.printFont(this.font, new Vector2i(10, 10), `FPS: ${BT.fps()}`, Color32.white());

            BT.printFont(
                this.font,
                new Vector2i(10, 20),
                `Position: ${this.playerPos.x}, ${this.playerPos.y}`,
                Color32.white(),
            );

            BT.printFont(this.font, new Vector2i(10, 30), 'Use WASD or Arrow Keys to move', Color32.white());
        } else {
            // Fallback to basic print if font not loaded yet
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading font...');
        }
    }
}

/**
 * Displays an error message in the page UI.
 * Replaces the canvas container with a styled error box.
 * @param title - Error heading text.
 * @param message - Detailed error description (HTML supported).
 */
function showError(title: string, message: string) {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ff6b6b; background: #2a0000; border: 2px solid #ff0000; border-radius: 8px; max-width: 600px;">
                <h2 style="margin-top: 0; font-size: 24px;">❌ ${title}</h2>
                <p style="margin: 20px 0; line-height: 1.6;">${message}</p>
                <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">Check the browser console for more details.</p>
            </div>
        `;
    }
}

/**
 * Application entry point.
 * Checks WebGPU support, creates game instance, and starts the engine.
 */
async function main() {
    console.log('[Main] Starting Basic Example...');

    // Check WebGPU support
    if (!navigator.gpu) {
        showError(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU.<br><br>' +
                '<strong>Supported browsers:</strong><br>' +
                '• Chrome/Edge 113+<br>' +
                '• Firefox Nightly (with flag enabled)<br><br>' +
                'Please update your browser or try a different one.',
        );
        console.error('[Main] WebGPU not supported');
        return;
    }

    // Get canvas element
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('[Main] Canvas element not found!');
        showError('Canvas Error', 'Failed to find canvas element.');
        return;
    }

    // Create game instance
    const game = new BasicGame();

    // Initialize engine
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

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
