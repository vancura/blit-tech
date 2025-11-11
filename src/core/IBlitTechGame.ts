import { Vector2i } from '../utils/Vector2i';

/**
 * Hardware configuration settings for the engine.
 * Returned by IBlitTechGame.queryHardware().
 */
export interface HardwareSettings {
    /** Display resolution in pixels (internal rendering resolution, e.g., 320x240) */
    displaySize: Vector2i;

    /**
     * Canvas display size in pixels (CSS size, optional).
     * If specified, sets the canvas CSS width/height for upscaling.
     * If omitted, uses the HTML/CSS size or defaults to displaySize.
     * Example: displaySize=320x240, canvasDisplaySize=640x480 = 2x scaling
     */
    canvasDisplaySize?: Vector2i;

    /** Tilemap size in tiles (e.g., 128x128, 256x256) */
    mapSize: Vector2i;

    /** Number of tilemap layers (typically 4-8) */
    mapLayers: number;

    /** Chunk size for tilemap rendering (default: 16x16 tiles) */
    chunkSize: Vector2i;

    /** Target frames per second for update() calls (default: 60) */
    targetFPS: number;
}

/**
 * Main game interface that all Blit-Tech games must implement.
 * Inspired by RetroBlit's IRetroBlitGame.
 */
export interface IBlitTechGame {
    /**
     * Called once at startup to query hardware settings.
     * This is the first method called, before any initialization.
     *
     * @returns Hardware configuration for this game
     */
    queryHardware(): HardwareSettings;

    /**
     * Called once after hardware initialization.
     * Load assets and set up initial game state here.
     *
     * @returns Promise that resolves to true if successful, false to abort
     */
    initialize(): Promise<boolean>;

    /**
     * Called at a fixed rate (default 60 times per second).
     * Update game logic, handle input, and advance simulation here.
     *
     * IMPORTANT: This runs at a fixed timestep for deterministic physics.
     * Do NOT perform rendering in this method.
     */
    update(): void;

    /**
     * Called at variable rate (as fast as possible).
     * Render game graphics here.
     *
     * IMPORTANT: Do NOT update game logic in this method.
     * Only draw calls should be made here.
     */
    render(): void;
}

/**
 * Creates default hardware settings for quick prototyping.
 * Provides a 320x240 display at 60 FPS with standard tilemap support.
 * @returns Default HardwareSettings configuration.
 */
export function defaultHardwareSettings(): HardwareSettings {
    return {
        displaySize: new Vector2i(320, 240),
        mapSize: new Vector2i(128, 128),
        mapLayers: 4,
        chunkSize: new Vector2i(16, 16),
        targetFPS: 60,
    };
}
