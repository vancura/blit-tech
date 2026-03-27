/**
 * Unit tests for the default hardware-settings helper exported by
 * {@link IBlitTechDemo}.
 *
 * Confirms the default display resolution and frame rate, ensures optional
 * canvas sizing is omitted by default, and verifies each call returns fresh
 * objects so demos cannot accidentally share mutable settings state.
 */

import { describe, expect, it } from 'vitest';

import { defaultHardwareSettings } from './IBlitTechDemo';

describe('defaultHardwareSettings', () => {
    it('should return 320x240 display size', () => {
        const settings = defaultHardwareSettings();

        expect(settings.displaySize.x).toBe(320);
        expect(settings.displaySize.y).toBe(240);
    });

    it('should return the 60 FPS target', () => {
        const settings = defaultHardwareSettings();

        expect(settings.targetFPS).toBe(60);
    });

    it('should not include canvasDisplaySize by default', () => {
        const settings = defaultHardwareSettings();

        expect(settings.canvasDisplaySize).toBeUndefined();
    });

    it('should return a fresh object on each call', () => {
        const a = defaultHardwareSettings();
        const b = defaultHardwareSettings();

        expect(a).not.toBe(b);
        expect(a.displaySize).not.toBe(b.displaySize);
    });
});
