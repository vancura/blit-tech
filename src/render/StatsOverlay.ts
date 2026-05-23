/**
 * Barrel re-export for the engine stats overlay subsystem.
 *
 * Implementation lives under {@link ./stats-overlay/}; this module preserves
 * the historical import path used by {@link BTAPI}.
 */

export type { StatsOverlayLayout, StatsOverlayTimingSnapshot } from './stats-overlay/index';
export {
    createStatsOverlayLayout,
    isPointerInStatsToggleCorner,
    resolveStatsTopLeftLabel,
    statsBitmapTextPaletteOffset,
    StatsOverlay,
    statsRightAlignedTextX,
} from './stats-overlay/index';
