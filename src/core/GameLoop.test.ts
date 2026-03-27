/**
 * Unit tests for {@link GameLoop}.
 *
 * Verifies the fixed-timestep loop contract:
 * - constructor validation for invalid update intervals
 * - public tick-counter and stop behavior
 * - start-up scheduling through `requestAnimationFrame`
 * - internal tick processing, including multiple updates per frame
 * - accumulator clamping to avoid runaway catch-up work
 *
 * Private frame-advance behavior is exercised through a narrow type cast so
 * the suite can validate timing semantics without changing production APIs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
    // #region Constructor

    describe('constructor', () => {
        it('should accept a valid positive update interval', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());

            expect(loop).toBeDefined();
        });

        it('should throw on a zero interval', () => {
            expect(() => new GameLoop(0, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on a negative interval', () => {
            expect(() => new GameLoop(-16, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on NaN interval', () => {
            expect(() => new GameLoop(NaN, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on an Infinity interval', () => {
            expect(() => new GameLoop(Infinity, vi.fn(), vi.fn())).toThrow('finite positive number');
        });

        it('should throw on a negative Infinity interval', () => {
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

            (loop as unknown as { ticks: number }).ticks = 5;

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

    // #region start

    describe('start', () => {
        beforeEach(() => {
            vi.stubGlobal('requestAnimationFrame', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should call requestAnimationFrame when started', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());

            loop.start();

            expect(requestAnimationFrame).toHaveBeenCalledOnce();
        });

        it('should not call requestAnimationFrame again if already running', () => {
            const loop = new GameLoop(16.67, vi.fn(), vi.fn());

            loop.start();

            const callsBefore = (requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length;

            loop.start();

            expect((requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
        });
    });

    // #endregion

    // #region tick (private)

    describe('tick (via type cast)', () => {
        type PrivateLoop = {
            tick: (currentTime: number) => void;
            isRunning: boolean;
            lastUpdateTime: number;
            accumulator: number;
        };

        beforeEach(() => {
            vi.stubGlobal('requestAnimationFrame', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should do nothing when isRunning is false', () => {
            const onUpdate = vi.fn();
            const onRender = vi.fn();
            const loop = new GameLoop(16.67, onUpdate, onRender);

            (loop as unknown as PrivateLoop).tick(100);

            expect(onUpdate).not.toHaveBeenCalled();
            expect(onRender).not.toHaveBeenCalled();
        });

        it('should call onUpdate and onRender when running', () => {
            const onUpdate = vi.fn();
            const onRender = vi.fn();
            const loop = new GameLoop(10, onUpdate, onRender);
            const p = loop as unknown as PrivateLoop;

            p.isRunning = true;
            p.lastUpdateTime = 0;
            p.tick(20); // 20ms delta at 10ms interval = 2 update steps

            expect(onUpdate).toHaveBeenCalledTimes(2);
            expect(onRender).toHaveBeenCalledOnce();
        });

        it('should clamp accumulator to prevent spiral-of-death', () => {
            const onUpdate = vi.fn();
            const loop = new GameLoop(10, onUpdate, vi.fn());
            const p = loop as unknown as PrivateLoop;

            p.isRunning = true;
            p.lastUpdateTime = 0;
            p.tick(10000); // huge pause — MAX_STEPS = 8 caps at 8 updates

            expect(onUpdate).toHaveBeenCalledTimes(8);
        });

        it('should call onRender exactly once per frame regardless of update step count', () => {
            const onRender = vi.fn();
            const loop = new GameLoop(10, vi.fn(), onRender);
            const p = loop as unknown as PrivateLoop;

            p.isRunning = true;
            p.lastUpdateTime = 0;
            p.tick(10000); // many steps, but one render

            expect(onRender).toHaveBeenCalledOnce();
        });

        it('should increment tick count by the number of update steps', () => {
            const loop = new GameLoop(10, vi.fn(), vi.fn());
            const p = loop as unknown as PrivateLoop;

            p.isRunning = true;
            p.lastUpdateTime = 0;
            p.tick(30); // 30ms at 10ms interval = 3 steps

            expect(loop.getTicks()).toBe(3);
        });

        it('should schedule the next frame via requestAnimationFrame', () => {
            const loop = new GameLoop(10, vi.fn(), vi.fn());
            const p = loop as unknown as PrivateLoop;

            p.isRunning = true;
            p.lastUpdateTime = 0;
            p.tick(10);

            expect(requestAnimationFrame).toHaveBeenCalled();
        });
    });

    // #endregion
});
