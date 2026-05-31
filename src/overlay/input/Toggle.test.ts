import { describe, expect, it } from 'vitest';

import { Rect2i } from '../../utils/Rect2i';
import { Toggle } from './Toggle';

describe('Toggle.handleInput', () => {
    it('toggles from keyboard input', () => {
        const toggle = new Toggle(false, true);
        const keyboard = {
            isKeyPressed: (key: string, _repeatRate: number | undefined, tick: number): boolean =>
                key === 'Backquote' && tick === 5,
        };

        toggle.handleInput(null, keyboard as never, 5, new Rect2i(0, 0, 48, 48), false);

        expect(toggle.isBodyVisible).toBe(true);
    });

    it('forwards pointerPressConsumed flag to prevent pointer toggle', () => {
        const toggle = new Toggle(false, true);
        const pointer = {
            isButtonPressed: (): boolean => true,
            getPos: () => ({ x: 8, y: 8 }),
        };
        const keyboard = {
            isKeyPressed: (): boolean => false,
        };

        toggle.handleInput(pointer as never, keyboard as never, 1, new Rect2i(0, 0, 48, 48), true);

        expect(toggle.isBodyVisible).toBe(false);
    });
});
