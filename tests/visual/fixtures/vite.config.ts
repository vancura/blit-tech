import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: '.',
    build: {
        sourcemap: true,
    },
    resolve: {
        alias: {
            'blit-tech': path.resolve(__dirname, '../../../src/BlitTech.ts'),
        },
    },
    plugins: [
        ...(process.env.VISUAL_COVERAGE
            ? [
                  istanbul({
                      include: ['src/**/*.ts'],
                      exclude: ['src/**/*.test.ts', 'src/__test__/**'],
                      extension: ['.ts'],
                  }),
              ]
            : []),
    ],
});
