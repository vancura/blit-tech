const organizeImportsPlugin = require.resolve('prettier-plugin-organize-imports');
const organizeAttributesPlugin = require.resolve('prettier-plugin-organize-attributes');
const tailwindPlugin = require.resolve('prettier-plugin-tailwindcss');
const jsdocPlugin = require.resolve('prettier-plugin-jsdoc');

module.exports = {
    plugins: [organizeImportsPlugin, jsdocPlugin, organizeAttributesPlugin, tailwindPlugin],

    tabWidth: 4,
    useTabs: false,
    printWidth: 120,
    proseWrap: 'never',
    singleQuote: true,
    singleAttributePerLine: false,
    semi: true,
    trailingComma: 'none',

    overrides: [
        {
            files: '*.mjs',
            options: {
                parser: 'babel'
            }
        },
        {
            files: '*.mdx',
            options: {
                parser: 'mdx'
            }
        },
        {
            files: '*.json',
            options: {
                parser: 'json'
            }
        },
        {
            files: '*.yml',
            options: {
                parser: 'yaml'
            }
        },
        {
            files: '*.yaml',
            options: {
                parser: 'yaml'
            }
        },
        {
            files: '*.md',
            options: {
                parser: 'markdown',
                tabWidth: 4,
                proseWrap: 'preserve',
                embeddedLanguageFormatting: 'auto'
            }
        },
        {
            files: '*.js',
            options: {
                parser: 'babel'
            }
        },
        {
            files: '*.ts',
            options: {
                parser: 'typescript'
            }
        },
        {
            files: '*.tsx',
            options: {
                parser: 'typescript'
            }
        }
    ]
};
