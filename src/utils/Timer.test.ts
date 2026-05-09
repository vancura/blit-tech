import { afterEach, describe, expect, it, vi } from 'vitest';

import { BTAPI } from '../core/BTAPI';
import { Timer } from './Timer';

describe('Timer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('stores interval and seeds baseline from current tick', () => {
            vi.spyOn(BTAPI.instance, 'getTicks').mockReturnValue(10);
            const timer = new Timer(30);

            expect(timer.intervalTicks).toBe(30);
            expect(timer.elapsedTicks(10)).toBe(0);
        });

        it('throws when interval is not a positive integer', () => {
            expect(() => new Timer(0)).toThrow('positive integer');
            expect(() => new Timer(-5)).toThrow('positive integer');
            expect(() => new Timer(1.5)).toThrow('positive integer');
        });
    });

    describe('tick', () => {
        it('returns false before interval, true at interval, then resets baseline', () => {
            const timer = new Timer(5);

            expect(timer.tick(4)).toBe(false);
            expect(timer.tick(5)).toBe(true);
            expect(timer.tick(9)).toBe(false);
            expect(timer.tick(10)).toBe(true);
        });

        it('fires once per call when large gaps pass', () => {
            const timer = new Timer(5);

            expect(timer.tick(20)).toBe(true);
            expect(timer.tick(20)).toBe(false);
            expect(timer.elapsedTicks(23)).toBe(3);
        });

        it('uses engine ticks when current tick is omitted', () => {
            const timer = new Timer(3);
            const spy = vi.spyOn(BTAPI.instance, 'getTicks');

            spy.mockReturnValue(2);
            expect(timer.tick()).toBe(false);

            spy.mockReturnValue(3);
            expect(timer.tick()).toBe(true);
        });
    });

    describe('reset and helpers', () => {
        it('resets baseline and reports elapsed and remaining ticks', () => {
            const timer = new Timer(12);

            expect(timer.elapsedTicks(5)).toBe(5);
            expect(timer.remainingTicks(5)).toBe(7);

            timer.reset(4);

            expect(timer.elapsedTicks(10)).toBe(6);
            expect(timer.remainingTicks(10)).toBe(6);
            expect(timer.remainingTicks(20)).toBe(0);
        });
    });
});
