import { describe, expect, it } from 'vitest';

import { Rect2i } from '../../utils/Rect2i';
import { createMockRenderer, getRectFillCalls } from '../testFixtures';
import { TIMING_CHART_FULL_SCALE_MS } from './constants';
import { computeTimingChartBarHeight, computeTimingChartDotY } from './style';
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
        chart.sample({
            frameMs: 1,
            updateMs: 2,
            renderMs: 3,
            updateSteps: 1,
            drawCalls: 1,
            droppedFrames: 0,
        });
        chart.draw(renderer, new Rect2i(0, 14, 4, 22), {
            updateBarIndex: 1,
            renderBarIndex: 2,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
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
            gridBarIndex: 6,
        };
        const chartRect = new Rect2i(0, 0, 3, 22);

        chart.reset(3);
        chart.sample({ frameMs: 0, updateMs: 4, renderMs: 0, updateSteps: 1, drawCalls: 0, droppedFrames: 0 });
        chart.sample({ frameMs: 0, updateMs: 8, renderMs: 0, updateSteps: 1, drawCalls: 0, droppedFrames: 0 });
        chart.sample({ frameMs: 0, updateMs: 12, renderMs: 0, updateSteps: 1, drawCalls: 0, droppedFrames: 0 });
        chart.sample({ frameMs: 0, updateMs: 16, renderMs: 0, updateSteps: 1, drawCalls: 0, droppedFrames: 0 });

        chart.draw(renderer, chartRect, style);

        const updateDotY = (ms: number) => computeTimingChartDotY(ms, chartRect, TIMING_CHART_FULL_SCALE_MS);

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
            gridBarIndex: 6,
        };

        chart.reset(4);
        chart.sample({ frameMs: 0, updateMs: 0, renderMs: 0.1, updateSteps: 1, drawCalls: 1, droppedFrames: 0 });
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
        chart.sample({ frameMs: 0, updateMs: 12, renderMs: 8, updateSteps: 1, drawCalls: 0, droppedFrames: 0 });
        chart.draw(renderer, new Rect2i(10, 14, 1, 22), {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        });

        const dotPaletteIndices = renderer.drawBarFill.mock.calls
            .filter((call) => call[1] === 8 || call[1] === 9)
            .map((call) => call[1] as number);

        expect(dotPaletteIndices).toContain(8);
        expect(dotPaletteIndices).toContain(9);
        expect(dotPaletteIndices).toHaveLength(2);
    });

    it('tints both dots with warning palette when frame is over soft budget', () => {
        const chart = new TimingChart(true, 60);
        const renderer = createMockRenderer();
        const style = {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        };

        chart.reset(1);
        chart.sample({
            frameMs: 20,
            updateMs: 12,
            renderMs: 8,
            updateSteps: 1,
            drawCalls: 0,
            droppedFrames: 0,
        });
        chart.draw(renderer, new Rect2i(0, 14, 1, 22), style);

        const dotPaletteIndices = renderer.drawBarFill.mock.calls
            .filter((call) => call[1] === 3)
            .map((call) => call[1] as number);

        expect(dotPaletteIndices.length).toBeGreaterThanOrEqual(2);
        expect(renderer.drawBarFill.mock.calls.some((call) => call[1] === 8)).toBe(false);
        expect(renderer.drawBarFill.mock.calls.some((call) => call[1] === 9)).toBe(false);
    });

    it('tints with error palette when two or more frames were dropped', () => {
        const chart = new TimingChart(true, 60);
        const renderer = createMockRenderer();

        chart.reset(1);
        chart.sample({
            frameMs: 0,
            updateMs: 0,
            renderMs: 0,
            updateSteps: 1,
            drawCalls: 0,
            droppedFrames: 2,
        });
        chart.draw(renderer, new Rect2i(0, 14, 1, 22), {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        });

        const severityCalls = renderer.drawBarFill.mock.calls.filter((call) => call[1] === 4);

        expect(severityCalls.length).toBeGreaterThanOrEqual(1);
        expect(renderer.drawBarFill.mock.calls.every((call) => call[1] === 4 || call[1] === 6)).toBe(true);
    });

    it('draws a baseline error marker when drop severity is active with zero timing samples', () => {
        const chart = new TimingChart(true, 60);
        const renderer = createMockRenderer();
        const chartRect = new Rect2i(5, 14, 1, 22);
        const baselineY = chartRect.y + chartRect.height - 1;

        chart.reset(1);
        chart.sample({
            frameMs: 0,
            updateMs: 0,
            renderMs: 0,
            updateSteps: 0,
            drawCalls: 0,
            droppedFrames: 1,
        });
        chart.draw(renderer, chartRect, {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        });

        expect(renderer.drawBarFill).toHaveBeenCalledWith(expect.objectContaining({ x: 5, y: baselineY }), 3);
    });

    it('draws full-width grid lines before dots when enabled', () => {
        const chart = new TimingChart(true, 60);
        const renderer = createMockRenderer();
        const chartRect = new Rect2i(10, 14, 8, 22);
        const style = {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        };

        chart.reset(chartRect.width);
        chart.sample({ frameMs: 0, updateMs: 12, renderMs: 8, updateSteps: 1, drawCalls: 0, droppedFrames: 0 });
        chart.draw(renderer, chartRect, style);

        const mockCalls = renderer.drawBarFill.mock.calls;
        const firstDotIndex = mockCalls.findIndex(
            (call) => call[1] === style.updateBarIndex || call[1] === style.renderBarIndex,
        );
        const lastGridIndex = mockCalls.reduce((last, call, index) => (call[1] === 6 ? index : last), -1);

        expect(lastGridIndex).toBeGreaterThanOrEqual(0);
        expect(firstDotIndex).toBeGreaterThanOrEqual(0);
        expect(lastGridIndex).toBeLessThan(firstDotIndex);
    });

    it('omits grid lines on top and bottom band rows', () => {
        const chart = new TimingChart(true, 60);
        const renderer = createMockRenderer();
        const chartRect = new Rect2i(0, 14, 4, 22);

        chart.reset(chartRect.width);
        chart.draw(renderer, chartRect, {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        });

        expect(renderer.drawBarFill.mock.calls.filter((call) => call[1] === 6)).toHaveLength(2);
    });

    it('draws grid lines even when the ring buffer has no samples yet', () => {
        const chart = new TimingChart(true, 60);
        const renderer = createMockRenderer();
        const chartRect = new Rect2i(0, 14, 4, 22);

        chart.reset(4);
        chart.draw(renderer, chartRect, {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        });

        const gridCallCount = renderer.drawBarFill.mock.calls.filter((call) => call[1] === 6).length;

        expect(gridCallCount).toBeGreaterThan(0);
    });

    it('does not draw grid lines when disabled', () => {
        const chart = new TimingChart(false, 60);
        const renderer = createMockRenderer();

        chart.reset(4);
        chart.draw(renderer, new Rect2i(0, 14, 4, 22), {
            updateBarIndex: 8,
            renderBarIndex: 9,
            warningBarIndex: 3,
            errorBarIndex: 4,
            eventBarIndex: 5,
            gridBarIndex: 6,
        });

        expect(renderer.drawBarFill).not.toHaveBeenCalled();
    });
});

// #endregion
