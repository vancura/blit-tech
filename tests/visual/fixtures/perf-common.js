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

export function createSpriteImage(primaryColor, secondaryColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext('2d');

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            context.fillStyle = (x + y) % 2 === 0 ? primaryColor : secondaryColor;
            context.fillRect(x, y, 1, 1);
        }
    }

    const image = new Image();

    return new Promise((resolve) => {
        image.onload = () => resolve(image);
        image.src = canvas.toDataURL();
    });
}
