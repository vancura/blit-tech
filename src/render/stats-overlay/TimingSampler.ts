import { FPS_SMOOTHING } from './constants';
import type { StatsOverlayTimingSnapshot } from './types';

/**
 * Exponentially smoothed overlay timings sourced from {@link StatsOverlayTimingSnapshot}.
 */
export class TimingSampler {
    #hasSample = false;

    #smoothedFrameMs = 0;

    #smoothedUpdateMs = 0;

    #smoothedRenderMs = 0;

    #updateSteps = 0;

    #drawCalls = 0;

    /**
     * Ingests one frame-timing snapshot.
     *
     * @param sample - Current-frame timing values from BTAPI.
     */
    sample(sample: StatsOverlayTimingSnapshot): void {
        const frameMs = Math.max(0, sample.frameMs);
        const updateMs = Math.max(0, sample.updateMs);
        const renderMs = Math.max(0, sample.renderMs);

        if (!this.#hasSample) {
            this.#smoothedFrameMs = frameMs;
            this.#smoothedUpdateMs = updateMs;
            this.#smoothedRenderMs = renderMs;
            this.#hasSample = true;
        } else {
            this.#smoothedFrameMs += (frameMs - this.#smoothedFrameMs) * FPS_SMOOTHING;
            this.#smoothedUpdateMs += (updateMs - this.#smoothedUpdateMs) * FPS_SMOOTHING;
            this.#smoothedRenderMs += (renderMs - this.#smoothedRenderMs) * FPS_SMOOTHING;
        }

        this.#updateSteps = Math.max(0, Math.floor(sample.updateSteps));
        this.#drawCalls = Math.max(0, Math.floor(sample.drawCalls));
    }

    /**
     * Smoothed full-frame CPU time in milliseconds.
     *
     * @returns Smoothed frame time.
     */
    get frameMs(): number {
        return this.#smoothedFrameMs;
    }

    /**
     * Smoothed update-loop CPU time in milliseconds.
     *
     * @returns Smoothed update time.
     */
    get updateMs(): number {
        return this.#smoothedUpdateMs;
    }

    /**
     * Smoothed demo render CPU time in milliseconds.
     *
     * @returns Smoothed demo render time.
     */
    get renderMs(): number {
        return this.#smoothedRenderMs;
    }

    /**
     * Most recent fixed-step count for the frame.
     *
     * @returns Fixed update-step count.
     */
    get updateSteps(): number {
        return this.#updateSteps;
    }

    /**
     * Most recent draw-call count for the frame.
     *
     * @returns Draw-call count from demo draw APIs.
     */
    get drawCalls(): number {
        return this.#drawCalls;
    }
}
