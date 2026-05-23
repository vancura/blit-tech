/**
 * Unit tests for {@link defaultConfig} exported from {@link IBlitTechDemo}.
 *
 * Confirms the default display resolution, frame rate, and canvas sizing
 * (`defaultConfig()` includes `canvasDisplaySize` by default), and verifies each
 * call to {@link defaultConfig} returns fresh objects so demos do not share
 * mutable settings state.
 */

import { describe, expect, it } from 'vitest';

import { Vector2i } from '../utils/Vector2i';
import { defaultConfig, mergeHardwareSettings } from './IBlitTechDemo';

describe('defaultConfig', () => {
    it('should return 320x240 display size', () => {
        const settings = defaultConfig();

        expect(settings.displaySize.x).toBe(320);
        expect(settings.displaySize.y).toBe(240);
    });

    it('should return the 60 FPS target', () => {
        const settings = defaultConfig();

        expect(settings.targetFPS).toBe(60);
    });

    it('should include 640x480 canvasDisplaySize by default', () => {
        const settings = defaultConfig();

        expect(settings.canvasDisplaySize?.x).toBe(640);
        expect(settings.canvasDisplaySize?.y).toBe(480);
    });

    it('should include 960x720 maxCanvasDisplaySize by default', () => {
        const settings = defaultConfig();

        expect(settings.maxCanvasDisplaySize?.x).toBe(960);
        expect(settings.maxCanvasDisplaySize?.y).toBe(720);
    });

    it("should default outputUpscaleFilter to 'nearest'", () => {
        const settings = defaultConfig();

        expect(settings.outputUpscaleFilter).toBe('nearest');
    });

    it("should default backend to 'webgpu'", () => {
        const settings = defaultConfig();

        expect(settings.backend).toBe('webgpu');
    });

    it('should enable stats overlay by default', () => {
        const settings = defaultConfig();

        expect(settings.statsOverlayEnabled).toBe(true);
    });

    it('should return a fresh object on each call', () => {
        const a = defaultConfig();
        const b = defaultConfig();

        expect(a).not.toBe(b);
        expect(a.displaySize).not.toBe(b.displaySize);
        expect(a.canvasDisplaySize).not.toBe(b.canvasDisplaySize);
        expect(a.maxCanvasDisplaySize).not.toBe(b.maxCanvasDisplaySize);
    });
});

describe('mergeHardwareSettings', () => {
    it('returns defaultConfig when partial is undefined', () => {
        const settings = mergeHardwareSettings();

        expect(settings.displaySize.x).toBe(320);
        expect(settings.canvasDisplaySize?.x).toBe(640);
        expect(settings.targetFPS).toBe(60);
        expect(settings.backend).toBe('webgpu');
    });

    it('merges targetFPS-only partials with full defaults', () => {
        const settings = mergeHardwareSettings({ targetFPS: 30 });

        expect(settings.displaySize.x).toBe(320);
        expect(settings.canvasDisplaySize?.x).toBe(640);
        expect(settings.targetFPS).toBe(30);
    });

    it('keeps canvasDisplaySize unset when displaySize is provided without output sizing', () => {
        const settings = mergeHardwareSettings({
            displaySize: defaultConfig().displaySize,
            targetFPS: 60,
        });

        expect(settings.displaySize.x).toBe(320);
        expect(settings.canvasDisplaySize).toBeUndefined();
        expect(settings.targetFPS).toBe(60);
    });

    it('applies only provided fields when displaySize is set', () => {
        const settings = mergeHardwareSettings({
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            backend: 'software',
        });

        expect(settings.canvasDisplaySize?.x).toBe(640);
        expect(settings.backend).toBe('software');
        expect(settings.targetFPS).toBe(60);
        expect(settings.statsOverlayEnabled).toBe(true);
    });

    it('honors statsOverlayEnabled: false from configure()', () => {
        const settings = mergeHardwareSettings({ statsOverlayEnabled: false });

        expect(settings.statsOverlayEnabled).toBe(false);
    });

    it('merges statsOverlayStyle from configure()', () => {
        const settings = mergeHardwareSettings({
            statsOverlayStyle: { barPaletteIndex: 2, textPaletteIndex: 3 },
        });

        expect(settings.statsOverlayStyle?.barPaletteIndex).toBe(2);
        expect(settings.statsOverlayStyle?.textPaletteIndex).toBe(3);
    });
});
