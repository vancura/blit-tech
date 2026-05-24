import { describe, expect, it } from 'vitest';

import {
    TIMING_CHART_DEFAULT_ERROR_IDX,
    TIMING_CHART_DEFAULT_EVENT_IDX,
    TIMING_CHART_DEFAULT_WARNING_IDX,
} from './constants';
import { resolveStatsOverlayTimingChartStyle } from './timingChartStyle';

describe('resolveStatsOverlayTimingChartStyle', () => {
    it('defaults update/render bars to overlay style indices', () => {
        const resolved = resolveStatsOverlayTimingChartStyle({ barPaletteIndex: 10, textPaletteIndex: 11 }, undefined);

        expect(resolved.updateBarIndex).toBe(10);
        expect(resolved.renderBarIndex).toBe(11);
        expect(resolved.warningBarIndex).toBe(TIMING_CHART_DEFAULT_WARNING_IDX);
        expect(resolved.errorBarIndex).toBe(TIMING_CHART_DEFAULT_ERROR_IDX);
        expect(resolved.eventBarIndex).toBe(TIMING_CHART_DEFAULT_EVENT_IDX);
    });

    it('honors timing chart palette overrides', () => {
        const resolved = resolveStatsOverlayTimingChartStyle(
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
