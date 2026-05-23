/**
 * Unit tests for per-frame palette usage tracking helpers.
 */

import { describe, expect, it } from 'vitest';

import {
    collectUsedRenderPaletteIndices,
    markRenderPaletteIndexUsed,
    resetRenderPaletteUsage,
} from './RenderPaletteUsage';

describe('RenderPaletteUsage', () => {
    it('collects sorted used indices and skips transparent slot 0', () => {
        const mask = new Uint8Array(256);
        const scratch: number[] = [];

        markRenderPaletteIndexUsed(mask, 0);
        markRenderPaletteIndexUsed(mask, 3);
        markRenderPaletteIndexUsed(mask, 1);
        markRenderPaletteIndexUsed(mask, 7);

        expect(collectUsedRenderPaletteIndices(mask, 16, scratch)).toEqual([1, 3, 7]);
    });

    it('reset clears prior marks', () => {
        const mask = new Uint8Array(256);
        const scratch: number[] = [];

        markRenderPaletteIndexUsed(mask, 2);
        resetRenderPaletteUsage(mask);

        expect(collectUsedRenderPaletteIndices(mask, 16, scratch)).toEqual([]);
    });

    it('ignores invalid and out-of-range indices', () => {
        const mask = new Uint8Array(256);
        const scratch: number[] = [];

        markRenderPaletteIndexUsed(mask, -1);
        markRenderPaletteIndexUsed(mask, 256);
        markRenderPaletteIndexUsed(mask, 300);
        markRenderPaletteIndexUsed(mask, 1.5);

        expect(collectUsedRenderPaletteIndices(mask, 16, scratch)).toEqual([]);
    });

    it('collects only valid indices when mixed with invalid values', () => {
        const mask = new Uint8Array(256);
        const scratch: number[] = [];

        markRenderPaletteIndexUsed(mask, -1);
        markRenderPaletteIndexUsed(mask, 5);
        markRenderPaletteIndexUsed(mask, 256);

        expect(collectUsedRenderPaletteIndices(mask, 16, scratch)).toEqual([5]);
    });
});
