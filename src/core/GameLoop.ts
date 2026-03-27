// #region GameLoop Class

/**
 * Fixed-timestep game loop with variable-rate rendering.
 *
 * Implements the accumulator pattern to ensure update() runs at a deterministic
 * rate regardless of frame timing irregularities. render() runs at the browser's
 * native refresh rate.
 * The accumulator prevents a spiral-of-death catch-up burst by capping the
 * number of fixed updates processed in a single frame.
 */
export class GameLoop {
    // #region Constants

    /** Maximum update steps per frame to prevent spiral-of-death after long pauses. */
    private static readonly MAX_STEPS = 8;

    // #endregion

    // #region State

    /** Whether the loop is currently running. */
    private isRunning: boolean = false;

    /** Current tick count (increments once per fixed update call). */
    private ticks: number = 0;

    /** Timestamp of the last frame, in milliseconds. */
    private lastUpdateTime: number = 0;

    /** Accumulated time waiting to be consumed by fixed updates. */
    private accumulator: number = 0;

    /** Update interval in milliseconds (1000 / targetFPS). */
    private readonly updateInterval: number;

    /** Callback invoked once per fixed update step. */
    private readonly onUpdate: () => void;

    /** Callback invoked once per rendered frame. */
    private readonly onRender: () => void;

    // #endregion

    // #region Constructor

    /**
     * Creates a new GameLoop.
     *
     * @param updateInterval - Milliseconds between fixed update steps (1000 / targetFPS).
     * @param onUpdate - Called once per fixed update step at the target rate.
     * @param onRender - Called once per rendered frame at the browser's refresh rate.
     * @throws {Error} If updateInterval is not a finite positive number.
     */
    constructor(updateInterval: number, onUpdate: () => void, onRender: () => void) {
        if (!Number.isFinite(updateInterval) || updateInterval <= 0) {
            throw new Error(`GameLoop updateInterval must be a finite positive number, got: ${updateInterval}`);
        }

        this.updateInterval = updateInterval;
        this.onUpdate = onUpdate;
        this.onRender = onRender;
    }

    // #endregion

    // #region Public Methods

    /**
     * Starts the loop.
     *
     * Uses a double `requestAnimationFrame` delay before the first tick, so the
     * surrounding rendering surface is fully ready before timing begins.
     */
    public start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.lastUpdateTime = performance.now();

                requestAnimationFrame((t) => this.tick(t));
            });
        });
    }

    /**
     * Stops the loop.
     * The current frame, if already running, is allowed to finish.
     */
    public stop(): void {
        this.isRunning = false;
    }

    /**
     * Gets the current tick count.
     * Ticks increment once per fixed update step.
     *
     * @returns Number of update ticks since the loop started or since the last reset.
     */
    public getTicks(): number {
        return this.ticks;
    }

    /**
     * Resets the tick counter to zero.
     */
    public resetTicks(): void {
        this.ticks = 0;
    }

    // #endregion

    // #region Private Loop

    /**
     * Processes one animation frame.
     *
     * Advances the accumulator, runs zero or more fixed updates, renders once,
     * and schedules the next frame while the loop remains active.
     *
     * @param currentTime - High-resolution timestamp provided by rAF, in milliseconds.
     */
    private tick(currentTime: number): void {
        if (!this.isRunning) {
            return;
        }

        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        this.accumulator += deltaTime;

        // Clamp accumulator to prevent spiral-of-death after long pauses.
        const maxAccumulator = this.updateInterval * GameLoop.MAX_STEPS;

        if (this.accumulator > maxAccumulator) {
            this.accumulator = maxAccumulator;
        }

        // Fixed update loop (capped at MAX_STEPS per frame).
        const steps = Math.min(Math.floor(this.accumulator / this.updateInterval), GameLoop.MAX_STEPS);

        for (let i = 0; i < steps; i++) {
            this.onUpdate();
            this.ticks++;
        }

        this.accumulator -= steps * this.updateInterval;

        // Variable render.
        this.onRender();

        requestAnimationFrame((t) => this.tick(t));
    }

    // #endregion
}

// #endregion
