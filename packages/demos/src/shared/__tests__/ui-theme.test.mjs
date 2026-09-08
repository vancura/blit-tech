/**
 * Unit tests for the shared UI theme's slot allocation. `applyTheme()` is pure aside from
 * mutating the `palette` it is given and the module-level `T` singleton, so every case here
 * uses a small fake palette instead of a real `blit386` one.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyTheme, T, THEME_DEFAULT_START_SLOT, THEME_PANEL_OFFSET, THEME_TEXT_OFFSET } from '../ui-theme.js';

/**
 * A minimal fake palette: just enough surface for applyTheme() to write into (`size`,
 * `set(slot, color)`, `setNamed(name, slot)`).
 *
 * @param {number} [size] – Palette slot count.
 * @returns {{ size: number, slots: Map<number, unknown>, named: Map<string, number>,
 *   set: (slot: number, color: unknown) => void, setNamed: (name: string, slot: number) => void }}
 */
function createFakePalette(size = 256) {
    const slots = new Map();
    const named = new Map();

    return {
        size,
        slots,
        named,
        set(slot, color) {
            slots.set(slot, color);
        },
        setNamed(name, slot) {
            named.set(name, slot);
        },
    };
}

describe('applyTheme', () => {
    it('installs the twelve theme colors starting at the default slot 240', () => {
        const palette = createFakePalette();
        const theme = applyTheme(palette);

        assert.equal(THEME_DEFAULT_START_SLOT, 240);
        assert.equal(theme.bg, 240);
        assert.equal(theme.buttonHover, 251);
        assert.equal(palette.slots.size, 12);
    });

    it('returns exactly the twelve documented color keys', () => {
        const palette = createFakePalette();
        const theme = applyTheme(palette);

        assert.deepEqual(Object.keys(theme).sort(), [
            'accent',
            'bg',
            'border',
            'button',
            'buttonHover',
            'dim',
            'header',
            'info',
            'panel',
            'shadow',
            'text',
            'warm',
        ]);
    });

    it('shifts the whole block when a custom startSlot is passed', () => {
        const palette = createFakePalette();
        const theme = applyTheme(palette, 100);

        assert.equal(theme.bg, 100);
        assert.equal(theme.panel, 100 + THEME_PANEL_OFFSET);
        assert.equal(theme.text, 100 + THEME_TEXT_OFFSET);
        assert.equal(theme.buttonHover, 111);
    });

    it('throws when startSlot is not an integer', () => {
        const palette = createFakePalette();

        assert.throws(() => applyTheme(palette, 10.5), /startSlot must be an integer/);
    });

    it('throws when startSlot is less than 1', () => {
        const palette = createFakePalette();

        assert.throws(() => applyTheme(palette, 0), /startSlot must be an integer/);
    });

    it('throws when the 12-slot block would not fit in the palette', () => {
        const palette = createFakePalette(10);

        assert.throws(() => applyTheme(palette, 1), /do not fit in a palette of size 10/);
    });

    it("fits exactly when the block ends on the palette's last slot", () => {
        const palette = createFakePalette(252);

        // 12 colors starting at 240 fill slots 240..251 – the last slot of a 252-size palette.
        assert.doesNotThrow(() => applyTheme(palette, 240));
    });

    it('registers a named alias for every color', () => {
        const palette = createFakePalette();

        applyTheme(palette);

        assert.equal(palette.named.get('ui_bg'), 240);
        assert.equal(palette.named.get('ui_button_hover'), 251);
    });

    it('returns a fresh copy, not the live T singleton', () => {
        const palette = createFakePalette();
        const theme = applyTheme(palette);

        assert.notStrictEqual(theme, T);

        theme.bg = 999;

        assert.notEqual(T.bg, 999);
    });

    it('a later call overwrites the module-level T singleton in place', () => {
        const palette = createFakePalette();

        applyTheme(palette, 50);
        assert.equal(T.bg, 50);

        applyTheme(palette, 150);
        assert.equal(T.bg, 150);
    });
});
