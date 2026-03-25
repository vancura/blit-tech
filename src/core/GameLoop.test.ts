import { describe, expect, it, vi } from 'vitest';

import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
    // #region Constructor

    describe('constructor', () => {
        it('should accept a valid positive update interval', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());
            expect(loop).toBeDefined();
        });

        it('should throw on zero interval', () => {
            expect(() => new GameLoop(0, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on negative interval', () => {
            expect(() => new GameLoop(-16, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on NaN interval', () => {
            expect(() => new GameLoop(NaN, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on Infinity interval', () => {
            expect(() => new GameLoop(Infinity, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on negative Infinity interval', () => {
            expect(() => new GameLoop(-Infinity, vi.fn(), vi.fn())).toThrow('finite positive number');
        });
    });

    // #endregion

    // #region Public Methods

    describe('getTicks', () => {
        it('should return 0 initially', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());
            expect(loop.getTicks()).toBe(0);
        });
    });

    describe('resetTicks', () => {
        it('should reset tick count to 0', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());
            loop.resetTicks();
            expect(loop.getTicks()).toBe(0);
        });
    });

    describe('stop', () => {
        it('should not throw when called before start', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());
            expect(() => loop.stop()).not.toThrow();
        });
    });

    // #endregion
});
