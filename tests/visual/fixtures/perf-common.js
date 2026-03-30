/* global Image, document, window */

export function readNumberParam(name, fallback) {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(name);

    if (raw === null) {
        return fallback;
    }

    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : fallback;
}

export function readStringParam(name, fallback) {
    const params = new URLSearchParams(window.location.search);

    return params.get(name) ?? fallback;
}

export function initializePerfState(scenario, workload) {
    window.__PERF_COMPLETE__ = false;
    window.__PERF_RESULT__ = null;
    window.__INIT_FAILED__ = false;

    return {
        completed: false,
        frameLimit: Math.max(1, readNumberParam('frames', 100) | 0),
        frameTimes: [],
        framesSeen: 0,
        lastFrameAt: null,
        scenario,
        warmupFrames: Math.max(0, readNumberParam('warmup', 10) | 0),
        workload,
    };
}

export function recordFrame(state) {
    if (state.completed) {
        return true;
    }

    const now = performance.now();

    if (state.lastFrameAt !== null) {
        const delta = now - state.lastFrameAt;

        if (state.framesSeen >= state.warmupFrames) {
            state.frameTimes.push(delta);
        }
    }

    state.lastFrameAt = now;
    state.framesSeen += 1;

    if (state.frameTimes.length >= state.frameLimit) {
        window.__PERF_RESULT__ = {
            frameTimes: state.frameTimes.slice(),
            frames: state.frameLimit,
            scenario: state.scenario,
            warmupFrames: state.warmupFrames,
            workload: state.workload,
        };
        window.__PERF_COMPLETE__ = true;
        state.completed = true;
    }

    return state.completed;
}

export function markInitFailed(error) {
    window.__INIT_FAILED__ = true;

    if (error) {
        console.error(error);
    }
}

export function repeatText(seed, length) {
    return seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
}

/**
 * Creates and activates a default 16-color test palette.
 * Index 0 is transparent (never set — left as zero alpha).
 * Indices 1-10 cover common test colors.
 *
 * @param {object} BT - The BT namespace.
 * @param {object} Color32 - The Color32 class.
 * @returns {object} The created palette.
 */
export function installDefaultTestPalette(BT, Color32) {
    const palette = BT.paletteCreate(16);

    palette.set(1, Color32.black());
    palette.set(2, Color32.red());
    palette.set(3, Color32.green());
    palette.set(4, Color32.blue());
    palette.set(5, Color32.yellow());
    palette.set(6, Color32.cyan());
    palette.set(7, Color32.white());
    palette.set(8, new Color32(32, 32, 64, 255));
    palette.set(9, new Color32(16, 24, 40, 255));
    palette.set(10, new Color32(128, 0, 0, 255));

    BT.paletteSet(palette);

    return palette;
}

export function createSpriteImage(primaryColor, secondaryColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext('2d');

    if (!context) {
        markInitFailed(new Error('Failed to create 2D canvas context for perf sprite fixture'));

        return Promise.reject(new Error('Failed to create 2D canvas context for perf sprite fixture'));
    }

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            context.fillStyle = (x + y) % 2 === 0 ? primaryColor : secondaryColor;
            context.fillRect(x, y, 1, 1);
        }
    }

    const image = new Image();

    return new Promise((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = () => {
            const error = new Error('Failed to load generated perf sprite image');

            markInitFailed(error);
            reject(error);
        };
        image.src = canvas.toDataURL();
    });
}
