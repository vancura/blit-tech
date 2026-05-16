/**
 * Unit tests for {@link defaultConfig} exported from {@link IBlitTechDemo}.
 *
 * Confirms the default display resolution, frame rate, and canvas sizing
 * (`defaultConfig()` includes `canvasDisplaySize` by default), and verifies each
 * call to {@link defaultConfig} returns fresh objects so demos do not share
 * mutable settings state.
 */

import { describe, expect, it } from 'vitest';

import { defaultConfig } from './IBlitTechDemo';

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

    it('should return a fresh object on each call', () => {
        const a = defaultConfig();
        const b = defaultConfig();

        expect(a).not.toBe(b);
        expect(a.displaySize).not.toBe(b.displaySize);
        expect(a.canvasDisplaySize).not.toBe(b.canvasDisplaySize);
        expect(a.maxCanvasDisplaySize).not.toBe(b.maxCanvasDisplaySize);
    });
});
