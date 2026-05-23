/**
 * Engine-managed stats overlay (present FPS, timing metrics, demo text, backend).
 *
 * Instantiated by {@link BTAPI} when {@link HardwareSettings.statsOverlayEnabled} is
 * `true` (default). Layout is computed once at init from logical `displaySize` and
 * system font metrics; per-frame work samples cadence/timing and draws four 13 px bars:
 *
 * - **Top row 1:** demo title (left) and `backend | WxH` (right)
 * - **Top row 2:** `Present FPS`, `Target FPS`, and draw-call counter
 * - **Top row 3:** `Frame`, `update()`, and `render()` timings
 * - **Bottom:** `[~]` hint (right)
 * - **Custom rows (optional):** demo-supplied bars stacked above the bottom bar, 1 px apart
 *
 * Drawn in screen space (camera reset) after demo `render()`, palette effects, and
 * before `endFrame()`. Toggle visibility with `Backquote` (`~`) or a primary pointer
 * press in the bottom-right 48x48 px region. When `statsOverlayEnabled` is `false`,
 * {@link BTAPI} does not construct an overlay and does not process toggle input.
 *
 * Overlay palette indices use one strict path: `statsOverlayStyle` values from
 * `configure()` when provided, otherwise fixed defaults `1` (bars) and `2` (text).
 */

import type { BitmapFont } from '../assets/BitmapFont';
import type { Backend, StatsOverlayRow, StatsOverlayStyle } from '../core/IBlitTechDemo';
import type { KeyboardInput } from '../input/KeyboardInput';
import type { PointerInput } from '../input/PointerInput';
import { POINTER_SLOT_COUNT } from '../input/PointerInput';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';

// #region Constants

/** Height of each stats bar strip in pixels. */
const STATS_BAR_HEIGHT = 13;

/** Horizontal inset from screen edges for stats text. */
const STATS_EDGE_MARGIN_PX = 3;

/** Gap between the bottom text baseline and the display bottom edge. */
const STATS_BOTTOM_TEXT_GAP_PX = -1;

/** Vertical offset for top-row text inside the top bar. */
const STATS_TOP_TEXT_Y = 0;

/** Gap between stacked stats bars (custom rows and bottom bar). */
const STATS_ROW_GAP_PX = 1;

/** Side length of the bottom-right corner region that toggles overlay visibility. */
const STATS_TOGGLE_CORNER_SIZE = 48;

/** `KeyboardEvent.code` for the tilde / backquote toggle key. */
const STATS_TOGGLE_KEY_CODE = 'Backquote';

/** Pointer primary button code (mouse left / touch). */
const POINTER_PRIMARY_BUTTON = 20;

/** Exponential smoothing factor for measured FPS (0..1). */
const FPS_SMOOTHING = 0.12;

/** `performance.now()` milliseconds per second. */
const MS_PER_SECOND = 1000;

/** Default palette indices when HUD named slots are unavailable. */
const DEFAULT_IDX_BG = 1;
const DEFAULT_IDX_TEXT = 2;

/** System font glyph advance in pixels. */
const SYSTEM_CHAR_ADVANCE = 6;

/** Matches demo registry titles: "Blit-Tech Demo 006 - Patterns". */
const REGISTRY_TITLE_PATTERN = /^Blit-Tech Demo\s+.+?\s+-\s+(.+)$/;

// #endregion

// #region Types

/** Cached screen-space layout for the overlay bars and toggle hit region. */
export interface StatsOverlayLayout {
    /** Logical display width in pixels (fixed at init). */
    readonly displayWidth: number;

    /** Logical display height in pixels (fixed at init). */
    readonly displayHeight: number;

    /** System font line height in pixels. */
    readonly lineHeight: number;

    /** Y baseline for bottom-bar text. */
    readonly bottomTextY: number;

    /** Y baseline for top-bar text. */
    readonly topTextY: number;

    /** Bottom-right 48x48 px region that toggles overlay visibility on primary press. */
    readonly toggleRect: Rect2i;
}

/**
 * Per-frame timing snapshot fed into {@link StatsOverlay.updateAndRender}.
 *
 * Values are wall-clock CPU timings from `performance.now()` measured by
 * {@link BTAPI} and smoothed inside the overlay before display.
 */
export interface StatsOverlayTimingSnapshot {
    /** Total frame CPU time in milliseconds (update + render callback work). */
    readonly frameMs: number;

    /** Sum of all fixed `update()` calls that ran for this frame, in milliseconds. */
    readonly updateMs: number;

    /** Demo `render()` wall time for this frame, in milliseconds. */
    readonly renderMs: number;

    /** Number of fixed update steps processed for this frame (0..8). */
    readonly updateSteps: number;

    /** Number of draw API calls issued by the demo for this frame. */
    readonly drawCalls: number;
}

// #endregion

// #region Helper Functions

/**
 * Turns the browser page title into a short top-left overlay label.
 *
 * @param pageTitle - Browser document title when available.
 * @returns Short label for the top-left bar (registry titles such as
 *   `Blit-Tech Demo 002 - Primitives` become `Primitives Demo`).
 */
export function resolveStatsTopLeftLabel(pageTitle: string | undefined): string {
    const raw = typeof pageTitle === 'string' ? pageTitle.trim() : '';

    if (raw.length === 0) {
        return 'Demo';
    }

    const match = raw.match(REGISTRY_TITLE_PATTERN);

    if (match) {
        return `${match[1]} Demo`;
    }

    return raw;
}

/**
 * Builds cached layout from logical display size and system font line height.
 *
 * @param displayWidth - Logical display width in pixels.
 * @param displayHeight - Logical display height in pixels.
 * @param lineHeight - System font line height in pixels.
 * @returns Frozen layout used for the lifetime of the overlay instance.
 */
export function createStatsOverlayLayout(
    displayWidth: number,
    displayHeight: number,
    lineHeight: number,
): StatsOverlayLayout {
    const bottomTextY = displayHeight - lineHeight - STATS_BOTTOM_TEXT_GAP_PX;
    const toggleRect = new Rect2i(
        displayWidth - STATS_TOGGLE_CORNER_SIZE,
        displayHeight - STATS_TOGGLE_CORNER_SIZE,
        STATS_TOGGLE_CORNER_SIZE,
        STATS_TOGGLE_CORNER_SIZE,
    );

    return {
        displayWidth,
        displayHeight,
        lineHeight,
        bottomTextY,
        topTextY: STATS_TOP_TEXT_Y,
        toggleRect,
    };
}

/**
 * Returns whether a pointer position lies inside the toggle corner rect.
 *
 * @param pos - Pointer position in display coordinates.
 * @param toggleRect - Bottom-right toggle region.
 * @returns `true` when the point is inside the rect (`Rect2i.contains` half-open bounds).
 */
export function isPointerInStatsToggleCorner(pos: Vector2i, toggleRect: Rect2i): boolean {
    return toggleRect.contains(pos);
}

/**
 * X position for right-aligned stats text inside a bar.
 *
 * @param text - Text to place flush right with {@link STATS_EDGE_MARGIN_PX} inset.
 * @param displayWidth - Logical display width in pixels.
 * @returns Left edge X for `drawBitmapText` (never less than the margin).
 */
export function statsRightAlignedTextX(text: string, displayWidth: number): number {
    const width = text.length * SYSTEM_CHAR_ADVANCE;

    return Math.max(STATS_EDGE_MARGIN_PX, displayWidth - width - STATS_EDGE_MARGIN_PX + 1);
}

/**
 * Palette offset for system-font overlay text (foreground glyphs stored as index 1).
 *
 * @param paletteIndex - Palette color index for overlay text.
 * @returns Offset passed to `drawBitmapText`, or `0` when index 0 (transparent).
 */
export function statsBitmapTextPaletteOffset(paletteIndex: number): number {
    return paletteIndex > 0 ? paletteIndex - 1 : 0;
}

// #endregion

// #region FpsSampler

/**
 * Smoothed render-frame FPS from `performance.now()` deltas between overlay draws.
 * Not the configured fixed-update rate; measures actual `requestAnimationFrame` cadence.
 */
class FpsSampler {
    #lastSampleMs: number | null = null;

    #smoothedFps: number | null = null;

    readonly #targetFps: number;

    /**
     * Creates a sampler seeded with the configured target rate.
     *
     * @param targetFps - Configured target FPS used until the first sample arrives.
     */
    constructor(targetFps: number) {
        this.#targetFps = targetFps;
    }

    /** Ingests one render-frame timing sample. */
    sample(): void {
        const now = performance.now();

        if (this.#lastSampleMs === null) {
            this.#lastSampleMs = now;
            this.#smoothedFps = this.#targetFps;
            return;
        }

        const deltaSeconds = (now - this.#lastSampleMs) / MS_PER_SECOND;
        this.#lastSampleMs = now;

        if (deltaSeconds <= 0) {
            return;
        }

        if (this.#smoothedFps === null) {
            this.#smoothedFps = this.#targetFps;
        }

        const instantFps = 1 / deltaSeconds;
        this.#smoothedFps += (instantFps - this.#smoothedFps) * FPS_SMOOTHING;
    }

    /**
     * Rounded smoothed render-frame rate from recent samples.
     *
     * @returns Smoothed frames per second.
     */
    get measuredFps(): number {
        return Math.round(this.#smoothedFps ?? this.#targetFps);
    }
}

// #endregion

// #region TimingSampler

/**
 * Exponentially smoothed overlay timings sourced from {@link StatsOverlayTimingSnapshot}.
 */
class TimingSampler {
    #hasSample = false;

    #smoothedFrameMs = 0;

    #smoothedUpdateMs = 0;

    #smoothedRenderMs = 0;

    #updateSteps = 0;

    #drawCalls = 0;

    /**
     * Ingests one frame-timing snapshot.
     *
     * @param sample - Current-frame timing values from BTAPI.
     */
    sample(sample: StatsOverlayTimingSnapshot): void {
        const frameMs = Math.max(0, sample.frameMs);
        const updateMs = Math.max(0, sample.updateMs);
        const renderMs = Math.max(0, sample.renderMs);

        if (!this.#hasSample) {
            this.#smoothedFrameMs = frameMs;
            this.#smoothedUpdateMs = updateMs;
            this.#smoothedRenderMs = renderMs;
            this.#hasSample = true;
        } else {
            this.#smoothedFrameMs += (frameMs - this.#smoothedFrameMs) * FPS_SMOOTHING;
            this.#smoothedUpdateMs += (updateMs - this.#smoothedUpdateMs) * FPS_SMOOTHING;
            this.#smoothedRenderMs += (renderMs - this.#smoothedRenderMs) * FPS_SMOOTHING;
        }

        this.#updateSteps = Math.max(0, Math.floor(sample.updateSteps));
        this.#drawCalls = Math.max(0, Math.floor(sample.drawCalls));
    }

    /**
     * Smoothed full-frame CPU time in milliseconds.
     *
     * @returns Smoothed frame time.
     */
    get frameMs(): number {
        return this.#smoothedFrameMs;
    }

    /**
     * Smoothed update-loop CPU time in milliseconds.
     *
     * @returns Smoothed update time.
     */
    get updateMs(): number {
        return this.#smoothedUpdateMs;
    }

    /**
     * Smoothed demo render CPU time in milliseconds.
     *
     * @returns Smoothed demo render time.
     */
    get renderMs(): number {
        return this.#smoothedRenderMs;
    }

    /**
     * Most recent fixed-step count for the frame.
     *
     * @returns Fixed update-step count.
     */
    get updateSteps(): number {
        return this.#updateSteps;
    }

    /**
     * Most recent draw-call count for the frame.
     *
     * @returns Draw-call count from demo draw APIs.
     */
    get drawCalls(): number {
        return this.#drawCalls;
    }
}

// #endregion

// #region StatsOverlay

/**
 * Screen-space stats HUD rendered after demo content each frame.
 *
 * Internal to the engine; demos do not instantiate this class. Use
 * {@link HardwareSettings.statsOverlayEnabled} and {@link BT.activeBackend} instead.
 */
export class StatsOverlay {
    readonly #layout: StatsOverlayLayout;

    readonly #topLeftLabel: string;

    readonly #bottomRightLabel: string;

    readonly #targetFps: number;

    readonly #fps: FpsSampler;

    readonly #timing: TimingSampler = new TimingSampler();

    #visible = true;

    #idxBg = DEFAULT_IDX_BG;

    #idxText = DEFAULT_IDX_TEXT;

    readonly #topRightLabel: string;

    readonly #topBarRect = new Rect2i(0, 0, 0, STATS_BAR_HEIGHT);

    readonly #topMetricsBarRect = new Rect2i(0, 0, 0, STATS_BAR_HEIGHT);

    readonly #topTimingBarRect = new Rect2i(0, 0, 0, STATS_BAR_HEIGHT);

    readonly #bottomBarRect = new Rect2i(0, 0, 0, STATS_BAR_HEIGHT);

    readonly #topLeftPos = new Vector2i(STATS_EDGE_MARGIN_PX, 0);

    readonly #topRightPos = new Vector2i(0, 0);

    readonly #topMetricsPos = new Vector2i(STATS_EDGE_MARGIN_PX, 0);

    readonly #topTimingPos = new Vector2i(STATS_EDGE_MARGIN_PX, 0);

    readonly #bottomRightPos = new Vector2i(0, 0);

    /** Reused bar rects for demo-supplied rows (index 0 = closest to bottom bar). */
    #customBarRects: Rect2i[] = [];

    /** Reused left text positions for custom rows. */
    #customLeftPos: Vector2i[] = [];

    /** Reused right text positions for custom rows. */
    #customRightPos: Vector2i[] = [];

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
        this.#bottomRightLabel = '[~]';
        this.#targetFps = targetFps;
        this.#fps = new FpsSampler(this.#targetFps);
        this.#idxBg = style?.barPaletteIndex ?? DEFAULT_IDX_BG;
        this.#idxText = style?.textPaletteIndex ?? DEFAULT_IDX_TEXT;

        const { displayWidth, displayHeight, bottomTextY, topTextY } = layout;

        this.#topBarRect.width = displayWidth;
        this.#topMetricsBarRect.y = STATS_BAR_HEIGHT + STATS_ROW_GAP_PX;
        this.#topMetricsBarRect.width = displayWidth;
        this.#topTimingBarRect.y = (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX) * 2;
        this.#topTimingBarRect.width = displayWidth;
        this.#bottomBarRect.y = displayHeight - STATS_BAR_HEIGHT;
        this.#bottomBarRect.width = displayWidth;
        this.#topLeftPos.y = topTextY;
        this.#topRightPos.y = topTextY;
        this.#topMetricsPos.y = this.#topMetricsBarRect.y + STATS_TOP_TEXT_Y;
        this.#topTimingPos.y = this.#topTimingBarRect.y + STATS_TOP_TEXT_Y;
        this.#bottomRightPos.y = bottomTextY;
        this.#bottomRightPos.x = statsRightAlignedTextX(this.#bottomRightLabel, displayWidth);
        this.#topRightLabel = `${activeBackend} | ${displayWidth}x${displayHeight}`;
        this.#topRightPos.x = statsRightAlignedTextX(this.#topRightLabel, displayWidth);
    }

    /**
     * Whether the overlay is currently drawn (runtime toggle).
     *
     * @returns `true` while top and bottom bars are rendered.
     */
    get visible(): boolean {
        return this.#visible;
    }

    /**
     * Resolves bar and text palette indices for one custom row.
     *
     * @param row - Demo-supplied overlay row.
     * @returns Bar fill index and system-font text index.
     */
    #resolveRowPaletteIndices(row: StatsOverlayRow): { barIndex: number; textIndex: number } {
        return {
            barIndex: row.barPaletteIndex ?? this.#idxBg,
            textIndex: row.textPaletteIndex ?? this.#idxText,
        };
    }

    /**
     * Handles toggle input (Backquote and bottom-right corner press).
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param keyboard - Keyboard subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     */
    handleToggle(pointer: PointerInput | null, keyboard: KeyboardInput | null, currentTick: number): void {
        if (keyboard?.isKeyPressed(STATS_TOGGLE_KEY_CODE, undefined, currentTick)) {
            this.#visible = !this.#visible;
            return;
        }

        if (!pointer) {
            return;
        }

        for (let slot = 0; slot < POINTER_SLOT_COUNT; slot++) {
            if (!pointer.isButtonPressed(POINTER_PRIMARY_BUTTON, slot)) {
                continue;
            }

            const pos = pointer.getPos(slot);

            if (isPointerInStatsToggleCorner(pos, this.#layout.toggleRect)) {
                this.#visible = !this.#visible;
                return;
            }
        }
    }

    /**
     * Ensures the custom-row scratch pool has at least `count` entries.
     *
     * @param count - Number of demo rows to draw this frame.
     */
    #ensureCustomRowPool(count: number): void {
        while (this.#customBarRects.length < count) {
            const barRect = new Rect2i(0, 0, this.#layout.displayWidth, STATS_BAR_HEIGHT);

            this.#customBarRects.push(barRect);
            this.#customLeftPos.push(new Vector2i(STATS_EDGE_MARGIN_PX, 0));
            this.#customRightPos.push(new Vector2i(0, 0));
        }
    }

    /**
     * Y coordinate of the top edge of a custom row bar stacked above the bottom bar.
     *
     * @param rowIndex - `0` is directly above the bottom `[~]` bar.
     * @returns Bar top Y in display pixels.
     */
    #customBarY(rowIndex: number): number {
        const bottomBarY = this.#layout.displayHeight - STATS_BAR_HEIGHT;

        return bottomBarY - (rowIndex + 1) * (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);
    }

    /**
     * Draws demo-supplied rows as stacked bars above the bottom bar.
     *
     * @param renderer - Active renderer.
     * @param font - System bitmap font.
     * @param rows - Custom overlay rows from {@link IBlitTechDemo.statsOverlayRows}.
     */
    #drawCustomRows(renderer: IRenderer, font: BitmapFont, rows: readonly StatsOverlayRow[]): void {
        const rowCount = rows.length;

        if (rowCount === 0) {
            return;
        }

        this.#ensureCustomRowPool(rowCount);
        const { displayWidth } = this.#layout;

        /* eslint-disable security/detect-object-injection -- rowIndex is bounded by rows.length and the scratch pool */
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const row = rows[rowIndex];
            const barY = this.#customBarY(rowIndex);
            const barRect = this.#customBarRects[rowIndex];
            const leftPos = this.#customLeftPos[rowIndex];
            const rightPos = this.#customRightPos[rowIndex];

            if (row === undefined || barRect === undefined || leftPos === undefined || rightPos === undefined) {
                continue;
            }

            const { barIndex, textIndex } = this.#resolveRowPaletteIndices(row);
            const textPaletteOffset = statsBitmapTextPaletteOffset(textIndex);

            barRect.y = barY;
            barRect.width = displayWidth;
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
     */
    updateAndRender(
        renderer: IRenderer,
        font: BitmapFont,
        pointer: PointerInput | null,
        keyboard: KeyboardInput | null,
        currentTick: number,
        getCustomRows?: () => readonly StatsOverlayRow[] | undefined,
        timing?: StatsOverlayTimingSnapshot,
    ): void {
        this.#fps.sample();

        if (timing) {
            this.#timing.sample(timing);
        }

        this.handleToggle(pointer, keyboard, currentTick);

        if (!this.#visible) {
            return;
        }

        const customRows = getCustomRows?.();
        const savedCamera = renderer.getCameraOffset();

        renderer.resetCamera();

        const updateStepSuffix = this.#timing.updateSteps > 1 ? `x${this.#timing.updateSteps}` : '';
        const topMetricsLabel = `Present FPS: ${this.#fps.measuredFps} | Target FPS: ${this.#targetFps} | Draw Calls: ${this.#timing.drawCalls}`;
        const topTimingLabel =
            `Frame: ${this.#timing.frameMs.toFixed(1)}ms | update(): ${this.#timing.updateMs.toFixed(1)}ms${updateStepSuffix} | ` +
            `render(): ${this.#timing.renderMs.toFixed(1)}ms`;

        renderer.drawRectFillOnTop(this.#topBarRect, this.#idxBg);
        renderer.drawRectFillOnTop(this.#topMetricsBarRect, this.#idxBg);
        renderer.drawRectFillOnTop(this.#topTimingBarRect, this.#idxBg);
        renderer.drawRectFillOnTop(this.#bottomBarRect, this.#idxBg);

        if (customRows !== undefined && customRows.length > 0) {
            this.#drawCustomRows(renderer, font, customRows);
        }

        const textPaletteOffset = statsBitmapTextPaletteOffset(this.#idxText);

        renderer.drawBitmapTextOnTop(font, this.#topLeftPos, this.#topLeftLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, this.#topRightPos, this.#topRightLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, this.#topMetricsPos, topMetricsLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, this.#topTimingPos, topTimingLabel, textPaletteOffset);
        renderer.drawBitmapTextOnTop(font, this.#bottomRightPos, this.#bottomRightLabel, textPaletteOffset);

        renderer.setCameraOffset(savedCamera);
    }
}

// #endregion
