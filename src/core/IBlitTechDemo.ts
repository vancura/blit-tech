import { DEFAULT_MAX_CANVAS_DISPLAY_SIZE } from '../utils/CanvasLayoutStyles';
import { Vector2i } from '../utils/Vector2i';

// #region Type Definitions

/**
 * Magnification filter used by the upscale pass between the pixel chain
 * (logical resolution) and the display chain (output resolution).
 */
export type OutputUpscaleFilter = 'nearest' | 'linear';

/**
 * Renderer backend selection for {@link HardwareSettings.renderer}.
 *
 * - `'webgpu'` - Hardware-accelerated WebGPU renderer (default). Supports all
 *   draw primitives, sprites, palette, camera, and fullscreen post-process
 *   effects.
 * - `'software'` - Canvas 2D software fallback. Supports draw primitives,
 *   sprites, palette, and camera. Fullscreen shader effects are not available
 *   and will throw when added.
 */
export type RendererBackend = 'webgpu' | 'software';

/**
 * Engine-facing hardware configuration returned by `configure()` when a demo
 * implements that optional hook, or by {@link defaultConfig} otherwise.
 */
export interface HardwareSettings {
    /**
     * Logical render resolution in pixels (e.g. `320x240`).
     *
     * Must use positive whole-number dimensions no larger than `8192x8192`
     * and no more than `16,777,216` total pixels.
     */
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
     *
     * Must use positive whole-number dimensions no larger than `8192x8192`
     * and no more than `16,777,216` total pixels.
     */
    canvasDisplaySize?: Vector2i;

    /**
     * Maximum on-screen canvas size in CSS pixels. The demos layout scales the
     * canvas up to the viewport (preserving aspect ratio) but not beyond this
     * size. Defaults to `960x720` in {@link defaultConfig}.
     *
     * Must use positive whole-number dimensions no larger than `8192x8192`
     * and no more than `16,777,216` total pixels.
     */
    maxCanvasDisplaySize?: Vector2i;

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

    /**
     * Renderer backend to use. Defaults to `'webgpu'`.
     *
     * Set to `'software'` to opt into the Canvas 2D fallback backend.
     * You can also force software mode at runtime with `?renderer=software`
     * in the page URL.
     */
    renderer?: RendererBackend;
}

/**
 * Demo contract implemented by Blit-Tech applications.
 *
 * Engine lifecycle order:
 * 1. configure() - Optional; called first to set display size, output buffer, FPS
 * 2. init() - Called after WebGPU setup, load assets here
 * 3. update() - Fixed timestep via accumulator (may run 0..N times per frame)
 * 4. render() - Called once per requestAnimationFrame (browser refresh rate)
 */
export interface IBlitTechDemo {
    /**
     * Optional hook to declare display size, optional output drawing-buffer size,
     * upscale filter, and the target fixed-update rate.
     *
     * When omitted, the engine uses {@link defaultConfig} (`320x240` at
     * `60` FPS).
     *
     * @returns Hardware configuration for this demo.
     */
    configure?(): HardwareSettings;

    /**
     * Called once after the selected renderer backend has been initialized.
     * Load assets and prepare a demo state here.
     *
     * @returns Promise that resolves to true if successful, false to abort.
     */
    init(): Promise<boolean>;

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
 * Creates a fresh default hardware configuration for quick demos.
 *
 * Matches the most common setup across Blit-Tech demos: `320x240` logical resolution,
 * `640x480` canvas output (2x nearest upscale), and `60` FPS fixed updates.
 *
 * @returns Default HardwareSettings configuration.
 */
export function defaultConfig(): HardwareSettings {
    return {
        displaySize: new Vector2i(320, 240),
        canvasDisplaySize: new Vector2i(640, 480),
        maxCanvasDisplaySize: new Vector2i(DEFAULT_MAX_CANVAS_DISPLAY_SIZE.x, DEFAULT_MAX_CANVAS_DISPLAY_SIZE.y),
        targetFPS: 60,
        outputUpscaleFilter: 'nearest',
    };
}

// #endregion
