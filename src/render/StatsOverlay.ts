/**
 * Engine-managed stats overlay (FPS, target rate, demo label, backend).
 *
 * Instantiated by {@link BTAPI} when {@link HardwareSettings.statsOverlayEnabled} is
 * `true` (default). Layout is computed once at init from logical `displaySize` and
 * system font metrics; per-frame work samples render timing and draws two 15 px bars:
 *
 * - **Top:** demo title (left) and `backend | WxH` (right)
 * - **Bottom:** `FPS: N | Target: T` (left) and demo title (right)
 *
 * Drawn in screen space (camera reset) after demo `render()`, palette effects, and
 * before `endFrame()`. Toggle visibility with `Backquote` (`~`) or a primary pointer
 * press in the bottom-right 48x48 px region. When `statsOverlayEnabled` is `false`,
 * {@link BTAPI} does not construct an overlay and does not process toggle input.
 *
 * Palette colors prefer `hud_bg` and `hud_dim` when {@link Palette.applyHUD} registered those
 * aliases; otherwise indices `1` (bars) and `2` (text) are used.
 */

import type { BitmapFont } from '../assets/BitmapFont';
import type { Palette } from '../assets/Palette';
import type { RendererBackend } from '../core/IBlitTechDemo';
import type { KeyboardInput } from '../input/KeyboardInput';
import type { PointerInput } from '../input/PointerInput';
import { POINTER_SLOT_COUNT } from '../input/PointerInput';
import { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import type { IRenderer } from './IRenderer';

// #region Constants

/** Height of each stats bar strip in pixels. */
const STATS_BAR_HEIGHT = 16;

/** Horizontal inset from screen edges for stats text. */
const STATS_EDGE_MARGIN_PX = 5;

/** Gap between the bottom text baseline and the display bottom edge. */
const STATS_BOTTOM_TEXT_GAP_PX = 1;

/** Vertical offset for top-row text inside the top bar. */
const STATS_TOP_TEXT_Y = 1;

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

// #endregion

// #region Helper Functions

/**
 * Validates a configured fixed-update rate for overlay display.
 *
 * @param targetFps - Configured fixed-update rate.
 * @returns Valid positive target FPS.
 */
function validateTargetFps(targetFps: number): number {
    return Number.isFinite(targetFps) && targetFps > 0 ? targetFps : 60;
}

/**
 * Turns the browser page title into a short bottom-bar demo label.
 *
 * @param pageTitle - Browser document title when available.
 * @returns Short demo label for the top-left and bottom-right bars (registry titles such as
 *   `Blit-Tech Demo 002 - Primitives` become `Primitives Demo`).
 */
export function resolveStatsDemoLabel(pageTitle: string | undefined): string {
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
 * @param text - Label to place flush right with {@link STATS_EDGE_MARGIN_PX} inset.
 * @param displayWidth - Logical display width in pixels.
 * @returns Left edge X for `drawBitmapText` (never less than the margin).
 */
export function statsRightAlignedTextX(text: string, displayWidth: number): number {
    const width = text.length * SYSTEM_CHAR_ADVANCE;

    return Math.max(STATS_EDGE_MARGIN_PX, displayWidth - width - STATS_EDGE_MARGIN_PX + 1);
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
        this.#targetFps = validateTargetFps(targetFps);
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

// #region StatsOverlay

/**
 * Screen-space stats HUD rendered after demo content each frame.
 *
 * Internal to the engine; demos do not instantiate this class. Use
 * {@link HardwareSettings.statsOverlayEnabled} and {@link BT.activeBackend} instead.
 */
export class StatsOverlay {
    readonly #layout: StatsOverlayLayout;

    readonly #demoLabel: string;

    readonly #targetFps: number;

    readonly #fps: FpsSampler;

    #visible = true;

    #paletteResolved = false;

    #idxBg = DEFAULT_IDX_BG;

    #idxText = DEFAULT_IDX_TEXT;

    #activeBackend: RendererBackend | null = null;

    /**
     * Creates an overlay with fixed layout and label strings.
     *
     * @param layout - Cached display layout from {@link createStatsOverlayLayout}.
     * @param demoLabel - Short title shown on the top-left and bottom-right.
     * @param targetFps - Configured fixed-update rate for the target FPS line.
     */
    constructor(layout: StatsOverlayLayout, demoLabel: string, targetFps: number) {
        this.#layout = layout;
        this.#demoLabel = demoLabel;
        this.#targetFps = validateTargetFps(targetFps);
        this.#fps = new FpsSampler(this.#targetFps);
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
     * Updates the backend label shown on the top bar (right).
     *
     * @param backend - Active renderer backend, or `null` before init completes.
     */
    setActiveBackend(backend: RendererBackend | null): void {
        this.#activeBackend = backend;
    }

    /**
     * Resolves HUD palette indices once from named slots when present.
     *
     * @param palette - Active engine palette.
     */
    resolvePaletteIndices(palette: Palette): void {
        if (this.#paletteResolved) {
            return;
        }

        try {
            this.#idxBg = palette.getNamed('hud_bg');
            this.#idxText = palette.getNamed('hud_dim');
        } catch {
            // Keep default indices when HUD aliases were not registered.
        }

        this.#paletteResolved = true;
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
     * Processes toggle input then draws the overlay.
     *
     * @param renderer - Active renderer backend.
     * @param font - System bitmap font.
     * @param palette - Active palette, if any.
     * @param pointer - Pointer subsystem for corner toggle.
     * @param keyboard - Keyboard subsystem for Backquote toggle.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     */
    updateAndRender(
        renderer: IRenderer,
        font: BitmapFont,
        palette: Palette | null,
        pointer: PointerInput | null,
        keyboard: KeyboardInput | null,
        currentTick: number,
    ): void {
        this.#fps.sample();
        this.handleToggle(pointer, keyboard, currentTick);

        if (!this.#visible) {
            return;
        }

        if (palette) {
            this.resolvePaletteIndices(palette);
        }

        const savedCamera = renderer.getCameraOffset();
        renderer.resetCamera();

        const { displayWidth, displayHeight, bottomTextY, topTextY } = this.#layout;

        renderer.drawRectFill(new Rect2i(0, 0, displayWidth, STATS_BAR_HEIGHT), this.#idxBg);
        renderer.drawRectFill(
            new Rect2i(0, displayHeight - STATS_BAR_HEIGHT, displayWidth, STATS_BAR_HEIGHT),
            this.#idxBg,
        );

        const backendText = `${this.#activeBackend ?? '…'} | ${displayWidth}x${displayHeight}`;
        const fpsText = `FPS: ${this.#fps.measuredFps} | Target: ${this.#targetFps}`;
        const topRightX = statsRightAlignedTextX(backendText, displayWidth);
        const bottomTitleX = statsRightAlignedTextX(this.#demoLabel, displayWidth);

        renderer.drawBitmapText(font, new Vector2i(STATS_EDGE_MARGIN_PX, topTextY), this.#demoLabel, this.#idxText - 1);
        renderer.drawBitmapText(font, new Vector2i(topRightX, topTextY), backendText, this.#idxText - 1);
        renderer.drawBitmapText(font, new Vector2i(STATS_EDGE_MARGIN_PX, bottomTextY), fpsText, this.#idxText - 1);
        renderer.drawBitmapText(font, new Vector2i(bottomTitleX, bottomTextY), this.#demoLabel, this.#idxText - 1);

        renderer.setCameraOffset(savedCamera);
    }
}

// #endregion
