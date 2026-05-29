/**
 * Palette swatch hover tooltips and clipboard copy for the stats overlay (VV-549).
 */

import type { BitmapFont } from '../../assets/BitmapFont';
import type { PointerInput } from '../../input/PointerInput';
import { POINTER_SLOT_COUNT } from '../../input/PointerInput';
import { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import type { IRenderer } from '../IRenderer';
import { POINTER_PRIMARY_BUTTON, STATS_EDGE_MARGIN_PX, SYSTEM_CHAR_ADVANCE } from './constants';
import { statsBitmapTextPaletteOffset } from './layoutHelpers';
import {
    PALETTE_GRID_PADDING_PX,
    resolvePaletteHintExclusionRect,
    writePaletteSwatchTopLeft,
} from './StatsOverlayPaletteView';
import type { PaletteGridLayout, StatsOverlayLayoutPlan } from './types';

// #region Constants and types

/** Reserved width on the right edge of the palette band excluded from swatch hits (VV-550 scrollbar). */
export const PALETTE_SCROLLBAR_TRACK_WIDTH_PX = 0;

/** Duration for transient copy status tooltips in seconds. */
export const PALETTE_COPY_STATUS_SECONDS = 0.75;

/** Gap between the tooltip body bottom edge and the swatch top edge. */
const TOOLTIP_GAP_ABOVE_SWATCH_PX = 1;

/** Clipboard copy feedback state for palette swatch presses. */
type PaletteCopyStatus = 'idle' | 'copied' | 'failed';

/** Scratch rects and points reused by tooltip layout and draw (one overlay at a time). */
const tooltipScratch = {
    body: new Rect2i(),
    swatch: new Rect2i(),
    outlineEdge: new Rect2i(),
    textPos: new Vector2i(),
};

// #endregion

// #region Helpers

/**
 * Returns whether a palette slot at the given swatch origin overlaps the hint exclusion rect.
 *
 * @param swatchX - Swatch left edge in display pixels.
 * @param swatchY - Swatch top edge in display pixels.
 * @param swatchSize - Side length of the swatch.
 * @param hintExclusion - Region reserved for the `[~]` hint label.
 * @returns `true` when the swatch should not receive hits or draws.
 */
function swatchOverlapsHintExclusion(
    swatchX: number,
    swatchY: number,
    swatchSize: number,
    hintExclusion: Rect2i,
): boolean {
    const ex = hintExclusion;

    return !(
        ex.x >= swatchX + swatchSize ||
        ex.x + ex.width <= swatchX ||
        ex.y >= swatchY + swatchSize ||
        ex.y + ex.height <= swatchY
    );
}

/**
 * Tests whether a pointer lies outside the palette band, including the scrollbar track.
 *
 * @param pointerX - Pointer X in display coordinates.
 * @param pointerY - Pointer Y in display coordinates.
 * @param paletteBand - Palette band rect from the layout plan.
 * @param bandRight - Right edge of the hittable band (excludes scrollbar track).
 * @returns `true` when the pointer lies outside the palette band (including scrollbar track).
 */
function isPointerOutsidePaletteBand(
    pointerX: number,
    pointerY: number,
    paletteBand: Rect2i,
    bandRight: number,
): boolean {
    return (
        pointerX < paletteBand.x ||
        pointerX >= bandRight ||
        pointerY < paletteBand.y ||
        pointerY >= paletteBand.y + paletteBand.height
    );
}

/**
 * Maps band-local coordinates to a palette index, or `null` when not over a swatch cell.
 *
 * @param localX - X relative to the grid origin inside the palette band.
 * @param localY - Y relative to the grid origin inside the palette band.
 * @param cols - Grid column count.
 * @param swatchSize - Swatch side length in pixels.
 * @param gap - Gap between swatches.
 * @param scrollRowOffset - First visible grid row.
 * @param colorCount - Active palette slot count.
 * @returns Palette index, or `null` when the point is in padding or out of range.
 */
function resolvePaletteIndexAtBandLocal(
    localX: number,
    localY: number,
    cols: number,
    swatchSize: number,
    gap: number,
    scrollRowOffset: number,
    colorCount: number,
): number | null {
    if (localX < 0 || localY < 0) {
        return null;
    }

    const pitch = swatchSize + gap;
    const col = Math.floor(localX / pitch);
    const row = Math.floor(localY / pitch);

    if (col >= cols) {
        return null;
    }

    const inSwatchX = localX - col * pitch;

    if (inSwatchX >= swatchSize) {
        return null;
    }

    const inSwatchY = localY - row * pitch;

    if (inSwatchY >= swatchSize) {
        return null;
    }

    const index = (scrollRowOffset + row) * cols + col;

    if (index < 0 || index >= colorCount) {
        return null;
    }

    return index;
}

/**
 * Maps a pointer position to a palette swatch index, or `null` when no swatch is under the point.
 *
 * @param pointerX - Pointer X in display coordinates.
 * @param pointerY - Pointer Y in display coordinates.
 * @param paletteBand - Palette band rect from the layout plan.
 * @param grid - Precomputed grid layout.
 * @param colorCount - Active palette slot count.
 * @param hintExclusion - Region to skip for the `[~]` hint label.
 * @param displayWidth - Logical display width for scrollbar track exclusion.
 * @param scrollRowOffset - First visible grid row (default `0`; VV-550 scroll).
 * @param scrollbarTrackWidth - Right-edge track width excluded from hits (default {@link PALETTE_SCROLLBAR_TRACK_WIDTH_PX}).
 * @returns Palette index, or `null` when the pointer is not over a hittable swatch.
 */
export function hitTestPaletteSwatch(
    pointerX: number,
    pointerY: number,
    paletteBand: Rect2i,
    grid: PaletteGridLayout,
    colorCount: number,
    hintExclusion: Rect2i,
    displayWidth: number,
    scrollRowOffset = 0,
    scrollbarTrackWidth = PALETTE_SCROLLBAR_TRACK_WIDTH_PX,
): number | null {
    const { cols, swatchSize, gap } = grid;

    if (cols <= 0 || swatchSize <= 0 || colorCount <= 0) {
        return null;
    }

    const bandRight = Math.min(paletteBand.x + paletteBand.width, displayWidth) - scrollbarTrackWidth;

    if (isPointerOutsidePaletteBand(pointerX, pointerY, paletteBand, bandRight)) {
        return null;
    }

    const localX = pointerX - (paletteBand.x + STATS_EDGE_MARGIN_PX);
    const localY = pointerY - (paletteBand.y + PALETTE_GRID_PADDING_PX);
    const index = resolvePaletteIndexAtBandLocal(localX, localY, cols, swatchSize, gap, scrollRowOffset, colorCount);

    if (index === null) {
        return null;
    }

    const swatchScratch = tooltipScratch.swatch;

    writePaletteSwatchTopLeft(swatchScratch, index, paletteBand, grid, scrollRowOffset);

    if (swatchOverlapsHintExclusion(swatchScratch.x, swatchScratch.y, swatchSize, hintExclusion)) {
        return null;
    }

    return index;
}

// #endregion

// #region Tooltip

/** Layout output for a docked palette swatch tooltip. */
export interface PaletteTooltipLayout {
    /** Tooltip label body in display coordinates. */
    readonly body: Rect2i;

    /** Bitmap text draw position (top-left of glyphs). */
    readonly textPos: Vector2i;
}

/**
 * Lays out a docked tooltip above a swatch with clamping inside the display.
 *
 * @param target - Reusable layout object written in place.
 * @param swatchRect - Swatch bounds in display coordinates.
 * @param label - Tooltip label text.
 * @param displayWidth - Logical display width.
 * @param displayHeight - Logical display height.
 * @returns `target` for chaining.
 */
export function layoutPaletteTooltip(
    target: PaletteTooltipLayout,
    swatchRect: Rect2i,
    label: string,
    displayWidth: number,
    displayHeight: number,
): PaletteTooltipLayout {
    const textWidth = label.length * SYSTEM_CHAR_ADVANCE;
    const bodyWidth = textWidth + 7;
    const bodyHeight = 13;
    const swatchCenterX = swatchRect.x + Math.floor(swatchRect.width / 2);

    let bodyX = swatchCenterX - Math.floor(bodyWidth / 2);
    let bodyY = swatchRect.y - bodyHeight - TOOLTIP_GAP_ABOVE_SWATCH_PX;

    if (bodyX < 0) {
        bodyX = 0;
    }

    if (bodyX + bodyWidth > displayWidth) {
        bodyX = Math.max(0, displayWidth - bodyWidth);
    }

    if (bodyY < 0) {
        bodyY = 0;
    }

    if (bodyY + bodyHeight > displayHeight) {
        bodyY = Math.max(0, displayHeight - bodyHeight);
    }

    target.body.set(bodyX, bodyY, bodyWidth, bodyHeight);
    target.textPos.set(bodyX + 4, bodyY);

    return target;
}

/**
 * Draws a docked palette swatch tooltip (filled body, 1px border, label text).
 *
 * @param renderer - Active renderer.
 * @param font - System bitmap font.
 * @param layout - Tooltip layout from {@link layoutPaletteTooltip}.
 * @param label - Tooltip label text.
 * @param barIndex - Palette index for tooltip body fill (stats overlay background).
 * @param textIndex - Palette index for the border and label text.
 */
export function drawPaletteTooltip(
    renderer: IRenderer,
    font: BitmapFont,
    layout: PaletteTooltipLayout,
    label: string,
    barIndex: number,
    textIndex: number,
): void {
    if (label.length === 0) {
        return;
    }

    renderer.drawRectFillForeground(layout.body, barIndex);

    const edge = tooltipScratch.outlineEdge;
    const x0 = layout.body.x;
    const y0 = layout.body.y;
    const x1 = layout.body.x + layout.body.width - 1;
    const y1 = layout.body.y + layout.body.height - 1;

    renderer.drawRectFillForeground(edge.set(x0, y0, x1 - x0 + 1, 1), textIndex);
    renderer.drawRectFillForeground(edge.set(x0, y1, x1 - x0 + 1, 1), textIndex);

    if (y1 - y0 > 1) {
        renderer.drawRectFillForeground(edge.set(x0, y0 + 1, 1, y1 - y0 - 1), textIndex);
        renderer.drawRectFillForeground(edge.set(x1, y0 + 1, 1, y1 - y0 - 1), textIndex);
    }

    const textPaletteOffset = statsBitmapTextPaletteOffset(textIndex);

    renderer.drawBitmapTextForeground(font, layout.textPos, label, textPaletteOffset);
}

// #endregion

// #region Clipboard

/**
 * Writes palette index text to the clipboard when the API is available.
 *
 * @param index - Palette slot to copy.
 * @returns Resolves on success; rejects when clipboard is unavailable or denied.
 */
export async function writePaletteIndexToClipboard(index: number): Promise<void> {
    const clipboard = globalThis.navigator?.clipboard;

    if (!clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
    }

    await clipboard.writeText(String(index));
}

// #endregion

// #region Interaction

/**
 * Handles palette swatch hover, copy-on-press, and tooltip rendering for the stats overlay.
 */
export class StatsOverlayPaletteInteraction {
    readonly #targetFps: number;

    #hoveredIndex: number | null = null;

    #copyStatus: PaletteCopyStatus = 'idle';

    #copyStatusIndex = -1;

    #copyStatusExpiryTick = -1;

    #tooltipLabel = '';

    #tooltipLabelKey = '';

    #scrollRowOffset = 0;

    #scrollbarTrackWidth = PALETTE_SCROLLBAR_TRACK_WIDTH_PX;

    /**
     * Creates palette interaction state.
     *
     * @param targetFps - Configured fixed-update rate for copy-status timing.
     */
    constructor(targetFps: number) {
        this.#targetFps = targetFps;
    }

    /**
     * Clears transient copy status when the expiry tick is reached.
     *
     * @param currentTick - Current fixed-update tick.
     */
    tickCopyStatus(currentTick: number): void {
        if (this.#copyStatusExpiryTick >= 0 && currentTick >= this.#copyStatusExpiryTick) {
            this.#copyStatus = 'idle';
            this.#copyStatusIndex = -1;
            this.#copyStatusExpiryTick = -1;
            this.#tooltipLabelKey = '';
        }
    }

    /**
     * Updates hovered swatch index from the current pointer position.
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param plan - Layout plan for this frame.
     * @param grid - Palette grid layout.
     * @param colorCount - Active palette slot count.
     * @param bottomTextY - Baseline Y for the `[~]` hint.
     * @param displayWidth - Logical display width.
     * @param lineHeight - System font line height.
     */
    updateHover(
        pointer: PointerInput | null,
        plan: StatsOverlayLayoutPlan,
        grid: PaletteGridLayout,
        colorCount: number,
        bottomTextY: number,
        displayWidth: number,
        lineHeight: number,
    ): void {
        if (plan.paletteBand.height <= 0 || grid.cols <= 0) {
            this.#hoveredIndex = null;

            return;
        }

        if (!pointer) {
            this.#hoveredIndex = null;

            return;
        }

        const hintExclusion = resolvePaletteHintExclusionRect(bottomTextY, displayWidth, lineHeight);
        let hovered: number | null = null;

        for (let slot = 0; slot < POINTER_SLOT_COUNT; slot++) {
            if (!pointer.isValid(slot)) {
                continue;
            }

            const pos = pointer.getPos(slot);
            const hit = hitTestPaletteSwatch(
                pos.x,
                pos.y,
                plan.paletteBand,
                grid,
                colorCount,
                hintExclusion,
                displayWidth,
                this.#scrollRowOffset,
                this.#scrollbarTrackWidth,
            );

            if (hit !== null) {
                hovered = hit;

                break;
            }
        }

        this.#hoveredIndex = hovered;
    }

    /**
     * Handles primary press over a swatch and attempts clipboard copy.
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick.
     * @param plan - Layout plan for this frame.
     * @param grid - Palette grid layout.
     * @param colorCount - Active palette slot count.
     * @param bottomTextY - Baseline Y for the `[~]` hint.
     * @param displayWidth - Logical display width.
     * @param lineHeight - System font line height.
     * @returns `true` when a swatch press was handled (toggle should be skipped).
     */
    handlePress(
        pointer: PointerInput | null,
        currentTick: number,
        plan: StatsOverlayLayoutPlan,
        grid: PaletteGridLayout,
        colorCount: number,
        bottomTextY: number,
        displayWidth: number,
        lineHeight: number,
    ): boolean {
        if (plan.paletteBand.height <= 0 || grid.cols <= 0 || !pointer) {
            return false;
        }

        const hintExclusion = resolvePaletteHintExclusionRect(bottomTextY, displayWidth, lineHeight);

        for (let slot = 0; slot < POINTER_SLOT_COUNT; slot++) {
            if (!pointer.isButtonPressed(POINTER_PRIMARY_BUTTON, slot)) {
                continue;
            }

            const pos = pointer.getPos(slot);
            const index = hitTestPaletteSwatch(
                pos.x,
                pos.y,
                plan.paletteBand,
                grid,
                colorCount,
                hintExclusion,
                displayWidth,
                this.#scrollRowOffset,
                this.#scrollbarTrackWidth,
            );

            if (index === null) {
                continue;
            }

            void (async () => {
                try {
                    await writePaletteIndexToClipboard(index);
                    this.#setCopyStatus('copied', index, currentTick);
                } catch {
                    this.#setCopyStatus('failed', index, currentTick);
                }
            })();

            return true;
        }

        return false;
    }

    /**
     * Draws the hover or copy-status tooltip when applicable.
     *
     * @param renderer - Active renderer.
     * @param font - System bitmap font.
     * @param plan - Layout plan for this frame.
     * @param grid - Palette grid layout.
     * @param displayWidth - Logical display width.
     * @param displayHeight - Logical display height.
     * @param barIndex - Tooltip body fill palette index.
     * @param textIndex - Tooltip stroke/text palette index.
     */
    drawTooltip(
        renderer: IRenderer,
        font: BitmapFont,
        plan: StatsOverlayLayoutPlan,
        grid: PaletteGridLayout,
        displayWidth: number,
        displayHeight: number,
        barIndex: number,
        textIndex: number,
    ): void {
        const label = this.#resolveTooltipLabel();

        if (label.length === 0) {
            return;
        }

        const index = this.#copyStatus !== 'idle' ? this.#copyStatusIndex : this.#hoveredIndex;

        if (index === null || index < 0) {
            return;
        }

        writePaletteSwatchTopLeft(tooltipScratch.swatch, index, plan.paletteBand, grid, this.#scrollRowOffset);

        const layout = layoutPaletteTooltip(tooltipScratch, tooltipScratch.swatch, label, displayWidth, displayHeight);

        drawPaletteTooltip(renderer, font, layout, label, barIndex, textIndex);
    }

    /**
     * Updates transient copy feedback after a clipboard write attempt.
     *
     * @param status - New copy status.
     * @param index - Palette index that was copied.
     * @param currentTick - Tick when copy was requested.
     */
    #setCopyStatus(status: Exclude<PaletteCopyStatus, 'idle'>, index: number, currentTick: number): void {
        this.#copyStatus = status;
        this.#copyStatusIndex = index;
        this.#copyStatusExpiryTick = currentTick + Math.ceil(PALETTE_COPY_STATUS_SECONDS * this.#targetFps);
        this.#tooltipLabelKey = '';
    }

    /**
     * Returns the tooltip label for hover or copy status, caching the last resolved string.
     *
     * @returns Tooltip label for the current hover or copy status.
     */
    #resolveTooltipLabel(): string {
        let label: string;

        if (this.#copyStatus === 'copied') {
            label = `Copied ${this.#copyStatusIndex}`;
        } else if (this.#copyStatus === 'failed') {
            label = 'Copy failed';
        } else if (this.#hoveredIndex !== null) {
            label = String(this.#hoveredIndex);
        } else {
            label = '';
        }

        const key = `${this.#hoveredIndex}:${this.#copyStatus}:${this.#copyStatusIndex}`;

        if (key !== this.#tooltipLabelKey) {
            this.#tooltipLabelKey = key;
            this.#tooltipLabel = label;
        }

        return this.#tooltipLabel;
    }
}

// #endregion
