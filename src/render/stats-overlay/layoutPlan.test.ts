import { describe, expect, it } from 'vitest';

import { STATS_BAR_HEIGHT, STATS_ROW_GAP_PX } from './constants';
import { createStatsOverlayLayout } from './layoutHelpers';
import {
    buildStatsOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createStatsOverlayLayoutPlanScratch,
    hintBarY,
    paletteBandY,
    resolveStatsOverlayFooterHeight,
} from './layoutPlan';
import { computePaletteGrid } from './StatsOverlayPaletteView';

describe('buildStatsOverlayLayoutPlan', () => {
    it('matches legacy fixed layout for 320x240 with no custom rows', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const config = createDefaultLayoutConfig(320, 240, 14, 0);

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        expect(plan.titleBar).toMatchObject({ x: 0, y: 0, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.metricsBar).toMatchObject({ x: 0, y: 14, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.timingTextBar).toMatchObject({ x: 0, y: 28, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.paletteBand).toMatchObject({ x: 0, y: hintBarY(240), width: 320, height: 0 });
        expect(plan.hintBar).toMatchObject({ x: 0, y: hintBarY(240), width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.timingChart.height).toBe(0);
    });

    it('stacks custom rows above the bottom band with 1px gaps', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const config = createDefaultLayoutConfig(320, 240, 14, 2);

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        const row0 = plan.customBars[0];
        const row1 = plan.customBars[1];

        expect(row0).toMatchObject({ y: 213, width: 320, height: STATS_BAR_HEIGHT });
        expect(row1).toMatchObject({ y: 199, width: 320, height: STATS_BAR_HEIGHT });
        expect(row0?.y).toBeDefined();
        expect(row1?.y).toBeDefined();
        expect((row0?.y ?? 0) - (row1?.y ?? 0)).toBe(STATS_BAR_HEIGHT + STATS_ROW_GAP_PX);
    });

    it('inserts timing chart band when enabled', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 0),
            timingChartEnabled: true,
            timingChartHeight: 22,
        };

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        expect(plan.timingChart).toMatchObject({ x: 0, y: 14, width: 320, height: 22 });
        expect(plan.metricsBar.y).toBe(14 + 22 + STATS_ROW_GAP_PX);
    });

    it('uses variable bottom height when palette grid is enabled', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const paletteGrid = computePaletteGrid(320, 4, 256, 1);
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 0),
            statsOverlayPaletteView: true,
            paletteGrid,
        };

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        expect(plan.paletteBand).toMatchObject({
            y: paletteBandY(240, paletteGrid.totalHeight),
            height: paletteGrid.totalHeight,
            width: 320,
        });
        expect(plan.hintBar).toMatchObject({
            y: hintBarY(240),
            height: STATS_BAR_HEIGHT,
            width: 320,
        });
    });

    it('stacks custom rows above a palette grid bottom band', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const paletteGrid = computePaletteGrid(320, 4, 256, 1);
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 1),
            statsOverlayPaletteView: true,
            paletteGrid,
        };

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        expect(plan.customBars[0]).toMatchObject({
            y: plan.paletteBand.y - (STATS_BAR_HEIGHT + STATS_ROW_GAP_PX),
            width: 320,
            height: STATS_BAR_HEIGHT,
        });
    });

    it('resolveStatsOverlayFooterHeight reserves hint bar or palette plus gap plus hint', () => {
        const paletteGrid = computePaletteGrid(320, 4, 256, 1);
        const hintOnlyConfig = createDefaultLayoutConfig(320, 240, 14, 0);
        const paletteConfig = {
            ...hintOnlyConfig,
            statsOverlayPaletteView: true,
            paletteGrid,
        };

        expect(resolveStatsOverlayFooterHeight(hintOnlyConfig)).toBe(STATS_BAR_HEIGHT);
        expect(resolveStatsOverlayFooterHeight(paletteConfig)).toBe(
            paletteGrid.totalHeight + STATS_ROW_GAP_PX + STATS_BAR_HEIGHT,
        );
    });
});
