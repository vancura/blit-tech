/**
 * Unit tests for {@link defaultConfig} exported from {@link IBlitTechDemo}.
 *
 * Confirms the default display resolution, frame rate, and canvas sizing
 * (`defaultConfig()` includes `drawingBufferSize` by default), and verifies each
 * call to {@link defaultConfig} returns fresh objects so demos do not share
 * mutable settings state.
 */

import { describe, expect, it } from 'vitest';

import { validateRenderDimensions } from '../utils/RenderLimits';
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

    it('should include 640x480 drawingBufferSize by default', () => {
        const settings = defaultConfig();

        expect(settings.drawingBufferSize?.x).toBe(640);
        expect(settings.drawingBufferSize?.y).toBe(480);
    });

    it('should include 960x720 maxCanvasSize by default', () => {
        const settings = defaultConfig();

        expect(settings.maxCanvasSize?.x).toBe(960);
        expect(settings.maxCanvasSize?.y).toBe(720);
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

    it('should disable stats overlay palette view by default', () => {
        const settings = defaultConfig();

        expect(settings.statsOverlayPaletteView).toBe(false);
    });

    it('should disable stats overlay timing chart by default', () => {
        const settings = defaultConfig();

        expect(settings.statsOverlayTimingChart).toBe(false);
    });

    it('should return a fresh object on each call', () => {
        const a = defaultConfig();
        const b = defaultConfig();

        expect(a).not.toBe(b);
        expect(a.displaySize).not.toBe(b.displaySize);
        expect(a.drawingBufferSize).not.toBe(b.drawingBufferSize);
        expect(a.maxCanvasSize).not.toBe(b.maxCanvasSize);
    });
});

describe('mergeHardwareSettings', () => {
    it('returns defaultConfig when partial is undefined', () => {
        const settings = mergeHardwareSettings();

        expect(settings.displaySize.x).toBe(320);
        expect(settings.drawingBufferSize?.x).toBe(640);
        expect(settings.targetFPS).toBe(60);
        expect(settings.backend).toBe('webgpu');
    });

    it('merges targetFPS-only partials with full defaults', () => {
        const settings = mergeHardwareSettings({ targetFPS: 30 });

        expect(settings.displaySize.x).toBe(320);
        expect(settings.drawingBufferSize?.x).toBe(640);
        expect(settings.targetFPS).toBe(30);
        expect(settings.statsOverlayPaletteView).toBe(false);
    });

    it('keeps drawingBufferSize unset when displaySize is provided without output sizing', () => {
        const settings = mergeHardwareSettings({
            displaySize: defaultConfig().displaySize,
            targetFPS: 60,
        });

        expect(settings.displaySize.x).toBe(320);
        expect(settings.drawingBufferSize).toBeUndefined();
        expect(settings.targetFPS).toBe(60);
        expect(settings.backend).toBe('webgpu');
    });

    it('applies only provided fields when displaySize is set', () => {
        const settings = mergeHardwareSettings({
            displaySize: new Vector2i(320, 240),
            drawingBufferSize: new Vector2i(640, 480),
            backend: 'software',
        });

        expect(settings.drawingBufferSize?.x).toBe(640);
        expect(settings.backend).toBe('software');
        expect(settings.targetFPS).toBe(60);
        expect(settings.statsOverlayEnabled).toBe(true);
        expect(settings.statsOverlayPaletteView).toBe(false);
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

    it('merges statsOverlayTimingChart flags from configure()', () => {
        const settings = mergeHardwareSettings({
            statsOverlayTimingChart: true,
            statsOverlayTimingChartStyle: {
                updateBarPaletteIndex: 20,
                renderBarPaletteIndex: 21,
                warningPaletteIndex: 22,
            },
        });

        expect(settings.statsOverlayTimingChart).toBe(true);
        expect(settings.statsOverlayTimingChartStyle?.updateBarPaletteIndex).toBe(20);
        expect(settings.statsOverlayTimingChartStyle?.renderBarPaletteIndex).toBe(21);
        expect(settings.statsOverlayTimingChartStyle?.warningPaletteIndex).toBe(22);
    });

    it('merges statsOverlayTimingChartHeight from configure()', () => {
        const settings = mergeHardwareSettings({
            statsOverlayTimingChart: true,
            statsOverlayTimingChartHeight: 36,
        });

        expect(settings.statsOverlayTimingChartHeight).toBe(36);
    });

    it('preserves null displaySize for validation instead of substituting defaults', () => {
        const settings = mergeHardwareSettings({
            displaySize: null as unknown as Vector2i,
        });

        expect(settings.displaySize).toBeNull();
        expect(validateRenderDimensions(settings)).not.toBeNull();
    });

    it('does not clone null optional vectors in the explicit display profile path', () => {
        const settings = mergeHardwareSettings({
            displaySize: new Vector2i(320, 240),
            drawingBufferSize: null as unknown as Vector2i,
        });

        expect(settings.drawingBufferSize).toBeNull();
        expect(validateRenderDimensions(settings)).not.toBeNull();
    });
});
