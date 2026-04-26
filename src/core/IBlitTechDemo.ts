import { Vector2i } from '../utils/Vector2i';

// #region Type Definitions

/**
 * Magnification filter used by the upscale pass between the pixel chain
 * (logical resolution) and the display chain (output resolution).
 */
export type OutputUpscaleFilter = 'nearest' | 'linear';

/**
 * Engine-facing hardware configuration returned by `queryHardware()`.
 */
export interface HardwareSettings {
    /** Logical render resolution in pixels (e.g. `320x240`). */
    displaySize: Vector2i;

    /**
     * Output drawing-buffer size in pixels. When set, this drives both the
     * WebGPU drawing buffer and the canvas CSS size, and enables the
     * `'display'` tier of the post-process effect chain (CRT scanlines, barrel
     * distortion, etc.). Leave undefined to render at logical `displaySize`
     * with no display-tier effects.
     *
     * Display-tier effects need this to be larger than `displaySize` to express
     * curvature/scanlines/etc. cleanly without floor-quantizing onto the
     * logical pixel grid.
     */
    canvasDisplaySize?: Vector2i;

    /**
     * Magnification filter applied between the pixel chain and the display
     * chain. `'nearest'` preserves crisp pixel edges (default); `'linear'`
     * gives a soft "old TV" feel.
     */
    outputUpscaleFilter?: OutputUpscaleFilter;

    /** Target fixed-update rate in frames per second. */
    targetFPS: number;

    /**
     * When true, the engine logs a `console.warn` whenever it detects that
     * the browser missed one or more vsync deadlines. Useful for spotting
     * stutters during development. Defaults to `false`.
     *
     * Detection runs in `GameLoop.detectFrameDrop()` and uses an
     * auto-calibrated baseline -- the shortest `requestAnimationFrame` delta
     * observed in a rolling window of recent frames -- rather than a fixed
     * `1.5 / targetFPS` threshold. A frame is reported as dropped when its
     * rAF delta exceeds 1.5x that baseline, which makes detection work on
     * any display refresh rate (60 / 120 / 144 Hz, etc.) and on browsers
     * such as Firefox where rAF often fires at the display rate rather than
     * at `targetFPS`.
     */
    detectDroppedFrames?: boolean;
}

/**
 * Demo contract implemented by Blit-Tech applications.
 *
 * Engine lifecycle order:
 * 1. queryHardware() - Called first to configure display/FPS
 * 2. initialize() - Called after WebGPU setup, load assets here
 * 3. update() - Fixed timestep via accumulator (may run 0..N times per frame)
 * 4. render() - Called once per requestAnimationFrame (browser refresh rate)
 */
export interface IBlitTechDemo {
    /**
     * Called first to declare display size, optional output drawing-buffer size,
     * upscale filter, and the target fixed-update rate.
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
     * Called zero or more times per frame at the fixed timestep declared by
     * `targetFPS`. The accumulator pattern ensures the target rate is met on
     * average, but a single frame may invoke this multiple times (catch-up) or
     * not at all. Update simulation, timers, and input-driven state here.
     *
     * This is a hot path. Minimize allocations, reuse objects, and prefer
     * in-place vector operations where possible.
     *
     * Avoid rendering work here; draw in `render()` instead.
     */
    update(): void;

    /**
     * Called once per `requestAnimationFrame` tick (browser refresh rate).
     * Issue all draw calls for the current frame here.
     *
     * This is a hot path. Batch draws by texture to reduce GPU state changes
     * and reuse Color32/Vector2i instances instead of allocating per frame.
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
