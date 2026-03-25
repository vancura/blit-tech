import { expect, test } from '@playwright/test';

test.describe('Primitive Rendering', () => {
    test('should render known primitive patterns', async ({ page }) => {
        await page.goto('/primitives.html');

        // Wait for either render completion or initialization failure.
        await page.waitForFunction(
            () => {
                const w = window as unknown as Record<string, boolean>;
                return w.__RENDER_COMPLETE__ || w.__INIT_FAILED__;
            },
            { timeout: 10_000 },
        );

        // Check if WebGPU initialization failed (hardware-dependent).
        const initFailed = await page.evaluate(() => (window as unknown as Record<string, boolean>).__INIT_FAILED__);

        if (initFailed) {
            test.skip(true, 'WebGPU not available in this environment');
            return;
        }

        // Small delay for GPU present.
        await page.waitForTimeout(100);

        await expect(page.locator('canvas')).toHaveScreenshot('primitives.png', {
            maxDiffPixelRatio: 0.01,
        });
    });
});
