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
} from './layoutHelpers';
export type { StatsOverlayLayoutPlanScratch } from './layoutPlan';
export {
    buildStatsOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createStatsOverlayLayoutPlanScratch,
} from './layoutPlan';
export { StatsOverlay } from './StatsOverlay';
export { StatsOverlayBars } from './StatsOverlayBars';
export { computePaletteGrid, StatsOverlayPaletteView } from './StatsOverlayPaletteView';
export { StatsOverlayTimingChart } from './StatsOverlayTimingChart';
export { StatsOverlayToggle } from './StatsOverlayToggle';
export { TimingSampler } from './TimingSampler';
export type {
    PaletteGridLayout,
    StatsOverlayLayout,
    StatsOverlayLayoutConfig,
    StatsOverlayLayoutPlan,
    StatsOverlayTimingSnapshot,
} from './types';
