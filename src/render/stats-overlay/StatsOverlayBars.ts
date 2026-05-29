import type { BitmapFont } from '../../assets/BitmapFont';
import type { StatsOverlayRow } from '../../core/IBlitTechDemo';
import { Vector2i } from '../../utils/Vector2i';
import { STATS_EDGE_MARGIN_PX, STATS_TOP_TEXT_Y } from './constants';
import { statsBitmapTextPaletteOffset, statsRightAlignedTextX } from './layoutHelpers';
import type { StatsOverlayDrawTarget } from './StatsOverlayDrawTarget';
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
     * Draws title, timing chart, metrics, and timing text bar fills.
     *
     * @param target - Stats overlay draw target.
     * @param plan - Computed layout plan.
     * @param barIndex - Palette index for bar fills.
     */
    drawTopBars(target: StatsOverlayDrawTarget, plan: StatsOverlayLayoutPlan, barIndex: number): void {
        target.drawBarFill(plan.titleBar, barIndex);

        if (plan.timingChart.height > 0) {
            target.drawBarFill(plan.timingChart, barIndex);
        }

        target.drawBarFill(plan.metricsBar, barIndex);
        target.drawBarFill(plan.timingTextBar, barIndex);
    }

    /**
     * Draws the palette band background fill when the overlay body is visible.
     *
     * @param target - Stats overlay draw target.
     * @param plan - Computed layout plan.
     * @param barIndex - Palette index for bar fills.
     */
    drawPaletteBandFill(target: StatsOverlayDrawTarget, plan: StatsOverlayLayoutPlan, barIndex: number): void {
        if (plan.paletteBand.height > 0) {
            target.drawBarFill(plan.paletteBand, barIndex);
        }
    }

    /**
     * Draws the bottom hint bar background fill.
     *
     * @param target - Stats overlay draw target.
     * @param plan - Computed layout plan.
     * @param barIndex - Palette index for bar fills.
     */
    drawHintBarFill(target: StatsOverlayDrawTarget, plan: StatsOverlayLayoutPlan, barIndex: number): void {
        target.drawBarFill(plan.hintBar, barIndex);
    }

    /**
     * Draws the bottom-left `[~]` toggle hint label.
     *
     * @param target - Stats overlay draw target.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan.
     * @param textIndex - Palette index for the hint label.
     * @param hintLabel - Toggle hint text (typically `[~]`).
     */
    drawHintLabel(
        target: StatsOverlayDrawTarget,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        textIndex: number,
        hintLabel: string,
    ): void {
        const textPaletteOffset = statsBitmapTextPaletteOffset(textIndex);

        target.drawLabel(font, plan.hintLabelPos, hintLabel, textPaletteOffset);
    }

    /**
     * Draws built-in top overlay text labels (excluding the footer hint).
     *
     * @param target - Stats overlay draw target.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan.
     * @param style - Default overlay palette indices.
     * @param topLeftLabel - Demo title (left).
     * @param topRightLabel - Backend and resolution (right).
     * @param topMetricsLabel - Present FPS / target / draw calls line.
     * @param topTimingLabel - Frame / update / render ms line.
     */
    drawTopLabels(
        target: StatsOverlayDrawTarget,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        style: StatsOverlayBarStyle,
        topLeftLabel: string,
        topRightLabel: string,
        topMetricsLabel: string,
        topTimingLabel: string,
    ): void {
        const textPaletteOffset = statsBitmapTextPaletteOffset(style.textIndex);

        target.drawLabel(font, plan.topLeftPos, topLeftLabel, textPaletteOffset);
        target.drawLabel(font, plan.topRightPos, topRightLabel, textPaletteOffset);
        target.drawLabel(font, plan.topMetricsPos, topMetricsLabel, textPaletteOffset);
        target.drawLabel(font, plan.topTimingPos, topTimingLabel, textPaletteOffset);
    }

    /**
     * Draws demo-supplied custom row bar fills from the layout plan.
     *
     * @param target - Stats overlay draw target.
     * @param plan - Computed layout plan with custom bar rects.
     * @param rows - Custom overlay rows.
     * @param style - Default overlay palette indices.
     */
    drawCustomRowFills(
        target: StatsOverlayDrawTarget,
        plan: StatsOverlayLayoutPlan,
        rows: readonly StatsOverlayRow[],
        style: StatsOverlayBarStyle,
    ): void {
        const rowCount = rows.length;

        /* eslint-disable security/detect-object-injection -- rowIndex bounded by rows.length */
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const row = rows[rowIndex];
            const barRect = plan.customBars[rowIndex];

            if (row === undefined || barRect === undefined) {
                continue;
            }

            const barIndex = row.barPaletteIndex ?? style.barIndex;

            target.drawBarFill(barRect, barIndex);
        }
        /* eslint-enable security/detect-object-injection */
    }

    /**
     * Draws demo-supplied custom row labels from the layout plan.
     *
     * @param target - Stats overlay draw target.
     * @param font - System bitmap font.
     * @param plan - Computed layout plan with custom bar rects.
     * @param rows - Custom overlay rows.
     * @param style - Default overlay palette indices.
     */
    drawCustomRowLabels(
        target: StatsOverlayDrawTarget,
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

            const textIndex = row.textPaletteIndex ?? style.textIndex;
            const textPaletteOffset = statsBitmapTextPaletteOffset(textIndex);
            const barY = barRect.y;

            leftPos.y = barY + STATS_TOP_TEXT_Y;

            target.drawLabel(font, leftPos, row.leftText, textPaletteOffset);

            const rightText = row.rightText;

            if (rightText !== undefined && rightText.length > 0) {
                rightPos.y = barY + STATS_TOP_TEXT_Y;
                rightPos.x = statsRightAlignedTextX(rightText, displayWidth);
                target.drawLabel(font, rightPos, rightText, textPaletteOffset);
            }
        }
        /* eslint-enable security/detect-object-injection */
    }
}
