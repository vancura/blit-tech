/**
 * Screen-space overlay HUD orchestrator.
 *
 * Delegates layout planning, bar drawing, toggle input, timing chart (VV-539),
 * and palette grid (VV-540) to submodules under `overlay/`.
 */

import type { BitmapFont } from '../assets/BitmapFont';
import type { Palette } from '../assets/Palette';
import type { Backend, OverlayRow, OverlayStyle, OverlayTimingChartStyle } from '../core/IBlitTechDemo';
import type { KeyboardInput } from '../input/KeyboardInput';
import type { PointerInput } from '../input/PointerInput';
import { OverlayBars } from './bars/Bars';
import { DEFAULT_IDX_BG, DEFAULT_IDX_TEXT, OVERLAY_BOTTOM_HINT_LABEL } from './constants';
import { Toggle } from './input/Toggle';
import { buildOverlayLayoutPlan, createDefaultLayoutConfig, createOverlayLayoutPlanScratch } from './layout/layoutPlan';
import type { OverlayLayout, OverlayLayoutConfig, OverlayLayoutPlan } from './layout/types';
import type { OverlayRenderer } from './OverlayDrawTarget';
import { PaletteInteraction } from './palette/PaletteInteraction';
import { computePaletteGrid, DEFAULT_PALETTE_GRID, PaletteView } from './palette/PaletteView';
import { FpsSampler } from './sampling/FpsSampler';
import { TimingSampler } from './sampling/TimingSampler';
import { DEFAULT_TIMING_CHART_HEIGHT } from './timing-chart/constants';
import type { ResolvedOverlayTimingChartStyle } from './timing-chart/style';
import { resolveOverlayTimingChartStyle } from './timing-chart/style';
import { TimingChart } from './timing-chart/TimingChart';
import type { OverlayTimingSnapshot } from './types';

/** Empty usage mask for overlay draws when palette tracking is inactive. */
const EMPTY_PALETTE_USAGE_MASK = new Uint8Array(0);

/**
 * Screen-space overlay HUD rendered after demo content each frame.
 *
 * Internal to the engine; demos do not instantiate this class. Use
 * {@link HardwareSettings.overlayEnabled} and {@link BT.activeBackend} instead.
 */
export class Overlay {
    // #region Fields

    readonly #layout: OverlayLayout;

    readonly #topLeftLabel: string;

    readonly #topRightLabel: string;

    readonly #targetFps: number;

    readonly #fps: FpsSampler;

    readonly #timing: TimingSampler = new TimingSampler();

    readonly #toggle: Toggle;

    readonly #toggleHintVisible: boolean;

    readonly #bars: OverlayBars = new OverlayBars();

    readonly #timingChart: TimingChart;

    readonly #timingChartHeight: number;

    readonly #timingChartStyle: ResolvedOverlayTimingChartStyle;

    readonly #paletteView: PaletteView;

    readonly #paletteInteraction: PaletteInteraction;

    readonly #paletteColumns: number | undefined;

    readonly #paletteRowsVisible: number | undefined;

    readonly #layoutScratch = createOverlayLayoutPlanScratch();

    readonly #barStyle = { barIndex: DEFAULT_IDX_BG, textIndex: DEFAULT_IDX_TEXT };

    #idxBg = DEFAULT_IDX_BG;

    #idxText = DEFAULT_IDX_TEXT;

    #idxGap = DEFAULT_IDX_BG;

    // #endregion

    // #region Constructor

    /**
     * Creates an overlay with fixed layout and text strings.
     *
     * @param layout - Cached display layout from {@link createOverlayLayout}.
     * @param topLeftLabel - Short title shown on the top-left.
     * @param targetFps - Configured fixed-update rate for the target FPS line.
     * @param activeBackend - Backend started by BTAPI (`webgpu` or `software`).
     * @param style - Optional palette indices from {@link HardwareSettings.overlayStyle}.
     * @param overlayPaletteView - When true, draws the live palette swatch grid.
     * @param paletteColumns - Optional max swatches per row from {@link HardwareSettings.overlayPaletteColumns}.
     * @param overlayPaletteRowsVisible - Optional max visible palette grid rows from {@link HardwareSettings.overlayPaletteRowsVisible}.
     * @param overlayTimingChart - When true, draws the update/render timing chart band.
     * @param overlayTimingChartStyle - Optional timing chart palette overrides.
     * @param overlayTimingChartHeight - Chart band height in pixels (default 22).
     * @param overlayVisibleAtStart - Initial overlay body visibility (default false).
     * @param overlayToggleHintVisible - Draw toggle hint while body hidden (default true).
     * @param overlayToggleEnabled - Enable Backquote and corner toggle input (default true).
     */
    constructor(
        layout: OverlayLayout,
        topLeftLabel: string,
        targetFps: number,
        activeBackend: Backend,
        style?: OverlayStyle,
        overlayPaletteView = false,
        paletteColumns?: number,
        overlayPaletteRowsVisible?: number,
        overlayTimingChart = false,
        overlayTimingChartStyle?: OverlayTimingChartStyle,
        overlayTimingChartHeight?: number,
        overlayVisibleAtStart = false,
        overlayToggleHintVisible = true,
        overlayToggleEnabled = true,
    ) {
        this.#layout = layout;
        this.#topLeftLabel = topLeftLabel;
        this.#targetFps = targetFps;
        this.#fps = new FpsSampler(this.#targetFps);
        this.#idxBg = style?.barPaletteIndex ?? DEFAULT_IDX_BG;
        this.#idxText = style?.textPaletteIndex ?? DEFAULT_IDX_TEXT;
        this.#idxGap = style?.gapPaletteIndex ?? this.#idxBg;
        this.#topRightLabel = `${activeBackend} | ${layout.displayWidth}x${layout.displayHeight}`;
        this.#timingChartStyle = resolveOverlayTimingChartStyle(style, overlayTimingChartStyle);
        this.#timingChartHeight = overlayTimingChartHeight ?? DEFAULT_TIMING_CHART_HEIGHT;
        this.#timingChart = new TimingChart(overlayTimingChart);
        this.#paletteView = new PaletteView(overlayPaletteView);
        this.#paletteInteraction = new PaletteInteraction(targetFps);
        this.#paletteColumns = paletteColumns;
        this.#paletteRowsVisible = overlayPaletteRowsVisible;
        this.#toggle = new Toggle(overlayVisibleAtStart, overlayToggleEnabled);
        this.#toggleHintVisible = overlayToggleHintVisible;

        if (overlayTimingChart) {
            this.#timingChart.reset(layout.displayWidth);
        }
    }

    // #endregion

    // #region Public API

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
     * Handles overlay frame input: palette swatch copy first, then body toggle.
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param keyboard - Keyboard subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     * @param getCustomRows - Optional supplier for demo rows (layout plan for palette hits).
     * @param palette - Active demo palette for slot count, if any.
     */
    handleFrameInput(
        pointer: PointerInput | null,
        keyboard: KeyboardInput | null,
        currentTick: number,
        getCustomRows?: () => readonly OverlayRow[] | undefined,
        palette?: Palette | null,
    ): void {
        let pointerPressConsumed = false;

        if (this.#paletteView.enabled && this.#toggle.bodyVisible) {
            const customRows = getCustomRows?.();
            const { layoutConfig, plan } = this.#buildFramePlan(customRows?.length ?? 0, palette);
            const grid = layoutConfig.paletteGrid;
            const colorCount = palette?.size ?? 256;

            if (grid !== undefined && plan.paletteBand.height > 0) {
                this.#paletteInteraction.syncScrollBounds(grid);

                pointerPressConsumed = this.#paletteInteraction.handlePress(
                    pointer,
                    currentTick,
                    plan,
                    grid,
                    colorCount,
                    this.#layout.bottomTextY,
                    this.#layout.displayWidth,
                    this.#layout.lineHeight,
                );

                pointerPressConsumed =
                    this.#paletteInteraction.handleScroll(pointer, plan, grid, pointerPressConsumed) ||
                    pointerPressConsumed;
            }
        }

        this.#toggle.handleToggle(pointer, keyboard, currentTick, this.#layout.toggleRect, pointerPressConsumed);
    }

    /**
     * Handles toggle input (Backquote and bottom-left corner press).
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param keyboard - Keyboard subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     */
    handleToggle(pointer: PointerInput | null, keyboard: KeyboardInput | null, currentTick: number): void {
        this.handleFrameInput(pointer, keyboard, currentTick);
    }

    /**
     * Draws the overlay. Toggle input is handled earlier in the frame by BTAPI
     * ({@link BTAPI.beginRenderFrame}) so palette usage tracking matches visibility.
     *
     * @param renderer - Active {@link OverlayRenderer} instance.
     * @param font - System bitmap font.
     * @param pointer - Pointer subsystem for palette swatch hover tooltips.
     * @param _keyboard - Reserved; toggle input is handled in BTAPI before render.
     * @param currentTick - Current fixed-update tick for copy-status expiry.
     * @param getCustomRows - Optional supplier for demo rows; not invoked while the overlay body is hidden.
     * @param timing - Optional timing snapshot from the previous rendered frame.
     * @param palette - Active demo palette for optional palette grid.
     * @param usedPaletteMask - Per-frame palette usage mask populated during demo render.
     */
    updateAndRender(
        renderer: OverlayRenderer,
        font: BitmapFont,
        pointer: PointerInput | null,
        _keyboard: KeyboardInput | null,
        currentTick: number,
        getCustomRows?: () => readonly OverlayRow[] | undefined,
        timing?: OverlayTimingSnapshot,
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
            this.#drawFrame(
                renderer,
                font,
                plan,
                layoutConfig,
                bodyVisible,
                customRows,
                palette,
                usedPaletteMask,
                pointer,
                currentTick,
            );
        });
    }

    // #endregion

    // #region Private helpers

    /**
     * Records timing samples when a snapshot is provided.
     *
     * @param timing - Optional timing snapshot from the previous rendered frame.
     */
    #sampleTiming(timing?: OverlayTimingSnapshot): void {
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
     * @returns Layout config for {@link buildOverlayLayoutPlan}.
     */
    #createLayoutConfig(customRowCount: number, palette: Palette | null | undefined): OverlayLayoutConfig {
        const overlayPaletteView = this.#paletteView.enabled;
        const colorCount = palette?.size ?? 256;
        const paletteGrid = overlayPaletteView
            ? computePaletteGrid(
                  this.#layout.displayWidth,
                  undefined,
                  colorCount,
                  undefined,
                  this.#paletteColumns,
                  this.#paletteRowsVisible,
              )
            : undefined;

        return {
            ...createDefaultLayoutConfig(
                this.#layout.displayWidth,
                this.#layout.displayHeight,
                this.#layout.lineHeight,
                customRowCount,
            ),
            overlayPaletteView,
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
    ): { layoutConfig: OverlayLayoutConfig; plan: OverlayLayoutPlan } {
        const layoutConfig = this.#createLayoutConfig(customRowCount, palette);
        const plan = buildOverlayLayoutPlan(
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
    #withOverlayCamera(renderer: OverlayRenderer, draw: () => void): void {
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
     * @param pointer - Pointer subsystem for palette swatch hover, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for copy-status expiry.
     */
    #drawFrame(
        renderer: OverlayRenderer,
        font: BitmapFont,
        plan: OverlayLayoutPlan,
        layoutConfig: OverlayLayoutConfig,
        bodyVisible: boolean,
        customRows: readonly OverlayRow[] | undefined,
        palette: Palette | null | undefined,
        usedPaletteMask: Uint8Array,
        pointer: PointerInput | null,
        currentTick: number,
    ): void {
        this.#barStyle.barIndex = this.#idxBg;
        this.#barStyle.textIndex = this.#idxText;

        let topMetricsLabel = '';
        let topTimingLabel = '';
        const paletteGrid = layoutConfig.paletteGrid ?? DEFAULT_PALETTE_GRID;

        if (bodyVisible) {
            const updateStepSuffix = this.#timing.updateSteps > 1 ? `x${this.#timing.updateSteps}` : '';

            topMetricsLabel = `Present: ${this.#fps.measuredFps} FPS | Target: ${this.#targetFps} FPS | Draw Calls: ${this.#timing.drawCalls}`;

            topTimingLabel =
                `Frame: ${this.#timing.frameMs.toFixed(1)}ms | update(): ${this.#timing.updateMs.toFixed(1)}ms${updateStepSuffix} | ` +
                `render(): ${this.#timing.renderMs.toFixed(1)}ms`;

            this.#bars.drawTopBars(renderer, plan, this.#idxBg);
            this.#timingChart.draw(renderer, plan.timingChart, this.#timingChartStyle);

            if (customRows !== undefined && customRows.length > 0) {
                this.#bars.drawCustomRowFills(renderer, plan, customRows, this.#barStyle);
            }

            this.#bars.drawPaletteBandFill(renderer, plan, this.#idxBg);

            this.#paletteView.draw(
                renderer,
                plan.paletteBand,
                palette ?? null,
                paletteGrid,
                this.#layout.bottomTextY,
                this.#layout.displayWidth,
                this.#layout.lineHeight,
                usedPaletteMask,
                this.#idxText,
                this.#paletteInteraction.scrollRowOffset,
                this.#paletteInteraction.scrollbarTrackWidth,
                this.#idxText,
            );

            const colorCount = palette?.size ?? 256;

            this.#paletteInteraction.tickCopyStatus(currentTick);

            this.#paletteInteraction.updateHover(
                pointer,
                plan,
                paletteGrid,
                colorCount,
                this.#layout.bottomTextY,
                this.#layout.displayWidth,
                this.#layout.lineHeight,
            );

            this.#bars.drawRowGaps(renderer, plan, this.#idxGap);
            this.#bars.drawClusterSeparators(renderer, plan, this.#idxGap, true, true);
        }

        if (!bodyVisible) {
            this.#bars.drawHintClusterSeparator(renderer, plan.hintBar, this.#idxGap);
        }

        this.#bars.drawHintBarFill(renderer, plan, this.#idxBg);

        if (bodyVisible) {
            if (customRows !== undefined && customRows.length > 0) {
                this.#bars.drawCustomRowLabels(renderer, font, plan, customRows, this.#barStyle);
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
        }

        this.#bars.drawHintLabel(renderer, font, plan, this.#idxText, OVERLAY_BOTTOM_HINT_LABEL);

        if (bodyVisible) {
            this.#paletteInteraction.drawTooltipChrome(
                renderer,
                plan,
                paletteGrid,
                this.#layout.displayWidth,
                this.#layout.displayHeight,
                this.#idxBg,
                this.#idxText,
            );

            this.#paletteInteraction.drawTooltipLabel(
                renderer,
                font,
                plan,
                paletteGrid,
                this.#layout.displayWidth,
                this.#layout.displayHeight,
                this.#idxText,
            );
        }
    }

    // #endregion
}
