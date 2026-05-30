import { DEFAULT_MAX_CANVAS_SIZE } from '../utils/CanvasLayoutStyles';
import { Vector2i } from '../utils/Vector2i';

// #region Type Definitions

/**
 * Magnification filter used by the upscale pass between the pixel chain
 * (logical resolution) and the display chain (output resolution).
 */
export type OutputUpscaleFilter = 'nearest' | 'linear';

/**
 * Rendering backend selection for {@link HardwareSettings.backend}.
 *
 * - `'webgpu'` - Hardware-accelerated WebGPU path (default). Supports all draw
 *   primitives, sprites, palette, camera, and fullscreen post-process effects.
 * - `'software'` - Canvas 2D software fallback. Supports draw primitives,
 *   sprites, palette, and camera. Fullscreen shader effects are not available
 *   and will throw when added.
 */
export type Backend = 'webgpu' | 'software';

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
    drawingBufferSize?: Vector2i;

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
    maxCanvasSize?: Vector2i;

    /**
     * Magnification filter applied between the pixel chain and the display
     * chain. `'nearest'` preserves crisp pixel edges (default); `'linear'`
     * gives a soft "old TV" feel.
     */
    outputUpscaleFilter?: OutputUpscaleFilter;

    /**
     * Target fixed-update rate: how often {@link IBlitTechDemo.update} runs per second.
     *
     * Not the measured render rate shown as `Present FPS` on the overlay; `render()` follows
     * `requestAnimationFrame` and may differ (for example 60 Hz updates on a 120 Hz display).
     */
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
     * Rendering backend to use. Defaults to `'webgpu'`.
     *
     * Set to `'software'` to opt into the Canvas 2D fallback backend.
     * You can also force software mode at runtime with `?backend=software`
     * in the page URL.
     */
    backend?: Backend;

    /**
     * When `true` (default), the engine draws a screen-space overlay after
     * each demo `render()` call (FPS, target rate, resolution, backend, demo title).
     * The overlay body starts hidden unless {@link overlayVisibleAtStart} is
     * `true`. Users can show or hide the body with Backquote or a primary press in
     * the bottom-left 48x48 px corner when {@link overlayToggleEnabled} is
     * `true`. Set to `false` to disable the overlay subsystem and all toggle input
     * (for release builds that must not expose debug HUD).
     */
    overlayEnabled?: boolean;

    /**
     * When `true`, the overlay body (metrics bars, palette grid, custom rows) is
     * visible on the first frame. Defaults to `false` in {@link defaultConfig}; the
     * toggle hint may still draw when {@link overlayToggleHintVisible} is `true`.
     */
    overlayVisibleAtStart?: boolean;

    /**
     * When `true` (default), the engine draws the toggle hint icon while the overlay
     * body is hidden. Set to `false` for expert/minimal demos that want no on-screen
     * overlay affordance until the body is shown.
     */
    overlayToggleHintVisible?: boolean;

    /**
     * When `true` (default), Backquote and the bottom-left corner pointer press toggle
     * overlay body visibility. Set to `false` to lock body visibility at
     * {@link overlayVisibleAtStart}.
     */
    overlayToggleEnabled?: boolean;

    /**
     * When `true`, the engine draws a live palette swatch grid in the overlay
     * footer stacked above the hint bar. Defaults to `false` in {@link defaultConfig};
     * set to `true` to opt in.
     */
    overlayPaletteView?: boolean;

    /**
     * Maximum palette swatches per row in the overlay grid. When unset, the engine
     * picks the widest column count that fits {@link HardwareSettings.displaySize}.
     */
    overlayPaletteColumns?: number;

    /**
     * Maximum visible palette grid rows in the overlay footer viewport. When unset,
     * all rows are shown (current behavior). When set, the bottom band height uses
     * this row count rather than the full palette row count; values are clamped to
     * at least `1` and at most the total row count.
     */
    overlayPaletteRowsVisible?: number;

    /**
     * Palette indices for the built-in overlay bars (top and bottom), row gaps,
     * and as defaults for custom {@link OverlayRow} entries that omit per-row colors.
     *
     * When omitted, the overlay uses palette index `1` for bars and gaps and `2` for text.
     */
    overlayStyle?: OverlayStyle;

    /**
     * When `true`, the engine draws a scrolling update/render timing chart band between the
     * title row and the Present FPS row. Defaults to `false` in {@link defaultConfig}.
     *
     * Chart bars use raw per-frame CPU samples from BTAPI (not EMA-smoothed text row values).
     */
    overlayTimingChart?: boolean;

    /**
     * Height in pixels of the timing chart band when {@link overlayTimingChart} is `true`.
     * Defaults to 22 pixels when omitted.
     */
    overlayTimingChartHeight?: number;

    /**
     * Optional palette indices for the timing chart band. Update/render bar colors default to
     * {@link OverlayStyle} bar/text indices; warning/error/event slots control semantic
     * chart tints (VV-545) and future tag markers (VV-541).
     */
    overlayTimingChartStyle?: OverlayTimingChartStyle;

    /**
     * Renderer diagnostic visualization on the timing chart when {@link overlayTimingChart} is enabled.
     *
     * - `'minimal'`: bottom-column marker and warning tint when GPU batch overflow occurred (default when chart enabled)
     * - `'rich'`: minimal plus vertex-pressure dots in the lower third of the chart band
     * - `false`: no diagnostic visualization on the chart
     */
    overlayTimingChartDiagnostics?: false | 'minimal' | 'rich';

    /**
     * When `true`, adds a 13 px row below the Frame/update/render timing text showing primitive/sprite
     * overflow counts and submitted vertex totals. Defaults to `false`.
     */
    overlayRendererDiagnosticsBar?: boolean;
}

/**
 * Palette indices for overlay bar fills and system-font text.
 */
export interface OverlayStyle {
    /** Palette index for bar backgrounds (top, bottom, and custom rows unless overridden). */
    barPaletteIndex?: number;

    /** Palette index for overlay text (built-in labels and custom rows unless overridden). */
    textPaletteIndex?: number;

    /**
     * Palette index for 1 px row gaps between overlay bands and boundary separators
     * (below the top cluster, above the bottom hint bar). Defaults to
     * {@link OverlayStyle.barPaletteIndex} when omitted.
     */
    gapPaletteIndex?: number;
}

/**
 * Palette indices for the timing chart band.
 */
export interface OverlayTimingChartStyle {
    /** Update bar color; defaults to {@link OverlayStyle.barPaletteIndex} or overlay bar index. */
    updateBarPaletteIndex?: number;

    /** Render bar color; defaults to {@link OverlayStyle.textPaletteIndex} or overlay text index. */
    renderBarPaletteIndex?: number;

    /** Warning tint when a chart column is over budget or dropped one frame (VV-545). */
    warningPaletteIndex?: number;

    /** Error tint when a chart column is severely over budget or dropped 2+ frames (VV-545). */
    errorPaletteIndex?: number;

    /** Palette index for timing chart tag and tick text (VV-541). */
    tagPaletteIndex?: number;

    /** Faint horizontal grid lines behind chart dots (VV-7). Defaults to
     * {@link OverlayStyle.gapPaletteIndex} or {@link OverlayStyle.barPaletteIndex} when omitted.
     */
    gridPaletteIndex?: number;

    /** Overflow marker tint for {@link overlayTimingChartDiagnostics} minimal/rich modes. Defaults to {@link warningPaletteIndex}. */
    overflowPaletteIndex?: number;
}

/**
 * One optional overlay row supplied by a demo (left label, optional right label).
 *
 * Rendered as a 13 px bar stacked above the footer (palette grid + hint bar when
 * {@link HardwareSettings.overlayPaletteView} is `true`, or the hint bar alone) with 1 px gaps.
 * Reuse the same array instance from {@link IBlitTechDemo.overlayRows} when possible to avoid
 * per-frame allocations.
 */
export interface OverlayRow {
    /** Left-aligned text (for example `Position: 120, 80`). */
    leftText: string;

    /** Optional right-aligned text in the same bar. */
    rightText?: string;

    /**
     * Bar fill palette index for this row only. Falls back to
     * {@link HardwareSettings.overlayStyle} then overlay defaults.
     */
    barPaletteIndex?: number;

    /**
     * Text palette index for this row only (left and right labels). Falls back to
     * {@link HardwareSettings.overlayStyle} then overlay defaults.
     */
    textPaletteIndex?: number;
}

/**
 * Demo contract implemented by Blit-Tech applications.
 *
 * Engine lifecycle order:
 * 1. configure() - Optional; called first to set display size, output buffer, FPS, overlay
 * 2. init() - Called after renderer setup, load assets here
 * 3. update() - Fixed timestep via accumulator (may run 0..N times per frame)
 * 4. render() - Called once per requestAnimationFrame (browser refresh rate)
 * 5. (engine) overlay - When {@link HardwareSettings.overlayEnabled} is true, drawn after `render()` on top
 */
export interface IBlitTechDemo {
    /**
     * Optional hook to declare display size, optional output drawing-buffer size,
     * upscale filter, target fixed-update rate, rendering backend, and overlay.
     *
     * When omitted, the engine uses {@link defaultConfig} (`320x240` at
     * `60` FPS).
     *
     * When present, you may return only the fields you want to change; the
     * engine merges them with {@link defaultConfig} via
     * {@link mergeHardwareSettings}. Omit `displaySize` to inherit the full
     * default resolution and output buffer. Include `displaySize` when you
     * want a custom logical size; optional fields you omit then stay unset
     * (for example no `drawingBufferSize` means a 1:1 drawing buffer).
     *
     * @returns Partial hardware configuration for this demo.
     */
    configure?(): Partial<HardwareSettings>;

    /**
     * Called once after the selected rendering backend has been initialized.
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
     * When {@link HardwareSettings.overlayEnabled} is `true` (default), the engine
     * draws a screen-space overlay HUD after this method returns (present FPS, target FPS, draw calls,
     * frame/update()/render() timings, backend, demo title). Optional {@link overlayRows} adds stacked bars above
     * the footer.
     * Demos do not need to duplicate engine overlay text. Reserve about ~42 px at the top and space for the bottom palette
     * grid (or ~13 px when {@link HardwareSettings.overlayPaletteView} is `false`) at the bottom (plus ~14 px per
     * custom overlay row) for overlay bars, or disable the overlay in `configure()` when using custom full-screen HUD
     * layouts.
     *
     * This is a hot path. Batch draws by texture to reduce GPU state changes
     * and reuse Color32/Vector2i instances instead of allocating per frame.
     *
     * Avoid mutating the simulation state here unless it is strictly visual.
     */
    render(): void;

    /**
     * Optional hook returning extra overlay rows for the current frame.
     *
     * Called once per render frame after `render()` when {@link HardwareSettings.overlayEnabled}
     * is `true` and the overlay body is visible (not hidden via Backquote or corner toggle). Rows stack
     * upward from just above the bottom hint bar (1 px gap between bars). Omit this hook or return
     * an empty array when no custom rows are needed.
     *
     * Hot path: reuse the same array and row objects when content is unchanged; avoid
     * allocating new strings or arrays every frame when values only change in place.
     *
     * @returns Read-only list of overlay rows, or `undefined` for none.
     */
    overlayRows?(): readonly OverlayRow[] | undefined;
}

// #endregion

// #region Helper Functions

/**
 * Creates a fresh default hardware configuration for quick demos.
 *
 * Matches the most common setup across Blit-Tech demos: `320x240` logical resolution,
 * `640x480` canvas output (2x nearest upscale), `60` FPS fixed updates, and the engine
 * overlay enabled.
 *
 * @returns Default HardwareSettings configuration.
 */
export function defaultConfig(): HardwareSettings {
    return {
        displaySize: new Vector2i(320, 240),
        drawingBufferSize: new Vector2i(640, 480),
        maxCanvasSize: new Vector2i(DEFAULT_MAX_CANVAS_SIZE.x, DEFAULT_MAX_CANVAS_SIZE.y),
        targetFPS: 60,
        outputUpscaleFilter: 'nearest',
        backend: 'webgpu',
        overlayEnabled: true,
        overlayVisibleAtStart: false,
        overlayToggleHintVisible: true,
        overlayToggleEnabled: true,
        overlayPaletteView: false,
        overlayTimingChart: false,
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

/** Non-positive sentinel surfaced when configure() passes null vectors; rejected by {@link validateRenderDimensions}. */
const INVALID_CONFIGURE_VECTOR_SIZE = new Vector2i(0, 0);

/**
 * Picks a configure-time vector: omit when undefined or null, clone valid {@link Vector2i} values.
 *
 * Explicit `null` is detected from the original `partial` field during merge, not from `picked`.
 *
 * @param value - Field from demo `configure()`.
 * @returns Cloned vector when valid, otherwise `undefined`.
 */
function pickConfigureVector(value: Vector2i | undefined | null): Vector2i | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    return cloneVector2i(value);
}

/**
 * Resolves required `displaySize` for the explicit-profile merge path.
 *
 * Uses defaults only when the field was omitted (`undefined`). Explicit `null` maps to
 * {@link INVALID_CONFIGURE_VECTOR_SIZE} so {@link validateRenderDimensions} can reject it.
 *
 * @param partialDisplaySize - Raw `configure()` value.
 * @param pickedDisplaySize - Cloned value from {@link pickDefinedHardwareSettings}, if any.
 * @param fallback - Baseline display size from {@link defaultConfig}.
 * @returns Resolved display size (never `null`).
 */
function resolveExplicitDisplaySize(
    partialDisplaySize: Vector2i | undefined | null,
    pickedDisplaySize: Vector2i | undefined,
    fallback: Vector2i,
): Vector2i {
    if (partialDisplaySize === null) {
        return INVALID_CONFIGURE_VECTOR_SIZE.clone();
    }

    if (pickedDisplaySize !== undefined) {
        return pickedDisplaySize;
    }

    return cloneVector2i(fallback);
}

/**
 * Resolves an optional vector for the explicit display profile.
 *
 * @param partialValue - Raw `configure()` value.
 * @param picked - Cloned value from {@link pickDefinedHardwareSettings}, if any.
 * @returns Cloned vector, {@link INVALID_CONFIGURE_VECTOR_SIZE} when `partialValue` is `null`, or `undefined` when omitted.
 */
function resolveExplicitOptionalVector(
    partialValue: Vector2i | undefined | null,
    picked: Vector2i | undefined,
): Vector2i | undefined {
    if (partialValue === null) {
        return INVALID_CONFIGURE_VECTOR_SIZE.clone();
    }

    return picked;
}

/**
 * Copies a defined scalar or object field from `partial` into `picked`.
 *
 * @param picked - Output partial settings.
 * @param partial - Values returned by the demo's `configure()` hook.
 * @param key - Hardware settings field to copy when defined.
 */
function pickIfDefinedPartial<K extends keyof HardwareSettings>(
    picked: Partial<HardwareSettings>,
    partial: Partial<HardwareSettings>,
    key: K,
): void {
    /* eslint-disable security/detect-object-injection -- key is keyof HardwareSettings */
    if (partial[key] !== undefined) {
        picked[key] = partial[key];
    }
    /* eslint-enable security/detect-object-injection */
}

/**
 * Copies defined overlay fields from `partial` into `picked`.
 *
 * @param picked - Output partial settings.
 * @param partial - Values returned by the demo's `configure()` hook.
 */
function pickDefinedOverlaySettings(picked: Partial<HardwareSettings>, partial: Partial<HardwareSettings>): void {
    pickIfDefinedPartial(picked, partial, 'overlayEnabled');
    pickIfDefinedPartial(picked, partial, 'overlayVisibleAtStart');
    pickIfDefinedPartial(picked, partial, 'overlayToggleHintVisible');
    pickIfDefinedPartial(picked, partial, 'overlayToggleEnabled');
    pickIfDefinedPartial(picked, partial, 'overlayPaletteView');
    pickIfDefinedPartial(picked, partial, 'overlayPaletteColumns');
    pickIfDefinedPartial(picked, partial, 'overlayPaletteRowsVisible');
    pickIfDefinedPartial(picked, partial, 'overlayTimingChart');
    pickIfDefinedPartial(picked, partial, 'overlayTimingChartHeight');
    pickIfDefinedPartial(picked, partial, 'overlayTimingChartDiagnostics');
    pickIfDefinedPartial(picked, partial, 'overlayRendererDiagnosticsBar');

    if (partial.overlayStyle !== undefined) {
        picked.overlayStyle = { ...partial.overlayStyle };
    }

    if (partial.overlayTimingChartStyle !== undefined) {
        picked.overlayTimingChartStyle = { ...partial.overlayTimingChartStyle };
    }
}

/**
 * Copies only defined fields from a partial configure() return value.
 *
 * @param partial - Values returned by the demo's `configure()` hook.
 * @returns Partial settings containing only defined entries, with vectors cloned.
 */
function pickDefinedHardwareSettings(partial: Partial<HardwareSettings>): Partial<HardwareSettings> {
    const picked: Partial<HardwareSettings> = {};

    const pickedDisplaySize = pickConfigureVector(partial.displaySize);
    if (pickedDisplaySize !== undefined) {
        picked.displaySize = pickedDisplaySize;
    }

    const pickedDrawingBufferSize = pickConfigureVector(partial.drawingBufferSize);
    if (pickedDrawingBufferSize !== undefined) {
        picked.drawingBufferSize = pickedDrawingBufferSize;
    }

    const pickedMaxCanvasSize = pickConfigureVector(partial.maxCanvasSize);
    if (pickedMaxCanvasSize !== undefined) {
        picked.maxCanvasSize = pickedMaxCanvasSize;
    }

    pickIfDefinedPartial(picked, partial, 'targetFPS');
    pickIfDefinedPartial(picked, partial, 'outputUpscaleFilter');
    pickIfDefinedPartial(picked, partial, 'detectDroppedFrames');
    pickIfDefinedPartial(picked, partial, 'backend');
    pickDefinedOverlaySettings(picked, partial);

    return picked;
}

/**
 * Resolves an optional vector from picked configure values or defaults.
 *
 * @param partialValue
 * @param picked - Value from `configure()`, if any.
 * @param fallback - Default vector when picked is omitted.
 * @returns Cloned vector or `undefined` when neither side provides a size.
 */
function resolveMergedOptionalVector(
    partialValue: Vector2i | undefined | null,
    picked: Vector2i | undefined,
    fallback: Vector2i | undefined,
): Vector2i | undefined {
    if (partialValue === null) {
        return INVALID_CONFIGURE_VECTOR_SIZE.clone();
    }

    if (picked !== undefined) {
        return picked;
    }

    return fallback !== undefined ? cloneVector2i(fallback) : undefined;
}

/**
 * Sets `target[key]` when `value` is defined.
 *
 * @param target - Partial settings object being built.
 * @param key - Hardware settings field to assign.
 * @param value - Resolved value, or `undefined` to skip.
 */
function assignIfDefined<K extends keyof HardwareSettings>(
    target: Partial<HardwareSettings>,
    key: K,
    value: HardwareSettings[K] | undefined,
): void {
    if (value !== undefined) {
        // eslint-disable-next-line security/detect-object-injection -- key is keyof HardwareSettings
        target[key] = value;
    }
}

/**
 * Shallow-clones an object-shaped optional before assignment.
 *
 * @param value - Optional record from configure or defaults.
 * @returns Cloned record, or `undefined` when input is omitted.
 */
function shallowCloneOptional<T extends object>(value: T | undefined): T | undefined {
    return value === undefined ? undefined : { ...value };
}

/**
 * Merged optional vectors for the full-default configure path.
 *
 * @param optionals - Partial settings object being built.
 * @param partial
 * @param picked - Defined fields from `configure()`.
 * @param defaults - Baseline hardware settings.
 */
function assignFullDefaultMergeVectors(
    optionals: Partial<HardwareSettings>,
    partial: Partial<HardwareSettings>,
    picked: Partial<HardwareSettings>,
    defaults: HardwareSettings,
): void {
    assignIfDefined(
        optionals,
        'drawingBufferSize',
        resolveMergedOptionalVector(partial.drawingBufferSize, picked.drawingBufferSize, defaults.drawingBufferSize),
    );

    assignIfDefined(
        optionals,
        'maxCanvasSize',
        resolveMergedOptionalVector(partial.maxCanvasSize, picked.maxCanvasSize, defaults.maxCanvasSize),
    );
}

/**
 * Merged optional scalars and overlay records for the full-default configure path.
 *
 * @param optionals - Partial settings object being built.
 * @param picked - Defined fields from `configure()`.
 * @param defaults - Baseline hardware settings.
 */
function assignFullDefaultMergeScalars(
    optionals: Partial<HardwareSettings>,
    picked: Partial<HardwareSettings>,
    defaults: HardwareSettings,
): void {
    assignIfDefined(optionals, 'outputUpscaleFilter', picked.outputUpscaleFilter ?? defaults.outputUpscaleFilter);
    assignIfDefined(optionals, 'detectDroppedFrames', picked.detectDroppedFrames ?? defaults.detectDroppedFrames);
    assignIfDefined(optionals, 'backend', picked.backend ?? defaults.backend);

    assignIfDefined(optionals, 'overlayStyle', shallowCloneOptional(picked.overlayStyle ?? defaults.overlayStyle));

    assignIfDefined(optionals, 'overlayVisibleAtStart', picked.overlayVisibleAtStart ?? defaults.overlayVisibleAtStart);

    assignIfDefined(
        optionals,
        'overlayToggleHintVisible',
        picked.overlayToggleHintVisible ?? defaults.overlayToggleHintVisible,
    );

    assignIfDefined(optionals, 'overlayToggleEnabled', picked.overlayToggleEnabled ?? defaults.overlayToggleEnabled);

    assignIfDefined(optionals, 'overlayPaletteView', picked.overlayPaletteView ?? defaults.overlayPaletteView);

    assignIfDefined(optionals, 'overlayPaletteColumns', picked.overlayPaletteColumns);

    assignIfDefined(optionals, 'overlayPaletteRowsVisible', picked.overlayPaletteRowsVisible);

    assignIfDefined(optionals, 'overlayTimingChart', picked.overlayTimingChart ?? defaults.overlayTimingChart);

    assignIfDefined(
        optionals,
        'overlayTimingChartHeight',
        picked.overlayTimingChartHeight ?? defaults.overlayTimingChartHeight,
    );

    assignIfDefined(
        optionals,
        'overlayTimingChartStyle',
        shallowCloneOptional(picked.overlayTimingChartStyle ?? defaults.overlayTimingChartStyle),
    );

    assignIfDefined(optionals, 'overlayTimingChartDiagnostics', picked.overlayTimingChartDiagnostics);

    assignIfDefined(optionals, 'overlayRendererDiagnosticsBar', picked.overlayRendererDiagnosticsBar);
}

/**
 * Collects optional hardware fields for the full-default merge path.
 *
 * @param partial
 * @param picked - Defined fields from `configure()`.
 * @param defaults - Baseline hardware settings.
 * @returns Partial settings to spread into the resolved profile.
 */
function buildFullDefaultMergeOptionals(
    partial: Partial<HardwareSettings>,
    picked: Partial<HardwareSettings>,
    defaults: HardwareSettings,
): Partial<HardwareSettings> {
    const optionals: Partial<HardwareSettings> = {};
    assignFullDefaultMergeVectors(optionals, partial, picked, defaults);
    assignFullDefaultMergeScalars(optionals, picked, defaults);
    return optionals;
}

/**
 * Optional fields explicitly set in `configure()` when the demo provided `displaySize`.
 *
 * @param partial
 * @param picked - Defined fields with vectors cloned.
 * @returns Partial settings to spread into the resolved profile.
 */
function buildExplicitDisplayOptionals(
    partial: Partial<HardwareSettings>,
    picked: Partial<HardwareSettings>,
): Partial<HardwareSettings> {
    const optionals: Partial<HardwareSettings> = {};
    assignIfDefined(
        optionals,
        'drawingBufferSize',
        resolveExplicitOptionalVector(partial.drawingBufferSize, picked.drawingBufferSize),
    );
    assignIfDefined(
        optionals,
        'maxCanvasSize',
        resolveExplicitOptionalVector(partial.maxCanvasSize, picked.maxCanvasSize),
    );
    assignIfDefined(optionals, 'outputUpscaleFilter', picked.outputUpscaleFilter);
    assignIfDefined(optionals, 'detectDroppedFrames', picked.detectDroppedFrames);
    assignIfDefined(optionals, 'overlayStyle', shallowCloneOptional(picked.overlayStyle));
    assignIfDefined(optionals, 'overlayPaletteColumns', picked.overlayPaletteColumns);
    assignIfDefined(optionals, 'overlayPaletteRowsVisible', picked.overlayPaletteRowsVisible);
    assignIfDefined(optionals, 'overlayTimingChart', picked.overlayTimingChart);
    assignIfDefined(optionals, 'overlayTimingChartHeight', picked.overlayTimingChartHeight);
    assignIfDefined(optionals, 'overlayTimingChartStyle', shallowCloneOptional(picked.overlayTimingChartStyle));
    assignIfDefined(optionals, 'overlayTimingChartDiagnostics', picked.overlayTimingChartDiagnostics);
    assignIfDefined(optionals, 'overlayRendererDiagnosticsBar', picked.overlayRendererDiagnosticsBar);
    return optionals;
}

/**
 * Merges partial settings with {@link defaultConfig} when the demo did not set
 * `displaySize` (for example only `{ targetFPS: 30 }`).
 *
 * @param partial
 * @param picked - Defined fields from `configure()`.
 * @param defaults - Baseline hardware settings.
 * @returns Resolved settings with full default resolution and output buffer.
 */
function mergePartialWithFullDefaults(
    partial: Partial<HardwareSettings>,
    picked: Partial<HardwareSettings>,
    defaults: HardwareSettings,
): HardwareSettings {
    return {
        displaySize: cloneVector2i(defaults.displaySize),
        targetFPS: picked.targetFPS ?? defaults.targetFPS,
        overlayEnabled: picked.overlayEnabled ?? defaults.overlayEnabled ?? true,
        overlayVisibleAtStart: picked.overlayVisibleAtStart ?? defaults.overlayVisibleAtStart ?? false,
        overlayToggleHintVisible: picked.overlayToggleHintVisible ?? defaults.overlayToggleHintVisible ?? true,
        overlayToggleEnabled: picked.overlayToggleEnabled ?? defaults.overlayToggleEnabled ?? true,
        overlayPaletteView: picked.overlayPaletteView ?? defaults.overlayPaletteView ?? false,
        ...buildFullDefaultMergeOptionals(partial, picked, defaults),
    };
}

/**
 * Applies only fields present in `configure()` when the demo set `displaySize`.
 *
 * @param partial
 * @param picked - Defined fields with vectors cloned.
 * @param defaults - Baseline hardware settings for required fallbacks.
 * @returns Resolved settings; omitted optionals such as `drawingBufferSize` stay unset.
 * `backend` always inherits from {@link defaultConfig} when omitted from `configure()`.
 */
function mergeExplicitDisplayProfile(
    partial: Partial<HardwareSettings>,
    picked: Partial<HardwareSettings>,
    defaults: HardwareSettings,
): HardwareSettings {
    return {
        displaySize: resolveExplicitDisplaySize(partial.displaySize, picked.displaySize, defaults.displaySize),
        targetFPS: picked.targetFPS ?? defaults.targetFPS,
        overlayEnabled: picked.overlayEnabled ?? defaults.overlayEnabled ?? true,
        overlayVisibleAtStart: picked.overlayVisibleAtStart ?? defaults.overlayVisibleAtStart ?? false,
        overlayToggleHintVisible: picked.overlayToggleHintVisible ?? defaults.overlayToggleHintVisible ?? true,
        overlayToggleEnabled: picked.overlayToggleEnabled ?? defaults.overlayToggleEnabled ?? true,
        overlayPaletteView: picked.overlayPaletteView ?? defaults.overlayPaletteView ?? false,
        backend: picked.backend ?? defaults.backend ?? 'webgpu',
        ...buildExplicitDisplayOptionals(partial, picked),
    };
}

/**
 * Resolves demo `configure()` output into complete {@link HardwareSettings}.
 *
 * When `displaySize` is omitted from `partial`, unset fields inherit from
 * {@link defaultConfig} (including `drawingBufferSize` and `overlayEnabled`).
 * When `displaySize` is provided, only fields present in `partial` are applied;
 * omitted optionals such as `drawingBufferSize` remain unset so the drawing buffer
 * can match logical resolution. `overlayEnabled` defaults to `true` when omitted.
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
        return mergePartialWithFullDefaults(partial, picked, defaults);
    }

    return mergeExplicitDisplayProfile(partial, picked, defaults);
}

/** Resolved timing-chart renderer diagnostic visualization mode. */
export type OverlayTimingChartDiagnosticsMode = false | 'minimal' | 'rich';

/**
 * Resolves {@link HardwareSettings.overlayTimingChartDiagnostics} for runtime overlay/chart code.
 *
 * Defaults to `'minimal'` when the timing chart is enabled and the field is omitted; `false` otherwise.
 *
 * @param settings - Resolved hardware settings.
 * @returns Chart diagnostic visualization mode.
 */
export function resolveOverlayTimingChartDiagnostics(settings: HardwareSettings): OverlayTimingChartDiagnosticsMode {
    if (settings.overlayTimingChartDiagnostics !== undefined) {
        return settings.overlayTimingChartDiagnostics;
    }

    return settings.overlayTimingChart === true ? 'minimal' : false;
}

/**
 * Whether BTAPI should collect WebGPU renderer diagnostic counters this frame.
 *
 * @param settings - Resolved hardware settings.
 * @returns `true` when chart diagnostics or the renderer diagnostics bar needs data.
 */
export function needsOverlayRendererDiagnostics(settings: HardwareSettings): boolean {
    return resolveOverlayTimingChartDiagnostics(settings) !== false || settings.overlayRendererDiagnosticsBar === true;
}

// #endregion
