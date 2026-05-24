/**
 * Stats overlay subsystem public exports for BTAPI and unit tests.
 */

export { FpsSampler } from './FpsSampler';
export { resolveStatsTopLeftLabel } from './labels';
export {
    createStatsOverlayLayout,
    customBarY,
    isPointerInStatsToggleCorner,
    statsBitmapTextPaletteOffset,
    statsRightAlignedTextX,
    statsToggleHintTextX,
} from './layoutHelpers';
export type { StatsOverlayLayoutPlanScratch } from './layoutPlan';
export {
    buildStatsOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createStatsOverlayLayoutPlanScratch,
    hintBarY,
    paletteBandY,
    resolveStatsOverlayFooterHeight,
} from './layoutPlan';
export { StatsOverlay } from './StatsOverlay';
export { StatsOverlayBars } from './StatsOverlayBars';
export { computePaletteGrid, StatsOverlayPaletteView } from './StatsOverlayPaletteView';
export type { StatsOverlayTimingChartDrawStyle } from './StatsOverlayTimingChart';
export { StatsOverlayTimingChart } from './StatsOverlayTimingChart';
export { StatsOverlayToggle } from './StatsOverlayToggle';
export type { ResolvedStatsOverlayTimingChartStyle } from './timingChartStyle';
export { computeTimingChartBarHeight, resolveStatsOverlayTimingChartStyle } from './timingChartStyle';
export { TimingSampler } from './TimingSampler';
export type {
    PaletteGridLayout,
    StatsOverlayLayout,
    StatsOverlayLayoutConfig,
    StatsOverlayLayoutPlan,
    StatsOverlayTimingSnapshot,
} from './types';
