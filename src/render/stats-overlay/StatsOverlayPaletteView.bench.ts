// #region Imports

import { bench, describe } from 'vitest';

import { Palette } from '../../assets/Palette';
import { resetRenderPaletteUsage } from '../../core/RenderPaletteUsage';
import { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import { createStatsOverlayLayout } from './layoutHelpers';
import { computePaletteGrid, StatsOverlayPaletteView } from './StatsOverlayPaletteView';

// #endregion

// #region Constants

const BENCH_OPTIONS = {
    iterations: 100,
    time: 100,
    warmupTime: 25,
    warmupIterations: 25,
};

// #endregion

// #region Fixtures

const layout16 = createStatsOverlayLayout(320, 240, 14);
const grid16 = computePaletteGrid(320, undefined, 16);
const palette16 = new Palette(16);
const usedMask16 = new Uint8Array(256);
const bottomArea16 = new Rect2i(0, 200, 320, 40);

const layout256 = createStatsOverlayLayout(320, 240, 14);
const grid256 = computePaletteGrid(320, undefined, 256);
const palette256 = new Palette(256);
const usedMask256 = new Uint8Array(256);
const bottomArea256 = new Rect2i(0, 120, 320, 120);

const paletteView = new StatsOverlayPaletteView(true);

const noopRenderer = {
    drawRectFillOnTop: () => {},
    getCameraOffset: () => new Vector2i(0, 0),
    resetCamera: () => {},
};

// #endregion

describe('StatsOverlayPaletteView.draw', () => {
    bench(
        '16-slot palette grid',
        () => {
            resetRenderPaletteUsage(usedMask16);
            paletteView.draw(
                noopRenderer as never,
                bottomArea16,
                palette16,
                grid16,
                layout16.bottomTextY,
                layout16.displayWidth,
                layout16.lineHeight,
                usedMask16,
                1,
            );
        },
        BENCH_OPTIONS,
    );

    bench(
        '256-slot palette grid',
        () => {
            resetRenderPaletteUsage(usedMask256);
            paletteView.draw(
                noopRenderer as never,
                bottomArea256,
                palette256,
                grid256,
                layout256.bottomTextY,
                layout256.displayWidth,
                layout256.lineHeight,
                usedMask256,
                1,
            );
        },
        BENCH_OPTIONS,
    );
});
