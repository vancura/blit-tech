/**
 * Prettier configuration for Blit-Tech
 *
 * NOTE: Prettier is used for Markdown, YAML, and HTML files.
 * TypeScript, JavaScript, JSON, and CSS are formatted by Biome.
 *
 * @type {import('prettier').Config}
 */
export default {
    // Base settings (applied to Markdown/YAML/HTML)
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    useTabs: false,
    trailingComma: 'all',
    printWidth: 120,
    endOfLine: 'lf',

    overrides: [
        {
            files: ['*.md', '*.mdx'],
            options: {
                parser: 'markdown',
                proseWrap: 'always',
                tabWidth: 2,
            },
        },
        {
            files: ['*.yml', '*.yaml'],
            options: {
                tabWidth: 2,
            },
        },
        {
            files: ['*.html'],
            options: {
                parser: 'html',
                tabWidth: 4,
                printWidth: 120,
            },
        },
    ],
};
