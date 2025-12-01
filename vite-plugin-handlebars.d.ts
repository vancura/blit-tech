declare module 'vite-plugin-handlebars' {
    import type { Plugin } from 'vite';

    /**
     *
     */
    interface HandlebarsPluginOptions {
        /** Directory or array of directories containing partial files (.hbs) */
        partialDirectory?: string | string[];

        /** Function that returns context data for each page */
        context?: (pagePath: string) => Record<string, unknown>;

        /** Whether to reload on partial changes */
        reloadOnPartialChange?: boolean;
    }

    export default function handlebars(options?: HandlebarsPluginOptions): Plugin;
}
