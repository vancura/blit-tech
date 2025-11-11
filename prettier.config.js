/** @type {import('prettier').Config} */
export default {
    semi: true,
    singleQuote: true,
    tabWidth: 4,
    useTabs: false,
    trailingComma: 'all',
    printWidth: 120,
    endOfLine: 'lf',
    plugins: ['@ianvs/prettier-plugin-sort-imports'],

    // Import sorting configuration
    importOrder: ['<BUILTIN_MODULES>', '', '<THIRD_PARTY_MODULES>', '', '^@/(.*)$', '^[./]'],
    importOrderTypeScriptVersion: '5.9.0',

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
            files: ['*.json', '*.jsonc'],
            options: {
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
            files: ['*.css'],
            options: {
                tabWidth: 4,
                printWidth: 100,
                singleQuote: false,
            },
        },
    ],
};
