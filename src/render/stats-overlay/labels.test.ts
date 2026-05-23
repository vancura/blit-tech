import { describe, expect, it } from 'vitest';

import { resolveStatsTopLeftLabel } from './labels';

describe('resolveStatsTopLeftLabel', () => {
    it('formats registry-style page titles without a Blit-Tech prefix', () => {
        expect(resolveStatsTopLeftLabel('Blit-Tech Demo 006 - Patterns')).toBe('Patterns Demo');
        expect(resolveStatsTopLeftLabel('Blit-Tech Demo 002 - Primitives')).toBe('Primitives Demo');
    });

    it('falls back when title is empty', () => {
        expect(resolveStatsTopLeftLabel('')).toBe('Demo');
        expect(resolveStatsTopLeftLabel(undefined)).toBe('Demo');
    });

    it('passes through non-registry titles unchanged', () => {
        expect(resolveStatsTopLeftLabel('Custom Page')).toBe('Custom Page');
    });
});
