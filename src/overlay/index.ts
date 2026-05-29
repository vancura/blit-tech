/**
 * Overlay subsystem public exports for BTAPI and unit tests.
 */

export type { OverlayBarStyle } from './bars/Bars';
export { OverlayBars } from './bars/Bars';
export { DEFAULT_IDX_BG, DEFAULT_IDX_TEXT, OVERLAY_BOTTOM_HINT_LABEL, SYSTEM_CHAR_ADVANCE } from './constants';
export { Toggle } from './input/Toggle';
export { resolveOverlayTopLeftLabel } from './labels';
export {
    createOverlayLayout,
    customBarY,
    isPointerInOverlayToggleCorner,
    overlayBitmapTextPaletteOffset,
    overlayRightAlignedTextX,
    overlayToggleHintTextWidth,
    overlayToggleHintTextX,
} from './layout/layoutHelpers';
export type { OverlayLayoutPlanScratch } from './layout/layoutPlan';
export {
    buildOverlayLayoutPlan,
    createDefaultLayoutConfig,
    createOverlayLayoutPlanScratch,
    hintBarY,
    paletteBandY,
    resolveOverlayFooterHeight,
} from './layout/layoutPlan';
export type { OverlayLayout, OverlayLayoutConfig, OverlayLayoutPlan } from './layout/types';
export { Overlay } from './Overlay';
export type { OverlayDrawTarget, OverlayRenderer } from './OverlayDrawTarget';
export { PaletteInteraction } from './palette/PaletteInteraction';
export { computePaletteGrid, PaletteView } from './palette/PaletteView';
export { FpsSampler } from './sampling/FpsSampler';
export { TimingSampler } from './sampling/TimingSampler';
export type { ResolvedOverlayTimingChartStyle } from './timing-chart/style';
export { computeTimingChartBarHeight, resolveOverlayTimingChartStyle } from './timing-chart/style';
export type { OverlayTimingChartDrawStyle } from './timing-chart/TimingChart';
export { TimingChart } from './timing-chart/TimingChart';
export type { OverlayTimingSnapshot, PaletteGridLayout } from './types';
