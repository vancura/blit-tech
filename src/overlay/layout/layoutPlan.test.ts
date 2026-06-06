import { describe, expect, it } from 'vitest';

import { computeGrid } from '../palette/PaletteView';
import { OVERLAY_BAR_HEIGHT, OVERLAY_ROW_GAP_PX } from './constants';
import { createOverlayLayout } from './layoutHelpers';
import {
    buildOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createOverlayLayoutPlanScratch,
    hintBarY,
    paletteBandY,
    resolveOverlayFooterHeight,
} from './layoutPlan';

describe('buildOverlayLayoutPlan', () => {
    it('matches legacy fixed layout for 320x240 with no custom rows', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const scratch = createOverlayLayoutPlanScratch();
        const config = createDefaultLayoutConfig(320, 240, 14, 0);

        const plan = buildOverlayLayoutPlan(config, scratch, 'webgpu | 320x240', layout.toggleRect);

        expect(plan.titleBar).toMatchObject({ x: 0, y: 0, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(plan.metricsBar).toMatchObject({ x: 0, y: 14, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(plan.timingTextBar).toMatchObject({ x: 0, y: 28, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(plan.paletteBand).toMatchObject({ x: 0, y: hintBarY(240), width: 320, height: 0 });
        expect(plan.hintBar).toMatchObject({ x: 0, y: hintBarY(240), width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(plan.timingChart.height).toBe(0);
        expect(plan.rowGapRects).toHaveLength(2);
        expect(plan.rowGapRects[0]).toMatchObject({ y: 13, width: 320, height: OVERLAY_ROW_GAP_PX });
        expect(plan.rowGapRects[1]).toMatchObject({ y: 27, width: 320, height: OVERLAY_ROW_GAP_PX });
        expect(plan.topClusterSeparator).toMatchObject({ y: 41, width: 320, height: OVERLAY_ROW_GAP_PX });
        expect(plan.bottomClusterSeparator).toMatchObject({
            y: hintBarY(240) - OVERLAY_ROW_GAP_PX,
            width: 320,
            height: OVERLAY_ROW_GAP_PX,
        });
    });

    it('stacks custom rows above the bottom band with 1px gaps', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const scratch = createOverlayLayoutPlanScratch();
        const config = createDefaultLayoutConfig(320, 240, 14, 2);

        const plan = buildOverlayLayoutPlan(config, scratch, 'webgpu | 320x240', layout.toggleRect);

        const row0 = plan.customBars[0];
        const row1 = plan.customBars[1];

        expect(row0).toMatchObject({ y: 213, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(row1).toMatchObject({ y: 199, width: 320, height: OVERLAY_BAR_HEIGHT });
        expect(row0?.y).toBeDefined();
        expect(row1?.y).toBeDefined();
        expect((row0?.y ?? 0) - (row1?.y ?? 0)).toBe(OVERLAY_BAR_HEIGHT + OVERLAY_ROW_GAP_PX);
        expect(plan.rowGapRects).toHaveLength(4);
        expect(plan.bottomClusterSeparator).toMatchObject({ y: 198, width: 320, height: OVERLAY_ROW_GAP_PX });
    });

    it('inserts timing chart band when enabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const scratch = createOverlayLayoutPlanScratch();
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 0),
            isOverlayTimingChartEnabled: true,
            timingChartHeight: 22,
        };

        const plan = buildOverlayLayoutPlan(config, scratch, 'webgpu | 320x240', layout.toggleRect);

        expect(plan.timingChart).toMatchObject({ x: 0, y: 14, width: 320, height: 22 });
        expect(plan.metricsBar.y).toBe(14 + 22 + OVERLAY_ROW_GAP_PX);
    });

    it('inserts renderer diagnostics bar below timing text when enabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const scratch = createOverlayLayoutPlanScratch();
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 0),
            isOverlayRendererDiagnosticsBarEnabled: true,
        };

        const plan = buildOverlayLayoutPlan(config, scratch, 'webgpu | 320x240', layout.toggleRect);

        expect(plan.rendererDiagnosticsBar).toMatchObject({
            x: 0,
            y: 28 + OVERLAY_BAR_HEIGHT + OVERLAY_ROW_GAP_PX,
            width: 320,
            height: OVERLAY_BAR_HEIGHT,
        });
        expect(plan.topClusterSeparator.y).toBe(plan.rendererDiagnosticsBar.y + OVERLAY_BAR_HEIGHT);
    });

    it('uses variable bottom height when palette grid is enabled', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const scratch = createOverlayLayoutPlanScratch();
        const paletteGrid = computeGrid(320, 4, 256, 1);
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 0),
            isOverlayPaletteEnabled: true,
            paletteGrid,
        };

        const plan = buildOverlayLayoutPlan(config, scratch, 'webgpu | 320x240', layout.toggleRect);

        expect(plan.paletteBand).toMatchObject({
            y: paletteBandY(240, paletteGrid.totalHeight),
            height: paletteGrid.totalHeight,
            width: 320,
        });
        expect(plan.hintBar).toMatchObject({
            y: hintBarY(240),
            height: OVERLAY_BAR_HEIGHT,
            width: 320,
        });
    });

    it('stacks custom rows above a palette grid bottom band', () => {
        const layout = createOverlayLayout(320, 240, 14);
        const scratch = createOverlayLayoutPlanScratch();
        const paletteGrid = computeGrid(320, 4, 256, 1);
        const config = {
            ...createDefaultLayoutConfig(320, 240, 14, 1),
            isOverlayPaletteEnabled: true,
            paletteGrid,
        };

        const plan = buildOverlayLayoutPlan(config, scratch, 'webgpu | 320x240', layout.toggleRect);

        expect(plan.customBars[0]).toMatchObject({
            y: plan.paletteBand.y - (OVERLAY_BAR_HEIGHT + OVERLAY_ROW_GAP_PX),
            width: 320,
            height: OVERLAY_BAR_HEIGHT,
        });
    });

    it('resolveOverlayFooterHeight reserves hint bar or palette plus gap plus hint', () => {
        const paletteGrid = computeGrid(320, 4, 256, 1);
        const cappedGrid = computeGrid(320, 4, 256, 1, undefined, 3);
        const hintOnlyConfig = createDefaultLayoutConfig(320, 240, 14, 0);
        const paletteConfig = {
            ...hintOnlyConfig,
            isOverlayPaletteEnabled: true,
            paletteGrid,
        };
        const cappedPaletteConfig = {
            ...hintOnlyConfig,
            isOverlayPaletteEnabled: true,
            paletteGrid: cappedGrid,
        };

        expect(resolveOverlayFooterHeight(hintOnlyConfig)).toBe(OVERLAY_BAR_HEIGHT);
        expect(resolveOverlayFooterHeight(paletteConfig)).toBe(
            paletteGrid.totalHeight + OVERLAY_ROW_GAP_PX + OVERLAY_BAR_HEIGHT,
        );
        expect(resolveOverlayFooterHeight(cappedPaletteConfig)).toBe(
            cappedGrid.totalHeight + OVERLAY_ROW_GAP_PX + OVERLAY_BAR_HEIGHT,
        );
        expect(cappedGrid.totalHeight).toBeLessThan(paletteGrid.totalHeight);
    });
});
