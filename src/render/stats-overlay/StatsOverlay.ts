/**
 * Screen-space stats HUD orchestrator.
 *
 * Delegates layout planning, bar drawing, toggle input, and feature stubs
 * (timing chart, palette grid) to submodules under `stats-overlay/`.
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
import { computePaletteGrid, StatsOverlayPaletteView } from './StatsOverlayPaletteView';
import { StatsOverlayTimingChart } from './StatsOverlayTimingChart';
import { StatsOverlayToggle } from './StatsOverlayToggle';
import { TimingSampler } from './TimingSampler';
import type { StatsOverlayLayout, StatsOverlayTimingSnapshot } from './types';

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

    readonly #layoutScratch = createStatsOverlayLayoutPlanScratch();

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
     */
    constructor(
        layout: StatsOverlayLayout,
        topLeftLabel: string,
        targetFps: number,
        activeBackend: Backend,
        style?: StatsOverlayStyle,
    ) {
        this.#layout = layout;
        this.#topLeftLabel = topLeftLabel;
        this.#targetFps = targetFps;
        this.#fps = new FpsSampler(this.#targetFps);
        this.#idxBg = style?.barPaletteIndex ?? DEFAULT_IDX_BG;
        this.#idxText = style?.textPaletteIndex ?? DEFAULT_IDX_TEXT;
        this.#topRightLabel = `${activeBackend} | ${layout.displayWidth}x${layout.displayHeight}`;
        this.#timingChart = new StatsOverlayTimingChart(false);
        this.#paletteView = new StatsOverlayPaletteView(false);
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
     * Processes toggle input then draws the overlay.
     *
     * @param renderer - Active {@link IRenderer} instance.
     * @param font - System bitmap font.
     * @param pointer - Pointer subsystem for corner toggle.
     * @param keyboard - Keyboard subsystem for Backquote toggle.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     * @param getCustomRows - Optional supplier for demo rows; not invoked while the overlay is hidden.
     * @param timing - Optional timing snapshot from the previous rendered frame.
     * @param palette - Active demo palette for optional palette grid (stub when disabled).
     */
    updateAndRender(
        renderer: IRenderer,
        font: BitmapFont,
        pointer: PointerInput | null,
        keyboard: KeyboardInput | null,
        currentTick: number,
        getCustomRows?: () => readonly StatsOverlayRow[] | undefined,
        timing?: StatsOverlayTimingSnapshot,
        palette?: Palette | null,
    ): void {
        this.#fps.sample();

        if (timing) {
            this.#timing.sample(timing);
            this.#timingChart.sample(timing);
        }

        this.handleToggle(pointer, keyboard, currentTick);

        if (!this.#toggle.visible) {
            return;
        }

        const customRows = getCustomRows?.();
        const customRowCount = customRows?.length ?? 0;
        const layoutConfig = createDefaultLayoutConfig(
            this.#layout.displayWidth,
            this.#layout.displayHeight,
            this.#layout.lineHeight,
            customRowCount,
        );

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

        const updateStepSuffix = this.#timing.updateSteps > 1 ? `x${this.#timing.updateSteps}` : '';
        const topMetricsLabel = `Present FPS: ${this.#fps.measuredFps} | Target FPS: ${this.#targetFps} | Draw Calls: ${this.#timing.drawCalls}`;
        const topTimingLabel =
            `Frame: ${this.#timing.frameMs.toFixed(1)}ms | update(): ${this.#timing.updateMs.toFixed(1)}ms${updateStepSuffix} | ` +
            `render(): ${this.#timing.renderMs.toFixed(1)}ms`;

        const barStyle = { barIndex: this.#idxBg, textIndex: this.#idxText };

        this.#timingChart.draw(renderer, plan.timingChart, {
            updateBarIndex: this.#idxBg,
            renderBarIndex: this.#idxText,
        });

        const paletteGrid =
            layoutConfig.paletteGrid ??
            (layoutConfig.paletteViewEnabled
                ? computePaletteGrid(layoutConfig.displayWidth)
                : { cols: 0, rows: 0, swatchSize: 0, totalHeight: 0 });

        this.#paletteView.draw(renderer, plan.bottomArea, palette ?? null, paletteGrid);

        this.#bars.drawFixedBars(renderer, plan, this.#idxBg);

        if (customRows !== undefined && customRows.length > 0) {
            this.#bars.drawCustomRows(renderer, font, plan, customRows, barStyle);
        }

        this.#bars.drawFixedLabels(
            renderer,
            font,
            plan,
            barStyle,
            this.#topLeftLabel,
            this.#topRightLabel,
            topMetricsLabel,
            topTimingLabel,
            STATS_BOTTOM_HINT_LABEL,
        );

        renderer.setCameraOffset(savedCamera);
    }
}
