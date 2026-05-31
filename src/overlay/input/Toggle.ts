import type { KeyboardInput } from '../../input/KeyboardInput';
import type { PointerInput } from '../../input/PointerInput';
import { POINTER_SLOT_COUNT } from '../../input/PointerInput';
import type { Rect2i } from '../../utils/Rect2i';
import { isPointerInOverlayToggleCorner } from '../layout/layoutHelpers';
import { OVERLAY_TOGGLE_KEY_CODE, POINTER_PRIMARY_BUTTON } from './constants';

/**
 * Handles overlay body visibility toggle input (Backquote and corner pointer).
 */
export class Toggle {
    #isBodyVisible: boolean;

    readonly #toggleEnabled: boolean;

    /**
     * Creates toggle state from configure-time visibility and input flags.
     *
     * @param visibleAtStart - Initial overlay body visibility from configure.
     * @param toggleEnabled - When false, toggle input is ignored.
     */
    constructor(visibleAtStart = false, toggleEnabled = true) {
        this.#bodyVisible = visibleAtStart;
        this.#toggleEnabled = toggleEnabled;
    }

    /**
     * Whether the overlay body is currently drawn (runtime toggle).
     *
     * @returns `true` while metrics bars and palette grid are rendered.
     */
    get isBodyVisible(): boolean {
        return this.#isBodyVisible;
    }

    /**
     * Handles toggle input (Backquote and bottom-left corner press).
     *
     * @param pointer - Pointer subsystem, or `null` when unavailable.
     * @param keyboard - Keyboard subsystem, or `null` when unavailable.
     * @param currentTick - Current fixed-update tick for keyboard edge detection.
     * @param toggleRect - Bottom-left toggle hit region.
     * @param pointerPressConsumed - When true, skip pointer corner toggle (palette swatch handled the press).
     */
    handleToggle(
        pointer: PointerInput | null,
        keyboard: KeyboardInput | null,
        currentTick: number,
        toggleRect: Rect2i,
        pointerPressConsumed = false,
    ): void {
        if (!this.#toggleEnabled) {
            return;
        }

        if (keyboard?.isKeyPressed(OVERLAY_TOGGLE_KEY_CODE, undefined, currentTick)) {
            this.#isBodyVisible = !this.#isBodyVisible;

            return;
        }

        if (!pointer || pointerPressConsumed) {
            return;
        }

        for (let slot = 0; slot < POINTER_SLOT_COUNT; slot++) {
            if (!pointer.isButtonPressed(POINTER_PRIMARY_BUTTON, slot)) {
                continue;
            }

            const pos = pointer.getPos(slot);

            if (isPointerInOverlayToggleCorner(pos, toggleRect)) {
                this.#isBodyVisible = !this.#isBodyVisible;

                return;
            }
        }
    }
}
