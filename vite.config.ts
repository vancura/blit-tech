import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode, command }) => {
    const isLibBuild = mode === 'lib';
    const isProduction = command === 'build';

    return {
        plugins: [
            dts({
                include: ['src/**/*.ts'],
                exclude: ['src/main.ts'],
                rollupTypes: true,
            }),
        ],

        // Handle WGSL shader files as raw text
        assetsInclude: ['**/*.wgsl'],

        build: isLibBuild
            ? {
                  // Library build configuration
                  lib: {
                      entry: 'src/BlitTech.ts',
                      name: 'BlitTech',
                      fileName: 'blit-tech',
                      formats: ['es', 'cjs'],
                  },
                  target: 'es2022',
                  minify: 'esbuild',
                  sourcemap: false,
                  emptyOutDir: true,
                  rollupOptions: {
                      treeshake: {
                          moduleSideEffects: false,
                          propertyReadSideEffects: false,
                      },
                  },
              }
            : {
                  // Development/examples build configuration
                  target: 'es2022',
                  minify: isProduction ? 'esbuild' : false,
                  sourcemap: !isProduction,
                  emptyOutDir: true,
                  rollupOptions: {
                      input: {
                          main: resolve(__dirname, 'index.html'),
                          'examples-index': resolve(__dirname, 'examples/index.html'),
                          'examples-basics': resolve(__dirname, 'examples/basics.html'),
                          'examples-primitives': resolve(__dirname, 'examples/primitives.html'),
                          'examples-camera': resolve(__dirname, 'examples/camera.html'),
                          'examples-patterns': resolve(__dirname, 'examples/patterns.html'),
                          'examples-sprites': resolve(__dirname, 'examples/sprites.html'),
                          'examples-fonts': resolve(__dirname, 'examples/fonts.html'),
                      },
                      output: isProduction
                          ? {
                                // Production optimizations
                                compact: true,
                                generatedCode: {
                                    symbols: false,
                                    constBindings: true,
                                },
                                manualChunks: undefined,
                            }
                          : undefined,
                  },
              },

        server: {
            open: true,
            hmr: true,
        },

        preview: {
            open: true,
        },

        // Optimize dependency pre-bundling
        optimizeDeps: {
            include: [],
            exclude: [],
        },
    };
});
