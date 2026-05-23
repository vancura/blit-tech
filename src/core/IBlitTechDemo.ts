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
     * and no more than `16,777,216` total pixels. When running in WebGPU mode
     * the width and height must also not exceed the active adapter's
     * `maxTextureDimension2D` limit (typically `8192` or `16384` depending on
     * the GPU); compare both the numeric caps above and
     * `GPUAdapter.limits.maxTextureDimension2D` when choosing dimensions.
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
     * and no more than `16,777,216` total pixels. When running in WebGPU mode
     * the width and height must also not exceed the active adapter's
     * `maxTextureDimension2D` limit (typically `8192` or `16384` depending on
     * the GPU); compare both the numeric caps above and
     * `GPUAdapter.limits.maxTextureDimension2D` when choosing dimensions.
     */
    canvasDisplaySize?: Vector2i;

    /**
     * Maximum on-screen canvas size in CSS pixels. The demos layout scales the
     * canvas up to the viewport (preserving aspect ratio) but not beyond this
     * size. Defaults to `960x720` in {@link defaultConfig}.
     *
     * Must use positive whole-number dimensions no larger than `8192x8192`
     * and no more than `16,777,216` total pixels. When running in WebGPU mode
     * the width and height must also not exceed the active adapter's
     * `maxTextureDimension2D` limit (typically `8192` or `16384` depending on
     * the GPU); compare both the numeric caps above and
     * `GPUAdapter.limits.maxTextureDimension2D` when choosing dimensions.
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
     * auto-calibrated baseline - the shortest `requestAnimationFrame` delta
     * observed in a rolling window of recent frames - rather than a fixed
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

    /**
     * When `true` (default), the engine draws a screen-space stats overlay after
     * each demo `render()` call (FPS, target rate, resolution, backend, demo title).
     * Users can hide or show it with Backquote or a primary press in the
     * bottom-right 48x48 px corner. Set to `false` to disable the overlay and all
     * toggle input (for release builds that must not expose debug HUD).
     */
    statsOverlayEnabled?: boolean;

    /**
     * Palette indices for the built-in stats overlay bars (top and bottom) and as defaults
     * for custom {@link StatsOverlayRow} entries that omit per-row colors.
     *
     * When omitted, the overlay uses palette index `1` for bars and `2` for text.
     */
    statsOverlayStyle?: StatsOverlayStyle;
}

/**
 * Palette indices for stats overlay bar fills and system-font text.
 */
export interface StatsOverlayStyle {
    /** Palette index for bar backgrounds (top, bottom, and custom rows unless overridden). */
    barPaletteIndex?: number;

    /** Palette index for overlay text (built-in labels and custom rows unless overridden). */
    textPaletteIndex?: number;
}

/**
 * One optional stats-overlay row supplied by a demo (left label, optional right label).
 *
 * Rendered as a 16 px bar stacked above the bottom FPS bar with 1 px gaps. Reuse the same
 * array instance from {@link IBlitTechDemo.statsOverlayRows} when possible to avoid
 * per-frame allocations.
 */
export interface StatsOverlayRow {
    /** Left-aligned text (for example `Position: 120, 80`). */
    leftText: string;

    /** Optional right-aligned text in the same bar. */
    rightText?: string;

    /**
     * Bar fill palette index for this row only. Falls back to
     * {@link HardwareSettings.statsOverlayStyle} then overlay defaults.
     */
    barPaletteIndex?: number;

    /**
     * Text palette index for this row only (left and right labels). Falls back to
     * {@link HardwareSettings.statsOverlayStyle} then overlay defaults.
     */
    textPaletteIndex?: number;
}

/**
 * Demo contract implemented by Blit-Tech applications.
 *
 * Engine lifecycle order:
 * 1. configure() - Optional; called first to set display size, output buffer, FPS, stats overlay
 * 2. init() - Called after renderer setup, load assets here
 * 3. update() - Fixed timestep via accumulator (may run 0..N times per frame)
 * 4. render() - Called once per requestAnimationFrame (browser refresh rate)
 * 5. (engine) stats overlay - When {@link HardwareSettings.statsOverlayEnabled} is true, drawn after `render()` on top
 */
export interface IBlitTechDemo {
    /**
     * Optional hook to declare display size, optional output drawing-buffer size,
     * upscale filter, target fixed-update rate, renderer backend, and stats overlay.
     *
     * When omitted, the engine uses {@link defaultConfig} (`320x240` at
     * `60` FPS).
     *
     * When present, you may return only the fields you want to change; the
     * engine merges them with {@link defaultConfig} via
     * {@link mergeHardwareSettings}. Omit `displaySize` to inherit the full
     * default resolution and output buffer. Include `displaySize` when you
     * want a custom logical size; optional fields you omit then stay unset
     * (for example no `canvasDisplaySize` means a 1:1 drawing buffer).
     *
     * @returns Partial hardware configuration for this demo.
     */
    configure?(): Partial<HardwareSettings>;

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
     * When {@link HardwareSettings.statsOverlayEnabled} is `true` (default), the engine
     * draws a screen-space stats HUD after this method returns (FPS, backend, demo
     * title). Optional {@link statsOverlayRows} adds stacked bars above the footer.
     * Demos do not need to duplicate FPS or page-title text. Reserve the bottom and top
     * ~15 px bands (plus ~17 px per custom overlay row) for overlay bars, or disable
     * the overlay in `configure()` when using custom full-screen HUD layouts.
     *
     * This is a hot path. Batch draws by texture to reduce GPU state changes
     * and reuse Color32/Vector2i instances instead of allocating per frame.
     *
     * Avoid mutating the simulation state here unless it is strictly visual.
     */
    render(): void;

    /**
     * Optional hook returning extra stats-overlay rows for the current frame.
     *
     * Called once per render frame after `render()` when {@link HardwareSettings.statsOverlayEnabled}
     * is `true` and the overlay is visible (not hidden via Backquote or corner toggle). Rows stack
     * upward from just above the bottom FPS bar (1 px gap between bars). Omit this hook or return
     * an empty array when no custom rows are needed.
     *
     * Hot path: reuse the same array and row objects when content is unchanged; avoid
     * allocating new strings or arrays every frame when values only change in place.
     *
     * @returns Read-only list of overlay rows, or `undefined` for none.
     */
    statsOverlayRows?(): readonly StatsOverlayRow[] | undefined;
}

// #endregion

// #region Helper Functions

/**
 * Creates a fresh default hardware configuration for quick demos.
 *
 * Matches the most common setup across Blit-Tech demos: `320x240` logical resolution,
 * `640x480` canvas output (2x nearest upscale), `60` FPS fixed updates, and the engine
 * stats overlay enabled.
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
        statsOverlayEnabled: true,
    };
}

/**
 * Clones a {@link Vector2i} so merged settings do not share mutable references.
 *
 * @param size - Source vector.
 * @returns Fresh vector with the same components.
 */
function cloneVector2i(size: Vector2i): Vector2i {
    return new Vector2i(size.x, size.y);
}

/**
 * Copies only defined fields from a partial configure() return value.
 *
 * @param partial - Values returned by the demo's `configure()` hook.
 * @returns Partial settings containing only defined entries, with vectors cloned.
 */
function pickDefinedHardwareSettings(partial: Partial<HardwareSettings>): Partial<HardwareSettings> {
    const picked: Partial<HardwareSettings> = {};

    if (partial.displaySize !== undefined) {
        picked.displaySize = cloneVector2i(partial.displaySize);
    }

    if (partial.canvasDisplaySize !== undefined) {
        picked.canvasDisplaySize = cloneVector2i(partial.canvasDisplaySize);
    }

    if (partial.maxCanvasDisplaySize !== undefined) {
        picked.maxCanvasDisplaySize = cloneVector2i(partial.maxCanvasDisplaySize);
    }

    if (partial.targetFPS !== undefined) {
        picked.targetFPS = partial.targetFPS;
    }

    if (partial.outputUpscaleFilter !== undefined) {
        picked.outputUpscaleFilter = partial.outputUpscaleFilter;
    }

    if (partial.detectDroppedFrames !== undefined) {
        picked.detectDroppedFrames = partial.detectDroppedFrames;
    }

    if (partial.renderer !== undefined) {
        picked.renderer = partial.renderer;
    }

    if (partial.statsOverlayEnabled !== undefined) {
        picked.statsOverlayEnabled = partial.statsOverlayEnabled;
    }

    if (partial.statsOverlayStyle !== undefined) {
        picked.statsOverlayStyle = { ...partial.statsOverlayStyle };
    }

    return picked;
}

/**
 * Resolves an optional vector from picked configure values or defaults.
 *
 * @param picked - Value from `configure()`, if any.
 * @param fallback - Default vector when picked is omitted.
 * @returns Cloned vector or `undefined` when neither side provides a size.
 */
function resolveMergedOptionalVector(
    picked: Vector2i | undefined,
    fallback: Vector2i | undefined,
): Vector2i | undefined {
    if (picked !== undefined) {
        return picked;
    }

    return fallback !== undefined ? cloneVector2i(fallback) : undefined;
}

/**
 * Collects optional hardware fields for the full-default merge path.
 *
 * @param picked - Defined fields from `configure()`.
 * @param defaults - Baseline hardware settings.
 * @returns Partial settings to spread into the resolved profile.
 */
function buildFullDefaultMergeOptionals(
    picked: Partial<HardwareSettings>,
    defaults: HardwareSettings,
): Partial<HardwareSettings> {
    const optionals: Partial<HardwareSettings> = {};

    const canvasDisplaySize = resolveMergedOptionalVector(picked.canvasDisplaySize, defaults.canvasDisplaySize);

    if (canvasDisplaySize !== undefined) {
        optionals.canvasDisplaySize = canvasDisplaySize;
    }

    const maxCanvasDisplaySize = resolveMergedOptionalVector(
        picked.maxCanvasDisplaySize,
        defaults.maxCanvasDisplaySize,
    );

    if (maxCanvasDisplaySize !== undefined) {
        optionals.maxCanvasDisplaySize = maxCanvasDisplaySize;
    }

    const outputUpscaleFilter = picked.outputUpscaleFilter ?? defaults.outputUpscaleFilter;

    if (outputUpscaleFilter !== undefined) {
        optionals.outputUpscaleFilter = outputUpscaleFilter;
    }

    const detectDroppedFrames = picked.detectDroppedFrames ?? defaults.detectDroppedFrames;

    if (detectDroppedFrames !== undefined) {
        optionals.detectDroppedFrames = detectDroppedFrames;
    }

    const renderer = picked.renderer ?? defaults.renderer;

    if (renderer !== undefined) {
        optionals.renderer = renderer;
    }

    const statsOverlayStyle = picked.statsOverlayStyle ?? defaults.statsOverlayStyle;

    if (statsOverlayStyle !== undefined) {
        optionals.statsOverlayStyle = { ...statsOverlayStyle };
    }

    return optionals;
}

/**
 * Merges partial settings with {@link defaultConfig} when the demo did not set
 * `displaySize` (for example only `{ targetFPS: 30 }`).
 *
 * @param picked - Defined fields from `configure()`.
 * @param defaults - Baseline hardware settings.
 * @returns Resolved settings with full default resolution and output buffer.
 */
function mergePartialWithFullDefaults(picked: Partial<HardwareSettings>, defaults: HardwareSettings): HardwareSettings {
    return {
        displaySize: cloneVector2i(defaults.displaySize),
        targetFPS: picked.targetFPS ?? defaults.targetFPS,
        statsOverlayEnabled: picked.statsOverlayEnabled ?? defaults.statsOverlayEnabled ?? true,
        ...buildFullDefaultMergeOptionals(picked, defaults),
    };
}

/**
 * Applies only fields present in `configure()` when the demo set `displaySize`.
 *
 * @param picked - Defined fields with vectors cloned.
 * @param defaults - Baseline hardware settings for required fallbacks.
 * @returns Resolved settings; omitted optionals such as `canvasDisplaySize` stay unset.
 */
function mergeExplicitDisplayProfile(picked: Partial<HardwareSettings>, defaults: HardwareSettings): HardwareSettings {
    return {
        displaySize: picked.displaySize ?? cloneVector2i(defaults.displaySize),
        targetFPS: picked.targetFPS ?? defaults.targetFPS,
        statsOverlayEnabled: picked.statsOverlayEnabled ?? defaults.statsOverlayEnabled ?? true,
        ...(picked.canvasDisplaySize !== undefined ? { canvasDisplaySize: picked.canvasDisplaySize } : {}),
        ...(picked.maxCanvasDisplaySize !== undefined ? { maxCanvasDisplaySize: picked.maxCanvasDisplaySize } : {}),
        ...(picked.outputUpscaleFilter !== undefined ? { outputUpscaleFilter: picked.outputUpscaleFilter } : {}),
        ...(picked.detectDroppedFrames !== undefined ? { detectDroppedFrames: picked.detectDroppedFrames } : {}),
        ...(picked.renderer !== undefined ? { renderer: picked.renderer } : {}),
        ...(picked.statsOverlayStyle !== undefined ? { statsOverlayStyle: { ...picked.statsOverlayStyle } } : {}),
    };
}

/**
 * Resolves demo `configure()` output into complete {@link HardwareSettings}.
 *
 * When `displaySize` is omitted from `partial`, unset fields inherit from
 * {@link defaultConfig} (including `canvasDisplaySize` and `statsOverlayEnabled`).
 * When `displaySize` is provided, only fields present in `partial` are applied;
 * omitted optionals such as `canvasDisplaySize` remain unset so the drawing buffer
 * can match logical resolution. `statsOverlayEnabled` defaults to `true` when omitted.
 *
 * @param partial - Optional partial settings from `configure()`.
 * @returns Resolved hardware settings for initialization.
 */
export function mergeHardwareSettings(partial?: Partial<HardwareSettings>): HardwareSettings {
    const defaults = defaultConfig();

    if (partial === undefined) {
        return defaults;
    }

    const picked = pickDefinedHardwareSettings(partial);

    if (partial.displaySize === undefined) {
        return mergePartialWithFullDefaults(picked, defaults);
    }

    return mergeExplicitDisplayProfile(picked, defaults);
}

// #endregion
