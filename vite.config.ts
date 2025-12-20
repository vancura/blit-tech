import process from 'node:process';

import type { LibraryFormats } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(() => {
    const isWatch = process.argv.includes('--watch');

    return {
        base: '/',

        plugins: [
            dts({
                include: ['src/**/*.ts'],
                exclude: ['src/main.ts'],
                rollupTypes: true,
                beforeWriteFile: (filePath, content) => ({
                    filePath: filePath.replace(/BlitTech\.d\.ts$/, 'blit-tech.d.ts'),
                    content,
                }),
            }),
        ],

        // Handle WGSL shader files as raw text
        assetsInclude: ['**/*.wgsl'],

        build: {
            // Library build configuration
            lib: {
                entry: 'src/BlitTech.ts',
                name: 'BlitTech',
                fileName: 'blit-tech',
                formats: ['es', 'cjs'] as LibraryFormats[],
            },
            target: 'es2022',
            minify: isWatch ? false : ('esbuild' as const),
            sourcemap: isWatch,
            emptyOutDir: !isWatch,
            watch: isWatch ? {} : null,
            rollupOptions: {
                treeshake: {
                    moduleSideEffects: false,
                    propertyReadSideEffects: false,
                },
            },
        },

        // Optimize dependency pre-bundling
        optimizeDeps: {
            include: [],
            exclude: [],
        },
    };
});
