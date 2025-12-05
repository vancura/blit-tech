import { Vector2i } from '../utils/Vector2i';

// #region Type Definitions

/**
 * Hardware configuration settings for the engine.
 * Returned by IBlitTechGame.queryHardware().
 */
export interface HardwareSettings {
    /** Display resolution in pixels (internal rendering resolution, e.g., 320x240). */
    displaySize: Vector2i;

    /**
     * Canvas display size in pixels (CSS size, optional).
     * If specified, sets the canvas CSS width/height for upscaling.
     * If omitted, uses the HTML/CSS size or defaults to displaySize.
     * Example: displaySize=320x240, canvasDisplaySize=640x480 = 2x scaling.
     */
    canvasDisplaySize?: Vector2i;

    /** Target frames per second for update() calls (default: 60). */
    targetFPS: number;
}

/**
 * Main game interface that all Blit–Tech games must implement.
 * Inspired by RetroBlit's IRetroBlitGame.
 *
 * LIFECYCLE ORDER:
 * 1. queryHardware() - Called first to configure display/FPS
 * 2. initialize() - Called after WebGPU setup, load assets here
 * 3. update() - Called at fixed rate (e.g., 60 times/second)
 * 4. render() - Called at variable rate (as fast as possible)
 *
 * @example
 * class MyGame implements IBlitTechGame {
 *   queryHardware(): HardwareSettings {
 *     return {
 *       displaySize: new Vector2i(320, 240),
 *       targetFPS: 60
 *     };
 *   }
 *
 *   async initialize(): Promise<boolean> {
 *     // Load assets, initialize state.
 *     return true;
 *   }
 *
 *   update(): void {
 *     // Update game logic (called at 60 FPS).
 *   }
 *
 *   render(): void {
 *     // Draw graphics (called as fast as possible).
 *   }
 * }
 */
export interface IBlitTechGame {
    /**
     * Called once at startup to query hardware settings.
     * This is the first method called, before any initialization.
     *
     * Define your display resolution and target framerate here.
     * The engine will configure WebGPU based on these settings.
     *
     * @returns Hardware configuration for this game.
     *
     * @example
     * queryHardware(): HardwareSettings {
     *   return {
     *     displaySize: new Vector2i(320, 240),  // 320x240 internal resolution
     *     canvasDisplaySize: new Vector2i(640, 480),  // 2x scaled display (optional)
     *     targetFPS: 60  // 60 updates per second
     *   };
     * }
     */
    queryHardware(): HardwareSettings;

    /**
     * Called once after hardware initialization.
     * Load assets and set up initial game state here.
     *
     * WebGPU is fully initialized at this point.
     * Use AssetLoader to load textures and fonts.
     *
     * @returns Promise that resolves to true if successful, false to abort.
     *
     * @example
     * async initialize(): Promise<boolean> {
     *   this.spriteSheet = await SpriteSheet.load('assets/sprites.png');
     *   this.font = await BitmapFont.load('fonts/MyFont.btfont');
     *
     *   return true;
     * }
     */
    initialize(): Promise<boolean>;

    /**
     * Called at a fixed rate (default 60 times per second).
     * Update game logic, handle input, and advance simulation here.
     *
     * IMPORTANT: This runs at a fixed timestep for deterministic physics.
     * The timestep is controlled by targetFPS in HardwareSettings.
     * Do NOT perform rendering in this method - use render() instead.
     *
     * PERFORMANCE: This is a HOT PATH. Avoid allocations where possible.
     * - Reuse objects instead of creating new ones
     * - Use object pools for frequently created/destroyed entities
     * - Prefer in-place vector operations (addInPlace, etc.)
     *
     * @example
     * update(): void {
     *   // Handle input.
     *   if (BT.keyDown('ArrowRight')) {
     *     this.playerX += 2;
     *   }
     *
     *   // Update game state.
     *   this.enemyPosition.addXYInPlace(this.enemyVelocity.x, this.enemyVelocity.y);
     * }
     */
    update(): void;

    /**
     * Called at variable rate (as fast as possible).
     * Render game graphics here.
     *
     * IMPORTANT: Do NOT update game logic in this method.
     * Only drawing calls should be made here.
     * The renderer automatically batches sprites for performance.
     *
     * PERFORMANCE: This is a HOT PATH (60+ times per second).
     * - Batch draw calls by texture to minimize GPU state changes
     * - Avoid creating new Color32/Vector2i instances - reuse them
     * - Use cached references for frequently used colors/positions
     *
     * @example
     * render(): void {
     *   // Clear screen.
     *   BT.clear(Color32.black());
     *
     *   // Draw sprites.
     *   BT.drawSprite(
     *     this.spriteSheet,
     *     new Rect2i(0, 0, 16, 16),
     *     this.playerPosition
     *   );
     *
     *   // Draw text.
     *   BT.printFont(
     *     this.font,
     *     new Vector2i(10, 10),
     *     `Score: ${this.score}`
     *   );
     * }
     */
    render(): void;
}

// #endregion

// #region Helper Functions

/**
 * Creates default hardware settings for quick prototyping.
 * Provides a 320x240 display at 60 FPS (classic retro resolution).
 *
 * RECOMMENDED FOR: Quick tests, examples, and prototypes.
 * NOT RECOMMENDED FOR: Production games (define explicit settings instead).
 *
 * @returns Default HardwareSettings configuration.
 *
 * @example
 * // Quick prototyping.
 * queryHardware(): HardwareSettings {
 *   return defaultHardwareSettings();
 * }
 *
 * // Production (recommended).
 * queryHardware(): HardwareSettings {
 *   return {
 *     displaySize: new Vector2i(320, 240),
 *     canvasDisplaySize: new Vector2i(960, 720),  // 3x upscale
 *     targetFPS: 60
 *   };
 * }
 */
export function defaultHardwareSettings(): HardwareSettings {
    return {
        displaySize: new Vector2i(320, 240),
        targetFPS: 60,
    };
}

// #endregion
