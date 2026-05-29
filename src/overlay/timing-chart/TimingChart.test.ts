import { describe, expect, it } from 'vitest';

import { Rect2i } from '../../utils/Rect2i';
import { createMockRenderer, getRectFillCalls } from '../testFixtures';
import { TIMING_CHART_FULL_SCALE_MS } from './constants';
import { computeTimingChartBarHeight } from './style';
import { TimingChart } from './TimingChart';

// #region computeTimingChartBarHeight tests

describe('computeTimingChartBarHeight', () => {
    it('maps ms proportionally to chart height and clamps at band bounds', () => {
        expect(computeTimingChartBarHeight(0, 22, TIMING_CHART_FULL_SCALE_MS)).toBe(0);
        expect(computeTimingChartBarHeight(0.1, 22, TIMING_CHART_FULL_SCALE_MS)).toBe(1);
        expect(computeTimingChartBarHeight(8, 22, TIMING_CHART_FULL_SCALE_MS)).toBe(11);
        expect(computeTimingChartBarHeight(32, 22, TIMING_CHART_FULL_SCALE_MS)).toBe(22);
    });
});

// #endregion

// #region TimingChart tests

describe('TimingChart', () => {
    it('does not draw when disabled', () => {
        const chart = new TimingChart(false);
        const renderer = createMockRenderer();

        chart.reset(4);
        chart.sample({ frameMs: 1, updateMs: 2, renderMs: 3, updateSteps: 1, drawCalls: 1 });
        chart.draw(renderer, new Rect2i(0, 14, 4, 22), {
            updateBarIndex: 1,
            renderBarIndex: 2,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
        });

        expect(renderer.drawBarFill).not.toHaveBeenCalled();
    });

    it('wraps ring buffer and keeps newest samples on the right', () => {
        const chart = new TimingChart(true);
        const renderer = createMockRenderer();
        const style = {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
        };
        const chartRect = new Rect2i(0, 0, 3, 22);
        const baselineY = chartRect.y + chartRect.height - 1;

        chart.reset(3);
        chart.sample({ frameMs: 0, updateMs: 4, renderMs: 0, updateSteps: 1, drawCalls: 0 });
        chart.sample({ frameMs: 0, updateMs: 8, renderMs: 0, updateSteps: 1, drawCalls: 0 });
        chart.sample({ frameMs: 0, updateMs: 12, renderMs: 0, updateSteps: 1, drawCalls: 0 });
        chart.sample({ frameMs: 0, updateMs: 16, renderMs: 0, updateSteps: 1, drawCalls: 0 });

        chart.draw(renderer, chartRect, style);

        const updateDotY = (ms: number) =>
            baselineY - computeTimingChartBarHeight(ms, chartRect.height, TIMING_CHART_FULL_SCALE_MS) + 1;

        const updateDots = getRectFillCalls(renderer).filter(
            (rect) => rect.width === 1 && rect.height === 1 && rect.y === updateDotY(8),
        );

        expect(updateDots.some((rect) => rect.x === 0)).toBe(true);
        expect(
            getRectFillCalls(renderer).some(
                (rect) => rect.width === 1 && rect.height === 1 && rect.y === updateDotY(16) && rect.x === 2,
            ),
        ).toBe(true);
    });

    it('draws render dots for sub-millisecond samples', () => {
        const chart = new TimingChart(true);
        const renderer = createMockRenderer();
        const style = {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
        };

        chart.reset(4);
        chart.sample({ frameMs: 0, updateMs: 0, renderMs: 0.1, updateSteps: 1, drawCalls: 1 });
        chart.draw(renderer, new Rect2i(0, 14, 4, 32), style);

        expect(
            renderer.drawBarFill.mock.calls.some(
                (call) =>
                    (call[0] as { width: number; height: number }).width === 1 &&
                    (call[0] as { height: number }).height === 1 &&
                    call[1] === 9,
            ),
        ).toBe(true);
    });

    it('draws update and render dots with distinct palette indices', () => {
        const chart = new TimingChart(true);
        const renderer = createMockRenderer();

        chart.reset(1);
        chart.sample({ frameMs: 0, updateMs: 12, renderMs: 8, updateSteps: 1, drawCalls: 0 });
        chart.draw(renderer, new Rect2i(10, 14, 1, 22), {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
        });

        const dots = getRectFillCalls(renderer).filter((rect) => rect.width === 1 && rect.height === 1);
        const paletteIndices = renderer.drawBarFill.mock.calls
            .filter(
                (call) => (call[0] as { width: number }).width === 1 && (call[0] as { height: number }).height === 1,
            )
            .map((call) => call[1] as number);

        expect(paletteIndices).toContain(8);
        expect(paletteIndices).toContain(9);
        expect(dots).toHaveLength(2);
    });
});

// #endregion
