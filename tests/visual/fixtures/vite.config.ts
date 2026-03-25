import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: '.',
    resolve: {
        alias: {
            'blit-tech': path.resolve(__dirname, '../../../src/BlitTech.ts'),
        },
    },
});
