/**
 * Screen-space stats HUD orchestrator.
 *
 * Delegates layout planning, bar drawing, toggle input, timing chart (VV-539),
 * and palette grid (VV-540) to submodules under `stats-overlay/`.
 */

import type { BitmapFont } from '../../assets/BitmapFont';
import type { Palette } from '../../assets/Palette';
import type { Backend, StatsOverlayRow, StatsOverlayStyle } from '../../core/IBlitTechDemo';
import type { KeyboardInput } from '../../input/KeyboardInput';
import type { PointerInput } from '../../input/PointerInput';
import type { IRenderer } from '../IRenderer';
import { DEFAULT_IDX_BG, DEFAULT_IDX_TEXT, STATS_BOTTOM_HINT_LABEL } from './constants';
import { FpsSampler } from './FpsSampler';
import {
    buildStatsOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createStatsOverlayLayoutPlanScratch,
} from './layoutPlan';
import { StatsOverlayBars } from './StatsOverlayBars';
import { computePaletteGrid, DEFAULT_PALETTE_GRID, StatsOverlayPaletteView } from './StatsOverlayPaletteView';
import { StatsOverlayTimingChart } from './StatsOverlayTimingChart';
import { StatsOverlayToggle } from './StatsOverlayToggle';
import { TimingSampler } from './TimingSampler';
import type {
    StatsOverlayLayout,
    StatsOverlayLayoutConfig,
    StatsOverlayLayoutPlan,
    StatsOverlayTimingSnapshot,
} from './types';

/** Empty usage mask for overlay draws when palette tracking is inactive. */
const EMPTY_PALETTE_USAGE_MASK = new Uint8Array(0);

/**
 * Screen-space stats HUD rendered after demo content each frame.
 *
 * Internal to the engine; demos do not instantiate this class. Use
 * {@link HardwareSettings.statsOverlayEnabled} and {@link BT.activeBackend} instead.
 */
export class StatsOverlay {
    readonly #layout: StatsOverlayLayout;

    readonly #topLeftLabel: string;

    readonly #topRightLabel: string;

    readonly #targetFps: number;

    readonly #fps: FpsSampler;

    readonly #timing: TimingSampler = new TimingSampler();

    readonly #toggle: StatsOverlayToggle = new StatsOverlayToggle();

    readonly #bars: StatsOverlayBars = new StatsOverlayBars();

    readonly #timingChart: StatsOverlayTimingChart;

    readonly #paletteView: StatsOverlayPaletteView;

    readonly #paletteColumns: number | undefined;

    readonly #layoutScratch = createStatsOverlayLayoutPlanScratch();

    readonly #barStyle = { barIndex: DEFAULT_IDX_BG, textIndex: DEFAULT_IDX_TEXT };

    #idxBg = DEFAULT_IDX_BG;

    #idxText = DEFAULT_IDX_TEXT;

    /**
     * Creates an overlay with fixed layout and text strings.
     *
     * @param layout - Cached display layout from {@link createStatsOverlayLayout}.
     * @param topLeftLabel - Short title shown on the top-left.
     * @param targetFps - Configured fixed-update rate for the target FPS line.
     * @param activeBackend - Backend started by BTAPI (`webgpu` or `software`).
     * @param style - Optional palette indices from {@link HardwareSettings.statsOverlayStyle}.
     * @param statsOverlayPaletteView - When true, draws the live palette swatch grid.
     * @param paletteColumns - Optional max swatches per row from {@link HardwareSettings.statsOverlayPaletteColumns}.
     */
    constructor(
        layout: StatsOverlayLayout,
        topLeftLabel: string,
        targetFps: number,
        activeBackend: Backend,
        style?: StatsOverlayStyle,
        statsOverlayPaletteView = false,
        paletteColumns?: number,
    ) {
        this.#layout = layout;
        this.#topLeftLabel = topLeftLabel;
        this.#targetFps = targetFps;
        this.#fps = new FpsSampler(this.#targetFps);
        this.#idxBg = style?.barPaletteIndex ?? DEFAULT_IDX_BG;
        this.#idxText = style?.textPaletteIndex ?? DEFAULT_IDX_TEXT;
        this.#topRightLabel = `${activeBackend} | ${layout.displayWidth}x${layout.displayHeight}`;
        this.#timingChart = new StatsOverlayTimingChart(false);
        this.#paletteView = new StatsOverlayPaletteView(statsOverlayPaletteView);
        this.#paletteColumns = paletteColumns;
    }

    /**
     * Whether the overlay is currently drawn (runtime toggle).
     *
     * @returns `true` while top and bottom bars are rendered.
     */
    get visible(): boolean {
        return this.#toggle.visible;
    }

    /**
     * Whether demo draw calls should populate the per-frame palette usage mask.
     *
     * True when the palette swatch grid is configured and the overlay is visible.
     * BTAPI gates per-frame palette usage tracking on this flag.
     *
     * @returns `true` when sprite/text palette usage scanning is needed.
     */
    get tracksPaletteUsage(): boolean {
        return this.#paletteView.enabled && this.#toggle.visible;
    }

    /**
     * Handles toggle input (Backquote and bottom-right corner press).
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param keyboard - Keyboard subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     */
    handleToggle(pointer: PointerInput | null, keyboard: KeyboardInput | null, currentTick: number): void {
        this.#toggle.handleToggle(pointer, keyboard, currentTick, this.#layout.toggleRect);
    }

    /**
     * Records timing samples when a snapshot is provided.
     *
     * @param timing - Optional timing snapshot from the previous rendered frame.
     */
    #sampleTiming(timing?: StatsOverlayTimingSnapshot): void {
        if (!timing) {
            return;
        }

        this.#timing.sample(timing);
        this.#timingChart.sample(timing);
    }

    /**
     * Builds per-frame layout config including optional palette grid dimensions.
     *
     * @param customRowCount - Demo custom row count for this frame.
     * @param palette - Active demo palette, if any.
     * @returns Layout config for {@link buildStatsOverlayLayoutPlan}.
     */
    #createLayoutConfig(customRowCount: number, palette: Palette | null | undefined): StatsOverlayLayoutConfig {
        const statsOverlayPaletteView = this.#paletteView.enabled;
        const colorCount = palette?.size ?? 256;
        const paletteGrid = statsOverlayPaletteView
            ? computePaletteGrid(this.#layout.displayWidth, undefined, colorCount, undefined, this.#paletteColumns)
            : undefined;

        return {
            ...createDefaultLayoutConfig(
                this.#layout.displayWidth,
                this.#layout.displayHeight,
                this.#layout.lineHeight,
                customRowCount,
            ),
            statsOverlayPaletteView,
            ...(paletteGrid !== undefined ? { paletteGrid } : {}),
        };
    }

    /**
     * Draws overlay bars, palette grid, and labels for one visible frame.
     *
     * @param renderer - Active renderer.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan for this frame.
     * @param layoutConfig - Layout config used to build the plan.
     * @param customRows - Optional demo rows, if any.
     * @param palette - Active demo palette.
     * @param usedPaletteMask - Per-frame palette usage mask from BTAPI.
     */
    #renderVisible(
        renderer: IRenderer,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        layoutConfig: StatsOverlayLayoutConfig,
        customRows: readonly StatsOverlayRow[] | undefined,
        palette: Palette | null | undefined,
        usedPaletteMask: Uint8Array,
    ): void {
        const updateStepSuffix = this.#timing.updateSteps > 1 ? `x${this.#timing.updateSteps}` : '';
        const topMetricsLabel = `Present: ${this.#fps.measuredFps} FPS | Target: ${this.#targetFps} FPS | Draw Calls: ${this.#timing.drawCalls}`;
        const topTimingLabel =
            `Frame: ${this.#timing.frameMs.toFixed(1)}ms | update(): ${this.#timing.updateMs.toFixed(1)}ms${updateStepSuffix} | ` +
            `render(): ${this.#timing.renderMs.toFixed(1)}ms`;

        this.#barStyle.barIndex = this.#idxBg;
        this.#barStyle.textIndex = this.#idxText;

        this.#timingChart.draw(renderer, plan.timingChart, {
            updateBarIndex: this.#idxBg,
            renderBarIndex: this.#idxText,
        });

        this.#bars.drawFixedBars(renderer, plan, this.#idxBg);

        this.#paletteView.draw(
            renderer,
            plan.bottomArea,
            palette ?? null,
            layoutConfig.paletteGrid ?? DEFAULT_PALETTE_GRID,
            this.#layout.bottomTextY,
            this.#layout.displayWidth,
            this.#layout.lineHeight,
            usedPaletteMask,
            this.#idxText,
        );

        if (customRows !== undefined && customRows.length > 0) {
            this.#bars.drawCustomRows(renderer, font, plan, customRows, this.#barStyle);
        }

        this.#bars.drawFixedLabels(
            renderer,
            font,
            plan,
            this.#barStyle,
            this.#topLeftLabel,
            this.#topRightLabel,
            topMetricsLabel,
            topTimingLabel,
            STATS_BOTTOM_HINT_LABEL,
        );
    }

    /**
     * Draws the overlay. Toggle input is handled earlier in the frame by BTAPI
     * ({@link BTAPI.beginRenderFrame}) so palette usage tracking matches visibility.
     *
     * @param renderer - Active {@link IRenderer} instance.
     * @param font - System bitmap font.
     * @param _pointer - Reserved; toggle input is handled in BTAPI before render.
     * @param _keyboard - Reserved; toggle input is handled in BTAPI before render.
     * @param _currentTick - Reserved; toggle input is handled in BTAPI before render.
     * @param getCustomRows - Optional supplier for demo rows; not invoked while the overlay is hidden.
     * @param timing - Optional timing snapshot from the previous rendered frame.
     * @param palette - Active demo palette for optional palette grid.
     * @param usedPaletteMask - Per-frame palette usage mask populated during demo render.
     */
    updateAndRender(
        renderer: IRenderer,
        font: BitmapFont,
        _pointer: PointerInput | null,
        _keyboard: KeyboardInput | null,
        _currentTick: number,
        getCustomRows?: () => readonly StatsOverlayRow[] | undefined,
        timing?: StatsOverlayTimingSnapshot,
        palette?: Palette | null,
        usedPaletteMask: Uint8Array = EMPTY_PALETTE_USAGE_MASK,
    ): void {
        this.#fps.sample();
        this.#sampleTiming(timing);

        if (!this.#toggle.visible) {
            return;
        }

        const customRows = getCustomRows?.();
        const layoutConfig = this.#createLayoutConfig(customRows?.length ?? 0, palette);
        const plan = buildStatsOverlayLayoutPlan(
            layoutConfig,
            this.#layoutScratch,
            STATS_BOTTOM_HINT_LABEL,
            this.#topRightLabel,
            this.#layout.bottomTextY,
            this.#layout.toggleRect,
        );

        const savedCamera = renderer.getCameraOffset();

        renderer.resetCamera();

        try {
            this.#renderVisible(renderer, font, plan, layoutConfig, customRows, palette, usedPaletteMask);
        } finally {
            renderer.setCameraOffset(savedCamera);
        }
    }
}
