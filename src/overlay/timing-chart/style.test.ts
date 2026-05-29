import { describe, expect, it } from 'vitest';

import {
    TIMING_CHART_DEFAULT_ERROR_IDX,
    TIMING_CHART_DEFAULT_EVENT_IDX,
    TIMING_CHART_DEFAULT_WARNING_IDX,
    TIMING_CHART_FULL_SCALE_MS,
} from './constants';
import { computeTimingChartBarHeight, resolveOverlayTimingChartStyle } from './style';

describe('computeTimingChartBarHeight', () => {
    const chartHeight = 22;

    it('returns 0 for non-positive samples and invalid scale inputs', () => {
        expect(computeTimingChartBarHeight(-5, chartHeight, TIMING_CHART_FULL_SCALE_MS)).toBe(0);
        expect(computeTimingChartBarHeight(0, chartHeight, TIMING_CHART_FULL_SCALE_MS)).toBe(0);
        expect(computeTimingChartBarHeight(5, 0, TIMING_CHART_FULL_SCALE_MS)).toBe(0);
        expect(computeTimingChartBarHeight(5, chartHeight, 0)).toBe(0);
    });

    it('draws at least 1 px for sub-millisecond samples and clamps at band height', () => {
        expect(computeTimingChartBarHeight(0.1, chartHeight, TIMING_CHART_FULL_SCALE_MS)).toBe(1);
        expect(computeTimingChartBarHeight(999, chartHeight, TIMING_CHART_FULL_SCALE_MS)).toBe(chartHeight);
    });
});

describe('resolveOverlayTimingChartStyle', () => {
    it('defaults update/render bars to overlay style indices', () => {
        const resolved = resolveOverlayTimingChartStyle({ barPaletteIndex: 10, textPaletteIndex: 11 }, undefined);

        expect(resolved.updateBarIndex).toBe(10);
        expect(resolved.renderBarIndex).toBe(11);
        expect(resolved.warningBarIndex).toBe(TIMING_CHART_DEFAULT_WARNING_IDX);
        expect(resolved.errorBarIndex).toBe(TIMING_CHART_DEFAULT_ERROR_IDX);
        expect(resolved.eventBarIndex).toBe(TIMING_CHART_DEFAULT_EVENT_IDX);
    });

    it('honors timing chart palette overrides', () => {
        const resolved = resolveOverlayTimingChartStyle(
            { barPaletteIndex: 1, textPaletteIndex: 2 },
            {
                updateBarPaletteIndex: 20,
                renderBarPaletteIndex: 21,
                warningPaletteIndex: 22,
                errorPaletteIndex: 23,
                eventPaletteIndex: 24,
            },
        );

        expect(resolved.updateBarIndex).toBe(20);
        expect(resolved.renderBarIndex).toBe(21);
        expect(resolved.warningBarIndex).toBe(22);
        expect(resolved.errorBarIndex).toBe(23);
        expect(resolved.eventBarIndex).toBe(24);
    });
});
