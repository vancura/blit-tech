import { Vector2i } from '../utils/Vector2i';

// #region Type Definitions

/**
 * Engine-facing hardware configuration returned by `queryHardware()`.
 */
export interface HardwareSettings {
    /** Display resolution in pixels (internal rendering resolution, e.g., 320×240). */
    displaySize: Vector2i;

    /**
     * Optional CSS display size used to upscale the canvas independently of the
     * internal render resolution.
     */
    canvasDisplaySize?: Vector2i;

    /** Target fixed-update rate in frames per second. */
    targetFPS: number;
}

/**
 * Demo contract implemented by Blit-Tech applications.
 *
 * Engine lifecycle order:
 * 1. queryHardware() - Called first to configure display/FPS
 * 2. initialize() - Called after WebGPU setup, load assets here
 * 3. update() - Called at a fixed rate (e.g., 60 times/second)
 * 4. render() - Called at variable rate (as fast as possible)
 */
export interface IBlitTechDemo {
    /**
     * Called first to declare display size, optional CSS canvas size, and the
     * target fixed-update rate.
     *
     * @returns Hardware configuration for this demo.
     */
    queryHardware(): HardwareSettings;

    /**
     * Called once after WebGPU and the renderer have been initialized.
     * Load assets and prepare a demo state here.
     *
     * @returns Promise that resolves to true if successful, false to abort.
     */
    initialize(): Promise<boolean>;

    /**
     * Called at the fixed rate declared by `targetFPS`.
     * Update simulation, timers, and input-driven state here.
     *
     * Avoid rendering work here; draw in `render()` instead.
     */
    update(): void;

    /**
     * Called once per rendered frame.
     * Issue all draw calls for the current frame here.
     *
     * Avoid mutating the simulation state here unless it is strictly visual.
     */
    render(): void;
}

// #endregion

// #region Helper Functions

/**
 * Creates a fresh default hardware-settings object for quick demos.
 *
 * The defaults are a `320x240` internal resolution and a `60` FPS update rate.
 *
 * @returns Default HardwareSettings configuration.
 */
export function defaultHardwareSettings(): HardwareSettings {
    return {
        displaySize: new Vector2i(320, 240),
        targetFPS: 60,
    };
}

// #endregion
