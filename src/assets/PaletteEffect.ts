/**
 * Palette effect system for animated color manipulation.
 *
 * Effects operate on palette entries ({@link Color32} arrays) in place. The visual
 * change happens automatically on the next frame when the renderer detects the
 * dirty flag and re-uploads the palette uniform buffer.
 *
 * The {@link PaletteEffectManager} is called once per frame from the render
 * callback, after `demo.render()` but before `Renderer.endFrame()`.
 */

import { Color32 } from '../utils/Color32';
import type { EasingFunction } from '../utils/Easing';
import { applyEasing } from '../utils/Easing';
import type { Palette } from './Palette';

// #region Types

/**
 * A single palette effect that runs over time.
 *
 * The manager calls {@link update} once per frame. The effect mutates palette
 * entries via `palette.getRef()` and returns `true` to keep running or `false`
 * to signal completion (the manager removes it automatically).
 */
export interface PaletteEffect {
    /**
     * Advances the effect by one frame.
     *
     * @param palette - Active palette to modify.
     * @param deltaMs - Wall-clock milliseconds since the last frame.
     * @returns `true` to keep running, `false` to remove from the manager.
     */
    update(palette: Palette, deltaMs: number): boolean;
}

// #endregion

// #region PaletteEffectManager

/**
 * Manages active palette effects and updates them each frame.
 *
 * Tracks wall-clock time internally via an injectable time provider so the
 * {@link GameLoop} callback signatures remain unchanged.
 */
export class PaletteEffectManager {
    private effects: PaletteEffect[] = [];
    private lastTime = 0;
    private readonly timeProvider: () => number;

    /**
     * Creates a new effect manager.
     *
     * @param timeProvider - Clock function returning milliseconds. Defaults to
     *   `performance.now()`. Pass a custom function for deterministic unit tests.
     */
    constructor(timeProvider: () => number = () => performance.now()) {
        this.timeProvider = timeProvider;
    }

    /**
     * Adds an effect to the active list.
     *
     * @param effect - Effect instance to run each frame.
     */
    add(effect: PaletteEffect): void {
        this.effects.push(effect);
    }

    /**
     * Updates all active effects and removes completed ones.
     *
     * Call this once per frame. Completed effects (returning `false`) are pruned
     * in place without allocating a new array.
     *
     * @param palette - Active palette to pass to each effect.
     */
    update(palette: Palette): void {
        const now = this.timeProvider();
        const deltaMs = this.lastTime === 0 ? 0 : now - this.lastTime;

        this.lastTime = now;

        if (this.effects.length === 0) {
            return;
        }

        // In-place compaction: keep running effects, drop completed ones.
        let writeIdx = 0;

        for (let i = 0; i < this.effects.length; i++) {
            // eslint-disable-next-line security/detect-object-injection -- Safe: i is a controlled loop index within bounds
            const effect = this.effects[i];

            if (effect?.update(palette, deltaMs)) {
                // eslint-disable-next-line security/detect-object-injection -- Safe: writeIdx <= i, always within bounds
                this.effects[writeIdx] = effect;
                writeIdx++;
            }
        }

        this.effects.length = writeIdx;
        palette.markDirty();
    }

    /** Removes all active effects immediately. The palette stays at its current state. */
    clear(): void {
        this.effects.length = 0;
    }

    /**
     * Number of currently running effects.
     *
     * @returns Count of active effects in the manager.
     */
    get activeCount(): number {
        return this.effects.length;
    }
}

// #endregion

// #region CycleEffect

/**
 * Rotates a range of palette entries at a constant speed.
 *
 * Classic water/fire/plasma animation. Runs indefinitely until cancelled
 * via {@link PaletteEffectManager.clear}.
 *
 * Uses a fractional accumulator for sub-frame precision and a pre-allocated
 * temporary {@link Color32} to avoid per-frame allocations.
 */
export class CycleEffect implements PaletteEffect {
    private accumulator = 0;
    private readonly temp = new Color32(0, 0, 0, 0);

    /**
     * Creates a palette cycling effect.
     *
     * @param start - First palette index in the cycling range (inclusive).
     * @param end - Last palette index in the cycling range (inclusive).
     * @param speed - Steps per second. Positive = forward, negative = backward.
     */
    constructor(
        private readonly start: number,
        private readonly end: number,
        private readonly speed: number,
    ) {}

    update(palette: Palette, deltaMs: number): boolean {
        if (this.speed === 0 || this.start >= this.end) {
            return true;
        }

        this.accumulator += (this.speed * deltaMs) / 1000;

        // Forward rotation: shift entries toward lower indices, wrap last to first.
        while (this.accumulator >= 1) {
            this.accumulator -= 1;
            this.rotateForward(palette);
        }

        // Backward rotation: shift entries toward higher indices, wrap first to last.
        while (this.accumulator <= -1) {
            this.accumulator += 1;
            this.rotateBackward(palette);
        }

        return true; // Runs indefinitely.
    }

    /**
     * Shifts entries toward lower indices, wrapping the first entry to the end.
     *
     * @param palette - Palette whose entries are rotated.
     */
    private rotateForward(palette: Palette): void {
        this.temp.copyFrom(palette.getRef(this.start));

        for (let i = this.start; i < this.end; i++) {
            palette.getRef(i).copyFrom(palette.getRef(i + 1));
        }

        palette.getRef(this.end).copyFrom(this.temp);
    }

    /**
     * Shifts entries toward higher indices, wrapping the last entry to the start.
     *
     * @param palette - Palette whose entries are rotated.
     */
    private rotateBackward(palette: Palette): void {
        this.temp.copyFrom(palette.getRef(this.end));

        for (let i = this.end; i > this.start; i--) {
            palette.getRef(i).copyFrom(palette.getRef(i - 1));
        }

        palette.getRef(this.start).copyFrom(this.temp);
    }
}

// #endregion

// #region FadeEffect

/**
 * Smoothly interpolates all palette entries toward a target palette over time.
 *
 * Snapshots the current palette at creation. Each frame computes an eased
 * progress value and lerps between the snapshot and target. At completion,
 * sets entries to the exact target values to avoid floating-point drift.
 *
 * Auto-removes when the fade completes.
 */
export class FadeEffect implements PaletteEffect {
    private elapsed = 0;
    private readonly snapshotColors: Color32[];
    private readonly targetColors: Color32[];
    private readonly size: number;

    /**
     * Creates a full-palette fade effect.
     *
     * @param sourcePalette - Snapshot of the starting palette (cloned internally).
     * @param targetPalette - Target palette to fade toward.
     * @param durationMs - Fade duration in milliseconds.
     * @param easing - Easing curve to apply. Defaults to `'linear'`.
     */
    constructor(
        sourcePalette: Palette,
        targetPalette: Palette,
        private readonly durationMs: number,
        private readonly easing: EasingFunction = 'linear',
    ) {
        this.size = sourcePalette.size;

        // Snapshot source colors once (one-time allocation).
        this.snapshotColors = [];

        for (let i = 0; i < this.size; i++) {
            this.snapshotColors.push(sourcePalette.get(i));
        }

        // Cache target colors to avoid repeated cloning.
        this.targetColors = [];

        for (let i = 0; i < targetPalette.size; i++) {
            this.targetColors.push(targetPalette.get(i));
        }
    }

    update(palette: Palette, deltaMs: number): boolean {
        this.elapsed += deltaMs;

        const rawT = this.durationMs <= 0 ? 1 : this.elapsed / this.durationMs;
        const t = rawT < 0 ? 0 : rawT > 1 ? 1 : rawT;
        const easedT = applyEasing(t, this.easing);

        const count = Math.min(this.size, palette.size);

        for (let i = 1; i < count; i++) {
            // eslint-disable-next-line security/detect-object-injection -- Loop index within validated bounds
            const snap = this.snapshotColors[i];
            // eslint-disable-next-line security/detect-object-injection -- Loop index within validated bounds
            const tgt = this.targetColors[i];

            if (!snap || !tgt) {
                continue;
            }

            if (t >= 1) {
                palette.getRef(i).copyFrom(tgt);
            } else {
                palette.getRef(i).copyFrom(snap).lerpInPlace(tgt, easedT);
            }
        }

        return t < 1;
    }
}

// #endregion

// #region FadeRangeEffect

/**
 * Fades only a subset of palette indices toward a target palette.
 *
 * Identical to {@link FadeEffect} but restricted to the range `[start, end]`.
 * Auto-removes when the fade completes.
 */
export class FadeRangeEffect implements PaletteEffect {
    private elapsed = 0;
    private readonly snapshotColors: Color32[];
    private readonly targetColors: Color32[];

    /**
     * Creates a range-limited fade effect.
     *
     * @param start - First palette index to fade (inclusive).
     * @param end - Last palette index to fade (inclusive).
     * @param sourcePalette - Snapshot of the starting palette (cloned internally).
     * @param targetPalette - Target palette to fade toward.
     * @param durationMs - Fade duration in milliseconds.
     * @param easing - Easing curve to apply. Defaults to `'linear'`.
     */
    constructor(
        private readonly start: number,
        private readonly end: number,
        sourcePalette: Palette,
        targetPalette: Palette,
        private readonly durationMs: number,
        private readonly easing: EasingFunction = 'linear',
    ) {
        // Snapshot only the range we care about.
        this.snapshotColors = [];

        for (let i = start; i <= end; i++) {
            this.snapshotColors.push(sourcePalette.get(i));
        }

        this.targetColors = [];

        for (let i = start; i <= end; i++) {
            this.targetColors.push(targetPalette.get(i));
        }
    }

    update(palette: Palette, deltaMs: number): boolean {
        this.elapsed += deltaMs;

        const rawT = this.durationMs <= 0 ? 1 : this.elapsed / this.durationMs;
        const t = rawT < 0 ? 0 : rawT > 1 ? 1 : rawT;
        const easedT = applyEasing(t, this.easing);

        for (let i = this.start; i <= this.end; i++) {
            const localIdx = i - this.start;

            // eslint-disable-next-line security/detect-object-injection -- localIdx derived from loop bounds
            const snap = this.snapshotColors[localIdx];
            // eslint-disable-next-line security/detect-object-injection -- localIdx derived from loop bounds
            const tgt = this.targetColors[localIdx];

            if (!snap || !tgt) {
                continue;
            }

            if (t >= 1) {
                palette.getRef(i).copyFrom(tgt);
            } else {
                palette.getRef(i).copyFrom(snap).lerpInPlace(tgt, easedT);
            }
        }

        return t < 1;
    }
}

// #endregion

// #region FlashEffect

/**
 * Temporarily sets all palette entries to a single color, then restores.
 *
 * On the first frame, snapshots all entries and overwrites them with the flash
 * color (index 0 is preserved as transparent). After the duration elapses,
 * restores the snapshot and auto-removes.
 */
export class FlashEffect implements PaletteEffect {
    private elapsed = 0;
    private snapshotColors: Color32[] | null = null;

    /**
     * Creates a palette flash effect.
     *
     * @param color - Flash color applied to all non-zero entries.
     * @param durationMs - How long the flash lasts in milliseconds.
     */
    constructor(
        private readonly color: Color32,
        private readonly durationMs: number,
    ) {}

    update(palette: Palette, deltaMs: number): boolean {
        // First frame: snapshot and apply flash.
        if (this.snapshotColors === null) {
            this.snapshotColors = [];

            for (let i = 0; i < palette.size; i++) {
                this.snapshotColors.push(palette.get(i));
            }

            for (let i = 1; i < palette.size; i++) {
                palette.getRef(i).copyFrom(this.color);
            }

            return true;
        }

        this.elapsed += deltaMs;

        if (this.elapsed >= this.durationMs) {
            // Restore from snapshot.
            for (let i = 1; i < palette.size; i++) {
                // eslint-disable-next-line security/detect-object-injection -- Loop index within validated snapshot bounds
                const saved = this.snapshotColors[i];

                if (saved) {
                    palette.getRef(i).copyFrom(saved);
                }
            }

            return false;
        }

        // Keep flashing.
        return true;
    }
}

// #endregion

// #region Standalone Functions

/**
 * Instantly exchanges two palette entries.
 *
 * This is an immediate operation, not an animated effect. It modifies the
 * palette directly and marks it dirty for the renderer.
 *
 * @param palette - Palette to modify.
 * @param indexA - First palette index.
 * @param indexB - Second palette index.
 */
export function paletteSwap(palette: Palette, indexA: number, indexB: number): void {
    if (indexA === indexB) {
        return;
    }

    const refA = palette.getRef(indexA);
    const refB = palette.getRef(indexB);

    const tempR = refA.r;
    const tempG = refA.g;
    const tempB = refA.b;
    const tempAlpha = refA.a;

    refA.copyFrom(refB);
    refB.setRGBA(tempR, tempG, tempB, tempAlpha);

    palette.markDirty();
}

// #endregion
