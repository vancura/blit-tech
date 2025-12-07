/**
 * Camera Demo
 *
 * Showcases camera scrolling functionality in Blit–Tech.
 * Creates a large procedural world (800×600) that can be explored
 * via automatic camera panning, demonstrating:
 * - Camera offset for scrolling
 * - World-space vs. screen-space rendering
 * - Mini-map with viewport indicator
 */

// #region Imports

import { BitmapFont, BT, Color32, type HardwareSettings, type IBlitTechGame, Rect2i, Vector2i } from '../src/BlitTech';

// #endregion

// #region Game Class

/**
 * Demonstrates camera scrolling with a procedurally generated city.
 * Buildings and trees are randomly placed, camera auto-scrolls in a smooth sinusoidal pattern.
 */
class CameraDemo implements IBlitTechGame {
    // #region Module State

    /** World width in pixels (larger than display to enable scrolling). */
    private worldWidth: number = 800;

    /** World height in pixels. */
    private worldHeight: number = 600;

    /** Current camera position in world coordinates. */
    private cameraPos: Vector2i = new Vector2i(0, 0);

    /** Player position in world coordinates (stationary for this demo). */
    private playerPos: Vector2i = new Vector2i(400, 300);

    /** Procedurally generated building data. */
    private buildings: Array<{ pos: Vector2i; size: Vector2i; color: Color32 }> = [];

    /** Procedurally generated tree positions. */
    private trees: Array<{ pos: Vector2i }> = [];

    /** Bitmap font for text rendering. */
    private font: BitmapFont | null = null;

    // #endregion

    // #region Pre-allocated Reusable Objects (Performance)

    /** Reusable vector for drawing operations to avoid allocations. */
    private readonly tempVec1 = new Vector2i(0, 0);

    /** Reusable vector for drawing operations to avoid allocations. */
    private readonly tempVec2 = new Vector2i(0, 0);

    /** Reusable rectangle for drawing operations to avoid allocations. */
    private readonly tempRect = new Rect2i(0, 0, 0, 0);

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
            displaySize: new Vector2i(320, 240), // Internal rendering resolution.
            canvasDisplaySize: new Vector2i(640, 480), // CSS display size (2× upscale).
            targetFPS: 60,
        };
    }

    /**
     * Initializes the demo after the engine is ready.
     * Generates random buildings and trees to populate the world and loads font.
     *
     * @returns Promise resolving to true when initialization succeeds.
     */
    async initialize(): Promise<boolean> {
        console.log('[CameraDemo] Initializing...');

        // Load bitmap font for text rendering.
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');

            console.log(`[CameraDemo] Loaded font: ${this.font.name} (${this.font.glyphCount} glyphs)`);
        } catch (error) {
            console.error('[CameraDemo] Failed to load font:', error);

            return false;
        }

        // Generate random buildings.
        this.generateBuildings();

        // Generate random trees.
        this.generateTrees();

        console.log('[CameraDemo] Initialized');

        return true;
    }

    /**
     * Updates camera position each tick using a smooth sinusoidal pattern.
     * In a real game, you would use input to control camera movement.
     */
    update(): void {
        // Note: Input not implemented yet, so we auto-scroll the camera.
        // In a real game, you would use BT.keyDown() here.

        // Auto-scroll camera in a sinusoidal pattern.
        const t = BT.ticks() * 0.02;
        this.cameraPos.x = Math.floor(200 + Math.sin(t) * 150);
        this.cameraPos.y = Math.floor(150 + Math.cos(t * 0.7) * 100);

        // Clamp camera to world bounds.
        const displaySize = BT.displaySize();
        this.cameraPos.x = Math.max(0, Math.min(this.worldWidth - displaySize.x, this.cameraPos.x));
        this.cameraPos.y = Math.max(0, Math.min(this.worldHeight - displaySize.y, this.cameraPos.y));

        // Apply camera offset.
        BT.cameraSet(this.cameraPos);
    }

    /**
     * Renders the world with camera offset, then UI without offset.
     * Demonstrates the difference between world-space and screen-space drawing.
     */
    render(): void {
        // Clear to sky blue.
        BT.clear(new Color32(135, 206, 235));

        // Draw world content (affected by camera).
        this.renderWorld();

        // Reset camera for UI drawing (screen-space).
        BT.cameraReset();

        // Draw UI overlay (not affected by camera).
        this.renderUI();
    }

    // #endregion

    // #region World Generation

    /**
     * Generates random building positions, sizes, and colors.
     */
    private generateBuildings(): void {
        for (let i = 0; i < 20; i++) {
            this.buildings.push({
                pos: new Vector2i(
                    Math.floor(Math.random() * (this.worldWidth - 50)),
                    Math.floor(Math.random() * (this.worldHeight - 50)),
                ),
                size: new Vector2i(30 + Math.floor(Math.random() * 40), 40 + Math.floor(Math.random() * 60)),
                color: new Color32(
                    100 + Math.floor(Math.random() * 100),
                    100 + Math.floor(Math.random() * 100),
                    150 + Math.floor(Math.random() * 100),
                ),
            });
        }
    }

    /**
     * Generates random tree positions across the world.
     */
    private generateTrees(): void {
        for (let i = 0; i < 50; i++) {
            this.trees.push({
                pos: new Vector2i(
                    Math.floor(Math.random() * this.worldWidth),
                    Math.floor(Math.random() * this.worldHeight),
                ),
            });
        }
    }

    // #endregion

    // #region World Rendering

    /**
     * Renders all world elements in world coordinates (affected by camera).
     */
    private renderWorld(): void {
        // Draw ground grid.
        this.renderGrid();

        // Draw world boundaries.
        this.tempRect.set(0, 0, this.worldWidth, this.worldHeight);
        BT.drawRect(this.tempRect, new Color32(255, 0, 0));

        // Draw trees (behind buildings).
        for (const tree of this.trees) {
            this.renderTree(tree.pos);
        }

        // Pre-create colors outside loop to avoid allocations.
        const outlineColor = new Color32(50, 50, 50);
        const windowColor = new Color32(255, 255, 200, 200);

        // Draw buildings.
        for (const building of this.buildings) {
            this.renderBuilding(building, outlineColor, windowColor);
        }

        // Draw player.
        this.renderPlayer();
    }

    /**
     * Draws a ground grid pattern spanning the entire world.
     */
    private renderGrid(): void {
        const gridSize = 40;
        const color = new Color32(100, 180, 100);

        // Vertical lines.
        for (let x = 0; x < this.worldWidth; x += gridSize) {
            this.tempVec1.set(x, 0);
            this.tempVec2.set(x, this.worldHeight);

            BT.drawLine(this.tempVec1, this.tempVec2, color);
        }

        // Horizontal lines.
        for (let y = 0; y < this.worldHeight; y += gridSize) {
            this.tempVec1.set(0, y);
            this.tempVec2.set(this.worldWidth, y);

            BT.drawLine(this.tempVec1, this.tempVec2, color);
        }
    }

    /**
     * Renders a single tree sprite at the given world position.
     *
     * @param pos - Tree center position in world coordinates.
     */
    private renderTree(pos: Vector2i): void {
        // Trunk.
        this.tempRect.set(pos.x - 2, pos.y - 8, 4, 8);

        BT.drawRectFill(this.tempRect, new Color32(101, 67, 33));

        // Foliage.
        this.tempRect.set(pos.x - 6, pos.y - 16, 12, 12);

        BT.drawRectFill(this.tempRect, new Color32(34, 139, 34));
        BT.drawRect(this.tempRect, new Color32(20, 100, 20));
    }

    /**
     * Renders a single building with body, outline, and windows.
     *
     * @param building - Building data containing position, size, and color.
     * @param outlineColor - Color for building outline.
     * @param windowColor - Color for building windows.
     */
    private renderBuilding(
        building: { pos: Vector2i; size: Vector2i; color: Color32 },
        outlineColor: Color32,
        windowColor: Color32,
    ): void {
        // Building body.
        this.tempRect.set(building.pos.x, building.pos.y, building.size.x, building.size.y);
        BT.drawRectFill(this.tempRect, building.color);

        // Building outline.
        BT.drawRect(this.tempRect, outlineColor);

        // Windows.
        for (let y = 10; y < building.size.y - 10; y += 15) {
            for (let x = 5; x < building.size.x - 5; x += 15) {
                this.tempRect.set(building.pos.x + x, building.pos.y + y, 8, 8);

                BT.drawRectFill(this.tempRect, windowColor);
            }
        }
    }

    /**
     * Renders the player character.
     */
    private renderPlayer(): void {
        this.tempRect.set(this.playerPos.x - 8, this.playerPos.y - 8, 16, 16);

        BT.drawRectFill(this.tempRect, new Color32(255, 100, 100));
        BT.drawRect(this.tempRect, new Color32(200, 50, 50));
    }

    // #endregion

    // #region UI Rendering

    /**
     * Renders the UI overlay in screen coordinates (not affected by camera).
     * Includes title, camera info, instructions, mini-map, and FPS counter.
     */
    private renderUI(): void {
        if (!this.font) return;

        // Semi-transparent background for UI.
        this.tempRect.set(0, 0, 320, 40);

        BT.drawRectFill(this.tempRect, new Color32(0, 0, 0, 180));

        // Title.
        this.tempVec1.set(10, 10);

        BT.printFont(this.font, this.tempVec1, 'Camera Demo', Color32.white());

        // Camera info.
        const camPos = BT.cameraGet();

        this.tempVec1.set(10, 22);

        BT.printFont(this.font, this.tempVec1, `Camera: (${camPos.x}, ${camPos.y})`, new Color32(200, 200, 200));

        // Instructions (placeholder - input not implemented yet).
        this.tempVec1.set(170, 10);

        BT.printFont(this.font, this.tempVec1, 'Auto-scrolling', new Color32(180, 180, 180));

        // World size indicator.
        this.tempVec1.set(170, 22);

        BT.printFont(
            this.font,
            this.tempVec1,
            `World: ${this.worldWidth}x${this.worldHeight}`,
            new Color32(180, 180, 180),
        );

        // Mini-map.
        this.renderMiniMap();

        // FPS counter.
        this.tempVec1.set(10, 225);

        BT.printFont(this.font, this.tempVec1, `FPS: ${BT.fps()}`, new Color32(150, 150, 150));
    }

    /**
     * Renders a mini-map showing camera viewport position relative to world.
     * Buildings appear as dots, viewport as a yellow rectangle.
     */
    private renderMiniMap(): void {
        const mapX = 220;
        const mapY = 160;
        const mapW = 90;
        const mapH = 70;

        // Map background.
        this.tempRect.set(mapX, mapY, mapW, mapH);

        BT.drawRectFill(this.tempRect, new Color32(0, 0, 0, 200));

        // Map border.
        BT.drawRect(this.tempRect, new Color32(255, 255, 255));

        // Draw buildings on mini-map - pre-create color.
        const buildingColor = new Color32(150, 150, 200);

        for (const building of this.buildings) {
            const miniX = mapX + Math.floor((building.pos.x / this.worldWidth) * mapW);
            const miniY = mapY + Math.floor((building.pos.y / this.worldHeight) * mapH);

            this.tempVec1.set(miniX, miniY);

            BT.drawPixel(this.tempVec1, buildingColor);
        }

        // Draw camera viewport on mini-map.
        const displaySize = BT.displaySize();
        const viewX = mapX + Math.floor((this.cameraPos.x / this.worldWidth) * mapW);
        const viewY = mapY + Math.floor((this.cameraPos.y / this.worldHeight) * mapH);
        const viewW = Math.floor((displaySize.x / this.worldWidth) * mapW);
        const viewH = Math.floor((displaySize.y / this.worldHeight) * mapH);

        this.tempRect.set(viewX, viewY, viewW, viewH);

        BT.drawRect(this.tempRect, new Color32(255, 255, 0));

        // Draw player on mini-map.
        const playerMiniX = mapX + Math.floor((this.playerPos.x / this.worldWidth) * mapW);
        const playerMiniY = mapY + Math.floor((this.playerPos.y / this.worldHeight) * mapH);

        this.tempRect.set(playerMiniX - 1, playerMiniY - 1, 2, 2);

        BT.drawRectFill(this.tempRect, new Color32(255, 100, 100));
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
 * Validates WebGPU support, retrieves canvas, and initializes the camera demo.
 */
async function initializeApplication(): Promise<void> {
    // Validate WebGPU support.
    if (!checkWebGPUSupport()) {
        displayErrorMessage(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU. Please use Chrome/Edge 113+ or Firefox Nightly with WebGPU enabled.',
        );

        return;
    }

    // Retrieve canvas element.
    const canvas = getCanvasElement();

    if (!canvas) {
        console.error('[Main] Canvas element not found or is not a <canvas>');

        return;
    }

    // Create game instance.
    const game = new CameraDemo();

    // Initialize engine.
    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Camera demo started successfully!');
    } else {
        displayErrorMessage(
            'Initialization Failed',
            'Failed to initialize the Blit–Tech engine. Check console for details.',
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
