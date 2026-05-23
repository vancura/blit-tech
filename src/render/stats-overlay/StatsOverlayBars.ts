import type { BitmapFont } from '../../assets/BitmapFont';
import type { StatsOverlayRow } from '../../core/IBlitTechDemo';
import { Vector2i } from '../../utils/Vector2i';
import type { IRenderer } from '../IRenderer';
import { STATS_EDGE_MARGIN_PX, STATS_TOP_TEXT_Y } from './constants';
import { statsBitmapTextPaletteOffset, statsRightAlignedTextX } from './layoutHelpers';
import type { StatsOverlayLayoutPlan } from './types';

/** Default bar and text palette indices for overlay drawing. */
export interface StatsOverlayBarStyle {
    readonly barIndex: number;
    readonly textIndex: number;
}

/**
 * Draws fixed and custom stats overlay bars and labels from a layout plan.
 */
export class StatsOverlayBars {
    readonly #customLeftPos: Vector2i[] = [];

    readonly #customRightPos: Vector2i[] = [];

    /**
     * Resolves bar and text palette indices for one custom row.
     *
     * @param row - Demo-supplied overlay row.
     * @param style - Default overlay palette indices.
     * @returns Bar fill index and system-font text index.
     */
    #resolveRowPaletteIndices(row: StatsOverlayRow, style: StatsOverlayBarStyle): StatsOverlayBarStyle {
        return {
            barIndex: row.barPaletteIndex ?? style.barIndex,
            textIndex: row.textPaletteIndex ?? style.textIndex,
        };
    }

    /**
     * Ensures the custom-row scratch pool has at least `count` entries.
     *
     * @param count - Number of demo rows to draw this frame.
     */
    #ensureCustomRowPool(count: number): void {
        while (this.#customLeftPos.length < count) {
            this.#customLeftPos.push(new Vector2i(STATS_EDGE_MARGIN_PX, 0));
            this.#customRightPos.push(new Vector2i(0, 0));
        }
    }

    /**
     * Draws built-in top/metrics/timing/bottom bar fills.
     *
     * @param renderer - Active renderer.
     * @param plan - Computed layout plan.
     * @param barIndex - Palette index for bar fills.
     */
    drawFixedBars(renderer: IRenderer, plan: StatsOverlayLayoutPlan, barIndex: number): void {
        renderer.drawRectFillOnTop(plan.titleBar, barIndex);
        renderer.drawRectFillOnTop(plan.metricsBar, barIndex);
        renderer.drawRectFillOnTop(plan.timingTextBar, barIndex);
        renderer.drawRectFillOnTop(plan.bottomArea, barIndex);
    }

    /**
     * Draws built-in overlay text labels.
     *
     * @param renderer - Active renderer.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan.
     * @param style - Default overlay palette indices.
     * @param topLeftLabel - Demo title (left).
     * @param topRightLabel - Backend and resolution (right).
     * @param topMetricsLabel - Present FPS / target / draw calls line.
     * @param topTimingLabel - Frame / update / render ms line.
     * @param bottomRightLabel - Bottom hint text.
     */
    drawFixedLabels(
        renderer: IRenderer,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        style: StatsOverlayBarStyle,
        topLeftLabel: string,
        topRightLabel: string,
        topMetricsLabel: string,
        topTimingLabel: string,
        bottomRightLabel: string,
    ): void {
        const textPaletteOffset = statsBitmapTextPaletteOffset(style.textIndex);

        renderer.drawBitmapTextOnTop(font, plan.topLeftPos, topLeftLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, plan.topRightPos, topRightLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, plan.topMetricsPos, topMetricsLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, plan.topTimingPos, topTimingLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, plan.bottomRightPos, bottomRightLabel, textPaletteOffset);
    }

    /**
     * Draws demo-supplied custom rows from the layout plan.
     *
     * @param renderer - Active renderer.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan with custom bar rects.
     * @param rows - Custom overlay rows.
     * @param style - Default overlay palette indices.
     */
    drawCustomRows(
        renderer: IRenderer,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        rows: readonly StatsOverlayRow[],
        style: StatsOverlayBarStyle,
    ): void {
        const rowCount = rows.length;

        if (rowCount === 0) {
            return;
        }

        this.#ensureCustomRowPool(rowCount);
        const displayWidth = plan.titleBar.width;

        /* eslint-disable security/detect-object-injection -- rowIndex bounded by rows.length */
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const row = rows[rowIndex];
            const barRect = plan.customBars[rowIndex];
            const leftPos = this.#customLeftPos[rowIndex];
            const rightPos = this.#customRightPos[rowIndex];

            if (row === undefined || barRect === undefined || leftPos === undefined || rightPos === undefined) {
                continue;
            }

            const { barIndex, textIndex } = this.#resolveRowPaletteIndices(row, style);
            const textPaletteOffset = statsBitmapTextPaletteOffset(textIndex);
            const barY = barRect.y;

            leftPos.y = barY + STATS_TOP_TEXT_Y;

            renderer.drawRectFillOnTop(barRect, barIndex);
            renderer.drawBitmapTextOnTop(font, leftPos, row.leftText, textPaletteOffset);

            const rightText = row.rightText;

            if (rightText !== undefined && rightText.length > 0) {
                rightPos.y = barY + STATS_TOP_TEXT_Y;
                rightPos.x = statsRightAlignedTextX(rightText, displayWidth);
                renderer.drawBitmapTextOnTop(font, rightPos, rightText, textPaletteOffset);
            }
        }
        /* eslint-enable security/detect-object-injection */
    }
}
