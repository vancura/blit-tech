import type { KeyboardInput } from '../../input/KeyboardInput';
import type { PointerInput } from '../../input/PointerInput';
import { POINTER_SLOT_COUNT } from '../../input/PointerInput';
import type { Rect2i } from '../../utils/Rect2i';
import { POINTER_PRIMARY_BUTTON, STATS_TOGGLE_KEY_CODE } from './constants';
import { isPointerInStatsToggleCorner } from './layoutHelpers';

/**
 * Handles stats overlay visibility toggle input (Backquote and corner pointer).
 */
export class StatsOverlayToggle {
    #visible = true;

    /**
     * Whether the overlay is currently drawn (runtime toggle).
     *
     * @returns `true` while bars are rendered.
     */
    get visible(): boolean {
        return this.#visible;
    }

    /**
     * Handles toggle input (Backquote and bottom-right corner press).
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param keyboard - Keyboard subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     * @param toggleRect - Bottom-right toggle hit region.
     */
    handleToggle(
        pointer: PointerInput | null,
        keyboard: KeyboardInput | null,
        currentTick: number,
        toggleRect: Rect2i,
    ): void {
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

            if (isPointerInStatsToggleCorner(pos, toggleRect)) {
                this.#visible = !this.#visible;
                return;
            }
        }
    }
}
