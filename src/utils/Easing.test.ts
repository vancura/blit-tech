import { describe, expect, it } from 'vitest';

import type { EasingFunction } from './Easing';
import { applyEasing } from './Easing';

describe('applyEasing', () => {
    const allEasings: EasingFunction[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

    describe('boundary values', () => {
        for (const easing of allEasings) {
            it(`${easing}: f(0) === 0`, () => {
                expect(applyEasing(0, easing)).toBe(0);
            });

            it(`${easing}: f(1) === 1`, () => {
                expect(applyEasing(1, easing)).toBe(1);
            });
        }
    });

    describe('linear', () => {
        it('returns input unchanged', () => {
            expect(applyEasing(0.25, 'linear')).toBe(0.25);
            expect(applyEasing(0.5, 'linear')).toBe(0.5);
            expect(applyEasing(0.75, 'linear')).toBe(0.75);
        });
    });

    describe('ease-in (quadratic)', () => {
        it('starts slow (value below linear)', () => {
            expect(applyEasing(0.5, 'ease-in')).toBe(0.25);
        });

        it('is monotonically increasing', () => {
            let prev = 0;

            for (let t = 0.1; t <= 1.0; t += 0.1) {
                const val = applyEasing(t, 'ease-in');

                expect(val).toBeGreaterThan(prev);

                prev = val;
            }
        });
    });

    describe('ease-out (quadratic)', () => {
        it('starts fast (value above linear)', () => {
            expect(applyEasing(0.5, 'ease-out')).toBe(0.75);
        });

        it('is monotonically increasing', () => {
            let prev = 0;

            for (let t = 0.1; t <= 1.0; t += 0.1) {
                const val = applyEasing(t, 'ease-out');

                expect(val).toBeGreaterThan(prev);

                prev = val;
            }
        });
    });

    describe('ease-in-out', () => {
        it('passes through 0.5 at t=0.5', () => {
            expect(applyEasing(0.5, 'ease-in-out')).toBe(0.5);
        });

        it('is below linear in first half', () => {
            expect(applyEasing(0.25, 'ease-in-out')).toBeLessThan(0.25);
        });

        it('is above linear in second half', () => {
            expect(applyEasing(0.75, 'ease-in-out')).toBeGreaterThan(0.75);
        });

        it('is monotonically increasing', () => {
            let prev = 0;

            for (let t = 0.1; t <= 1.0; t += 0.1) {
                const val = applyEasing(t, 'ease-in-out');

                expect(val).toBeGreaterThan(prev);

                prev = val;
            }
        });
    });
});
