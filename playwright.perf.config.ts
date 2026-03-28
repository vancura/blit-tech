import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/perf',
    outputDir: 'test-results/perf',
    timeout: 120_000,

    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,

    reporter: process.env.CI ? 'github' : 'list',

    use: {
        baseURL: 'http://127.0.0.1:5175',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium-webgpu',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chrome',
                launchOptions: {
                    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disable-gpu-sandbox'],
                },
            },
        },
    ],

    webServer: {
        command:
            'pnpm exec vite serve tests/visual/fixtures --config tests/visual/fixtures/vite.config.ts --host 127.0.0.1 --port 5175',
        port: 5175,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
