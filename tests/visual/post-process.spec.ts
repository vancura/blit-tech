import type { Page } from '@playwright/test';

import { expect, test } from './coverage-fixture';

// Delay after render-complete signal before taking a screenshot, to allow the
// GPU to present the frame. Override via GPU_PRESENT_DELAY env var for CI tuning.
const GPU_PRESENT_DELAY = Number(process.env.GPU_PRESENT_DELAY ?? 100);

/**
 * Loads the post-process fixture in the requested mode and waits until the
 * scene render has signalled completion (or initialization has failed).
 *
 * @param page - Playwright page handle.
 * @param mode - Fixture mode hash, controls which effects are registered.
 * @returns `true` if the page initialized successfully; `false` when WebGPU
 *   was unavailable in the test environment.
 */
async function loadFixture(page: Page, mode: 'baseline' | 'crt' | 'crt-bloom'): Promise<boolean> {
    await page.goto(`/post-process.html#${mode}`);

    await page.waitForFunction(
        () => {
            const w = window as unknown as Record<string, boolean>;
            return w.__RENDER_COMPLETE__ || w.__INIT_FAILED__;
        },
        { timeout: 10_000 },
    );

    const initFailed = await page.evaluate(() => (window as unknown as Record<string, boolean>).__INIT_FAILED__);

    if (initFailed) {
        return false;
    }

    await page.waitForTimeout(GPU_PRESENT_DELAY);

    return true;
}

test.describe('Post-Process Effects', () => {
    test('baseline scene renders without effects (no chain)', async ({ page }) => {
        const ok = await loadFixture(page, 'baseline');

        if (!ok) {
            test.skip(true, 'WebGPU not available in this environment');

            return;
        }

        await expect(page.locator('canvas')).toHaveScreenshot('post-process-baseline.png', {
            maxDiffPixelRatio: 0.01,
        });
    });

    test('PipBoyEffect alone renders the deterministic CRT look', async ({ page }) => {
        const ok = await loadFixture(page, 'crt');

        if (!ok) {
            test.skip(true, 'WebGPU not available in this environment');

            return;
        }

        await expect(page.locator('canvas')).toHaveScreenshot('post-process-crt.png', {
            maxDiffPixelRatio: 0.01,
        });
    });

    test('PipBoyEffect + BloomEffect stacked renders both passes', async ({ page }) => {
        const ok = await loadFixture(page, 'crt-bloom');

        if (!ok) {
            test.skip(true, 'WebGPU not available in this environment');

            return;
        }

        await expect(page.locator('canvas')).toHaveScreenshot('post-process-crt-bloom.png', {
            maxDiffPixelRatio: 0.01,
        });
    });
});
