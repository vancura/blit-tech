import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';
import { createHtmlPlugin } from 'vite-plugin-html';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import inspect from 'vite-plugin-inspect';

// Assert the correct callable signature.
// Either cast it to any or to a known function type.
const compressionPlugin = compression as unknown as (options?: {
    algorithm?: string;
    ext?: string;
    deleteOriginFile?: boolean;
    threshold?: number;
    compressionOptions?: Record<string, unknown>;
    filter?: RegExp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) => any;

export default defineConfig(({ mode }) => ({
    // Base public path - update if deploying to a subdirectory.
    base: '/',

    // Development server configuration.
    server: {
        port: 3000,
        open: true, // automatically open browser
        cors: true, // enable CORS
        hmr: {
            overlay: true // show errors as overlay
        }
    },

    // Production build configuration.
    build: {
        outDir: 'dist',

        // CommonJS dependencies optimization.
        commonjsOptions: {
            include: [] // add CommonJS dependencies here if needed
        },

        // Code minification settings.
        minify: 'terser',
        terserOptions: {
            compress: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                drop_console: true, // remove console.logs

                // eslint-disable-next-line @typescript-eslint/naming-convention
                drop_debugger: true // remove debugger statements
            }
        },

        // Chunk splitting configuration.
        rollupOptions: {
            output: {
                // Remove manual chunks if not needed, or configure properly.
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]'

                // Only keep manualChunks if you really need custom chunk splitting.
                // manualChunks: (id: string) => {
                //     if (id.includes('node_modules')) {
                //         return 'vendor';
                //     }
                // }
            }
        },

        sourcemap: false, // disable sourcemaps in production
        reportCompressedSize: true // report compressed file sizes
    },

    // Dependency optimization.
    optimizeDeps: {
        include: [] // add dependencies that need pre-bundling
    },

    // Asset handling.
    assetsInclude: ['**/*.svg'], // treat SVGs as assets

    // CSS configuration.
    css: {
        modules: {
            localsConvention: 'camelCase' // use camelCase for CSS modules
        },
        devSourcemap: true // enable CSS sourcemaps in development
    },

    // Plugin configuration.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    plugins: [
        tailwindcss(),

        // Development inspection tool (available at /__inspect/).
        mode === 'development' &&
            inspect({
                build: true,
                outputDir: '.inspect'
            }),

        // Image and SVG optimization.
        ViteImageOptimizer({
            test: /\.(?<imageExt>jpe?g|png|gif|tiff|webp|svg|avif)$/i,

            includePublic: true, // also optimize images in public/
            logStats: true, // log optimization stats
            svg: {
                multipass: true, // multiple optimization passes
                plugins: [
                    {
                        name: 'preset-default',
                        params: {
                            overrides: {
                                removeViewBox: false, // keep viewBox for scaling
                                cleanupNumericValues: false,
                                cleanupIds: false,
                                convertPathData: false
                            }
                        }
                    },
                    'sortAttrs', // sort attributes for better compression
                    {
                        name: 'addAttributesToSVGElement',
                        params: {
                            attributes: [{ xmlns: 'http://www.w3.org/2000/svg' }]
                        }
                    }
                ]
            },

            // Image quality settings.
            png: { quality: 85 },
            jpeg: { quality: 85 },
            jpg: { quality: 85 },
            webp: {
                lossless: false,
                quality: 85
            }
        }),

        // Brotli compression for text-based assets and fonts.
        compressionPlugin({
            algorithm: 'brotliCompress',
            ext: '.br',
            deleteOriginFile: false,
            threshold: 10240,
            compressionOptions: { level: 11 },
            filter: /\.(?<imageExt>js|mjs|json|css|html|svg|woff2)$/i
        }),

        // Gzip compression (fallback for browsers without Brotli support).
        compressionPlugin({
            algorithm: 'gzip',
            ext: '.gz',
            deleteOriginFile: false,
            threshold: 10240,
            compressionOptions: { level: 9 },
            filter: /\.(?<imageExt>js|mjs|json|css|html|svg|woff2)$/i
        }),

        // Bundle analysis (generates .stats/stats.html in analyze mode).
        mode === 'analyze' &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            visualizer({
                open: true, // open analyzer in browser
                gzipSize: true, // show gzip sizes
                brotliSize: true, // show brotli sizes
                filename: '.stats/stats.html'
            })(),

        createHtmlPlugin({
            entry: '/src/main.ts',
            inject: {
                data: {
                    title: 'WS playground',
                    injectScript: `<script src="./inject.js"></script>`
                }
            },
            minify: {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true,
                minifyCSS: true,
                minifyJS: true,
                minifyURLs: true,
                removeEmptyAttributes: true,
                removeOptionalTags: true,
                sortAttributes: true,
                sortClassName: true
            }
        })
    ].filter(Boolean) // remove false values from plugins array
}));
