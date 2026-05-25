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

/** Reserved width on the right edge of the palette band excluded from swatch hits (VV-550 scrollbar). */
export const PALETTE_SCROLLBAR_TRACK_WIDTH_PX = 0;

/** Duration for transient copy status tooltips in seconds. */
export const PALETTE_COPY_STATUS_SECONDS = 0.75;

/** Horizontal padding inside the tooltip label body. */
const TOOLTIP_PADDING_X_PX = 2;

/** Vertical padding inside the tooltip label body. */
const TOOLTIP_PADDING_Y_PX = 1;

/** Height of the downward caret below the tooltip body. */
const TOOLTIP_CARET_HEIGHT_PX = 3;

/** Half-width of the caret in pixels (forms a `\/` shape under the body). */
const TOOLTIP_CARET_HALF_WIDTH_PX = 2;

/** Clipboard copy feedback state for palette swatch presses. */
type PaletteCopyStatus = 'idle' | 'copied' | 'failed';

/** Scratch rects and points reused by tooltip layout and draw (one overlay at a time). */
const tooltipScratch = {
    body: new Rect2i(),
    swatch: new Rect2i(),
    caretLeft: new Vector2i(),
    caretTip: new Vector2i(),
    caretRight: new Vector2i(),
    textPos: new Vector2i(),
};

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

/** Layout output for a docked palette swatch tooltip. */
export interface PaletteTooltipLayout {
    /** Tooltip label body in display coordinates. */
    readonly body: Rect2i;

    /** Bitmap text draw position (top-left of glyphs). */
    readonly textPos: Vector2i;

    /** Caret left, tip, and right points forming `\/` under the body. */
    readonly caretLeft: Vector2i;

    readonly caretTip: Vector2i;

    readonly caretRight: Vector2i;
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
    const bodyWidth = textWidth + TOOLTIP_PADDING_X_PX * 2;
    const bodyHeight = SYSTEM_CHAR_ADVANCE + TOOLTIP_PADDING_Y_PX * 2;
    const swatchCenterX = swatchRect.x + Math.floor(swatchRect.width / 2);
    const swatchTopY = swatchRect.y;

    let bodyX = swatchCenterX - Math.floor(bodyWidth / 2);
    let bodyBottom = swatchTopY - TOOLTIP_CARET_HEIGHT_PX - 1;
    let bodyY = bodyBottom - bodyHeight;

    if (bodyX < 0) {
        bodyX = 0;
    }

    if (bodyX + bodyWidth > displayWidth) {
        bodyX = Math.max(0, displayWidth - bodyWidth);
    }

    if (bodyY < 0) {
        bodyY = 0;
        bodyBottom = bodyY + bodyHeight;
    }

    if (bodyBottom + TOOLTIP_CARET_HEIGHT_PX > displayHeight) {
        bodyBottom = displayHeight - TOOLTIP_CARET_HEIGHT_PX - 1;
        bodyY = bodyBottom - bodyHeight;

        if (bodyY < 0) {
            bodyY = 0;
        }
    }

    target.body.set(bodyX, bodyY, bodyWidth, bodyHeight);
    target.textPos.set(bodyX + TOOLTIP_PADDING_X_PX, bodyY + TOOLTIP_PADDING_Y_PX);

    let caretTipX = swatchCenterX;

    if (caretTipX < bodyX + TOOLTIP_CARET_HALF_WIDTH_PX) {
        caretTipX = bodyX + TOOLTIP_CARET_HALF_WIDTH_PX;
    }

    if (caretTipX > bodyX + bodyWidth - TOOLTIP_CARET_HALF_WIDTH_PX - 1) {
        caretTipX = bodyX + bodyWidth - TOOLTIP_CARET_HALF_WIDTH_PX - 1;
    }

    const caretBaseY = bodyBottom;
    const caretTipY = Math.min(displayHeight - 1, swatchTopY);

    target.caretLeft.set(caretTipX - TOOLTIP_CARET_HALF_WIDTH_PX, caretBaseY);
    target.caretTip.set(caretTipX, caretTipY);
    target.caretRight.set(caretTipX + TOOLTIP_CARET_HALF_WIDTH_PX, caretBaseY);

    return target;
}

/**
 * Draws a docked palette swatch tooltip (body, outline, text, caret).
 *
 * @param renderer - Active renderer.
 * @param font - System bitmap font.
 * @param layout - Tooltip layout from {@link layoutPaletteTooltip}.
 * @param label - Tooltip label text.
 * @param barIndex - Palette index for tooltip body fill.
 * @param textIndex - Palette index for outline, text, and caret.
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

    renderer.drawRectFillOnTop(layout.body, barIndex);
    renderer.drawRect(layout.body, textIndex);

    const textPaletteOffset = statsBitmapTextPaletteOffset(textIndex);

    renderer.drawBitmapTextOnTop(font, layout.textPos, label, textPaletteOffset);

    const caretBaseY = layout.caretLeft.y;
    const caretTipY = layout.caretTip.y;

    if (caretTipY <= caretBaseY) {
        renderer.drawPixel(layout.caretTip, textIndex);

        return;
    }

    for (let y = caretBaseY; y <= caretTipY; y++) {
        const t = (y - caretBaseY) / (caretTipY - caretBaseY);
        const leftX = Math.round(layout.caretLeft.x + (layout.caretTip.x - layout.caretLeft.x) * t);
        const rightX = Math.round(layout.caretRight.x + (layout.caretTip.x - layout.caretRight.x) * t);

        renderer.drawPixel(new Vector2i(leftX, y), textIndex);

        if (rightX !== leftX) {
            renderer.drawPixel(new Vector2i(rightX, y), textIndex);
        }
    }
}

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
     * First visible palette grid row for hit testing (VV-550 scroll).
     *
     * @param offset - Row offset applied to pointer-to-index mapping.
     */
    setScrollRowOffset(offset: number): void {
        this.#scrollRowOffset = Math.max(0, Math.floor(offset));
    }

    /**
     * Right-edge track width excluded from swatch hits (VV-550 scrollbar).
     *
     * @param width - Track width in pixels.
     */
    setScrollbarTrackWidth(width: number): void {
        this.#scrollbarTrackWidth = Math.max(0, Math.floor(width));
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
