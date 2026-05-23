import { describe, expect, it } from 'vitest';

import { STATS_BAR_HEIGHT, STATS_ROW_GAP_PX } from './constants';
import { createStatsOverlayLayout } from './layoutHelpers';
import {
    buildStatsOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createStatsOverlayLayoutPlanScratch,
} from './layoutPlan';

describe('buildStatsOverlayLayoutPlan', () => {
    it('matches legacy fixed layout for 320x240 with no custom rows', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const config = createDefaultLayoutConfig(320, 240, 14, 0);

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            '[~]',
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        expect(plan.titleBar).toMatchObject({ x: 0, y: 0, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.metricsBar).toMatchObject({ x: 0, y: 14, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.timingTextBar).toMatchObject({ x: 0, y: 28, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.bottomArea).toMatchObject({ x: 0, y: 227, width: 320, height: STATS_BAR_HEIGHT });
        expect(plan.timingChart.height).toBe(0);
    });

    it('stacks custom rows above the bottom band with 1px gaps', () => {
        const layout = createStatsOverlayLayout(320, 240, 14);
        const scratch = createStatsOverlayLayoutPlanScratch();
        const config = createDefaultLayoutConfig(320, 240, 14, 2);

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            '[~]',
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
            '[~]',
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
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 0),
            paletteViewEnabled: true,
            paletteGrid: { cols: 32, rows: 8, swatchSize: 4, totalHeight: 32 },
        };

        const plan = buildStatsOverlayLayoutPlan(
            config,
            scratch,
            '[~]',
            'webgpu | 320x240',
            layout.bottomTextY,
            layout.toggleRect,
        );

        expect(plan.bottomArea).toMatchObject({ y: 208, height: 32, width: 320 });
    });
});
