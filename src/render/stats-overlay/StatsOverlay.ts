/**
 * Screen-space stats HUD orchestrator.
 *
 * Delegates layout planning, bar drawing, toggle input, timing chart (VV-539),
 * and palette grid (VV-540) to submodules under `stats-overlay/`.
 */

import type { BitmapFont } from '../../assets/BitmapFont';
import type { Palette } from '../../assets/Palette';
import type {
    Backend,
    StatsOverlayRow,
    StatsOverlayStyle,
    StatsOverlayTimingChartStyle,
} from '../../core/IBlitTechDemo';
import type { KeyboardInput } from '../../input/KeyboardInput';
import type { PointerInput } from '../../input/PointerInput';
import type { IRenderer } from '../IRenderer';
import { DEFAULT_IDX_BG, DEFAULT_IDX_TEXT, DEFAULT_TIMING_CHART_HEIGHT, STATS_BOTTOM_HINT_LABEL } from './constants';
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
import type { ResolvedStatsOverlayTimingChartStyle } from './timingChartStyle';
import { resolveStatsOverlayTimingChartStyle } from './timingChartStyle';
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

    readonly #toggle: StatsOverlayToggle;

    readonly #toggleHintVisible: boolean;

    readonly #bars: StatsOverlayBars = new StatsOverlayBars();

    readonly #timingChart: StatsOverlayTimingChart;

    readonly #timingChartHeight: number;

    readonly #timingChartStyle: ResolvedStatsOverlayTimingChartStyle;

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
     * @param statsOverlayTimingChart - When true, draws the update/render timing chart band.
     * @param statsOverlayTimingChartStyle - Optional timing chart palette overrides.
     * @param statsOverlayTimingChartHeight - Chart band height in pixels (default 22).
     * @param statsOverlayVisibleAtStart - Initial overlay body visibility (default false).
     * @param statsOverlayToggleHintVisible - Draw toggle hint while body hidden (default true).
     * @param statsOverlayToggleEnabled - Enable Backquote and corner toggle input (default true).
     */
    constructor(
        layout: StatsOverlayLayout,
        topLeftLabel: string,
        targetFps: number,
        activeBackend: Backend,
        style?: StatsOverlayStyle,
        statsOverlayPaletteView = false,
        paletteColumns?: number,
        statsOverlayTimingChart = false,
        statsOverlayTimingChartStyle?: StatsOverlayTimingChartStyle,
        statsOverlayTimingChartHeight?: number,
        statsOverlayVisibleAtStart = false,
        statsOverlayToggleHintVisible = true,
        statsOverlayToggleEnabled = true,
    ) {
        this.#layout = layout;
        this.#topLeftLabel = topLeftLabel;
        this.#targetFps = targetFps;
        this.#fps = new FpsSampler(this.#targetFps);
        this.#idxBg = style?.barPaletteIndex ?? DEFAULT_IDX_BG;
        this.#idxText = style?.textPaletteIndex ?? DEFAULT_IDX_TEXT;
        this.#topRightLabel = `${activeBackend} | ${layout.displayWidth}x${layout.displayHeight}`;
        this.#timingChartStyle = resolveStatsOverlayTimingChartStyle(style, statsOverlayTimingChartStyle);
        this.#timingChartHeight = statsOverlayTimingChartHeight ?? DEFAULT_TIMING_CHART_HEIGHT;
        this.#timingChart = new StatsOverlayTimingChart(statsOverlayTimingChart);
        this.#paletteView = new StatsOverlayPaletteView(statsOverlayPaletteView);
        this.#paletteColumns = paletteColumns;
        this.#toggle = new StatsOverlayToggle(statsOverlayVisibleAtStart, statsOverlayToggleEnabled);
        this.#toggleHintVisible = statsOverlayToggleHintVisible;

        if (statsOverlayTimingChart) {
            this.#timingChart.reset(layout.displayWidth);
        }
    }

    /**
     * Whether the overlay body is currently drawn (runtime toggle).
     *
     * @returns `true` while metrics bars and palette grid are rendered.
     */
    get bodyVisible(): boolean {
        return this.#toggle.bodyVisible;
    }

    /**
     * Whether demo draw calls should populate the per-frame palette usage mask.
     *
     * True when the palette swatch grid is configured and the overlay body is visible.
     * BTAPI gates per-frame palette usage tracking on this flag.
     *
     * @returns `true` when sprite/text palette usage scanning is needed.
     */
    get tracksPaletteUsage(): boolean {
        return this.#paletteView.enabled && this.#toggle.bodyVisible;
    }

    /**
     * Handles toggle input (Backquote and bottom-left corner press).
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
            timingChartEnabled: this.#timingChart.enabled,
            timingChartHeight: this.#timingChartHeight,
            ...(paletteGrid !== undefined ? { paletteGrid } : {}),
        };
    }

    /**
     * Builds the per-frame layout plan shared by body and hint-only draws.
     *
     * @param customRowCount - Demo custom row count for this frame.
     * @param palette - Active demo palette, if any.
     * @returns Layout config and computed plan.
     */
    #buildFramePlan(
        customRowCount: number,
        palette: Palette | null | undefined,
    ): { layoutConfig: StatsOverlayLayoutConfig; plan: StatsOverlayLayoutPlan } {
        const layoutConfig = this.#createLayoutConfig(customRowCount, palette);
        const plan = buildStatsOverlayLayoutPlan(
            layoutConfig,
            this.#layoutScratch,
            this.#topRightLabel,
            this.#layout.bottomTextY,
            this.#layout.toggleRect,
        );

        return { layoutConfig, plan };
    }

    /**
     * Resets camera for screen-space overlay drawing.
     *
     * @param renderer - Active renderer.
     * @param draw - Callback that issues overlay draws.
     */
    #withOverlayCamera(renderer: IRenderer, draw: () => void): void {
        const savedCamera = renderer.getCameraOffset();

        renderer.resetCamera();

        try {
            draw();
        } finally {
            renderer.setCameraOffset(savedCamera);
        }
    }

    /**
     * Draws overlay content for one frame.
     *
     * Body panels draw only when {@link bodyVisible} is true. The footer hint bar
     * and `[~]` label always draw when this method runs.
     *
     * @param renderer - Active renderer.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan for this frame.
     * @param layoutConfig - Layout config used to build the plan.
     * @param bodyVisible - Whether metrics bars and palette grid should draw.
     * @param customRows - Optional demo rows, if any.
     * @param palette - Active demo palette.
     * @param usedPaletteMask - Per-frame palette usage mask from BTAPI.
     */
    #drawFrame(
        renderer: IRenderer,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        layoutConfig: StatsOverlayLayoutConfig,
        bodyVisible: boolean,
        customRows: readonly StatsOverlayRow[] | undefined,
        palette: Palette | null | undefined,
        usedPaletteMask: Uint8Array,
    ): void {
        this.#barStyle.barIndex = this.#idxBg;
        this.#barStyle.textIndex = this.#idxText;

        if (bodyVisible) {
            const updateStepSuffix = this.#timing.updateSteps > 1 ? `x${this.#timing.updateSteps}` : '';
            const topMetricsLabel = `Present: ${this.#fps.measuredFps} FPS | Target: ${this.#targetFps} FPS | Draw Calls: ${this.#timing.drawCalls}`;
            const topTimingLabel =
                `Frame: ${this.#timing.frameMs.toFixed(1)}ms | update(): ${this.#timing.updateMs.toFixed(1)}ms${updateStepSuffix} | ` +
                `render(): ${this.#timing.renderMs.toFixed(1)}ms`;

            this.#bars.drawTopBars(renderer, plan, this.#idxBg);
            this.#timingChart.draw(renderer, plan.timingChart, this.#timingChartStyle);

            if (customRows !== undefined && customRows.length > 0) {
                this.#bars.drawCustomRows(renderer, font, plan, customRows, this.#barStyle);
            }

            this.#bars.drawTopLabels(
                renderer,
                font,
                plan,
                this.#barStyle,
                this.#topLeftLabel,
                this.#topRightLabel,
                topMetricsLabel,
                topTimingLabel,
            );

            this.#bars.drawPaletteBandFill(renderer, plan, this.#idxBg);

            this.#paletteView.draw(
                renderer,
                plan.paletteBand,
                palette ?? null,
                layoutConfig.paletteGrid ?? DEFAULT_PALETTE_GRID,
                this.#layout.bottomTextY,
                this.#layout.displayWidth,
                this.#layout.lineHeight,
                usedPaletteMask,
                this.#idxText,
            );
        }

        this.#bars.drawHintBarFill(renderer, plan, this.#idxBg);
        this.#bars.drawHintLabel(renderer, font, plan, this.#idxText, STATS_BOTTOM_HINT_LABEL);
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
     * @param getCustomRows - Optional supplier for demo rows; not invoked while the overlay body is hidden.
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
        // Chart history keeps advancing while hidden so re-show reflects demo-only timing.
        this.#sampleTiming(timing);

        const bodyVisible = this.#toggle.bodyVisible;

        if (!bodyVisible && !this.#toggleHintVisible) {
            return;
        }

        if (bodyVisible) {
            this.#fps.sample();
        }

        const customRows = bodyVisible ? getCustomRows?.() : undefined;
        const { layoutConfig, plan } = this.#buildFramePlan(customRows?.length ?? 0, palette);

        this.#withOverlayCamera(renderer, () => {
            this.#drawFrame(renderer, font, plan, layoutConfig, bodyVisible, customRows, palette, usedPaletteMask);
        });
    }
}
