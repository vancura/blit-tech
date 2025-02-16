const eslint = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const jsdocPlugin = require('eslint-plugin-jsdoc');
const nodePlugin = require('eslint-plugin-n');
const perfectionistPlugin = require('eslint-plugin-perfectionist');
const prettierConfig = require('eslint-config-prettier');
const promisePlugin = require('eslint-plugin-promise');
const regexPlugin = require('eslint-plugin-optimize-regex');
const securityPlugin = require('eslint-plugin-security');
const sonarjsPlugin = require('eslint-plugin-sonarjs');
const tailwindcssPlugin = require('eslint-plugin-tailwindcss');
const tseslintPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
    // Ignores
    {
        ignores: [
            '.git/**',
            '.vscode/**',
            '.yarn/**',
            '*.min.*',
            '**/*.json',
            '**/*.jsonc',
            '**/*.md',
            '**/*.mdx',
            '**/*.yaml',
            '**/*.yml',
            'build/**',
            'coverage/**',
            'dist/**',
            'node_modules/**',
            'public/**',
            'jsconfig.json',
            '.prettierrc.cjs',
            'eslint.config.cjs',
            'postcss.config.cjs',
            'tailwind.config.cjs',
            'src/env.d.ts'
        ]
    },

    // Base configuration
    {
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                extraFileExtensions: ['.mdx']
            }
        },
        plugins: {
            '@typescript-eslint': tseslintPlugin,
            import: importPlugin,
            jsdoc: jsdocPlugin,
            promise: promisePlugin,
            sonarjs: sonarjsPlugin,
            security: securityPlugin,
            tailwindcss: tailwindcssPlugin,
            n: nodePlugin,
            'optimize-regex': regexPlugin,
            perfectionist: perfectionistPlugin
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.ts', '.mjs', '.md']
                }
            },
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx', '.mjs']
            }
        },
        rules: {
            // Base ESLint recommended rules
            ...eslint.configs.recommended.rules,

            // TypeScript recommended rules
            ...tseslintPlugin.configs.recommended.rules,
            ...tseslintPlugin.configs['recommended-requiring-type-checking'].rules,
            ...tseslintPlugin.configs.strict.rules,

            // Plugin recommended rules
            ...importPlugin.configs.recommended.rules,
            ...promisePlugin.configs.recommended.rules,
            ...sonarjsPlugin.configs.recommended.rules,
            ...securityPlugin.configs.recommended.rules,
            ...nodePlugin.configs.recommended.rules,

            // General Rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
            'no-unused-vars': 'off', // Disabled in favor of @typescript-eslint/no-unused-vars
            'max-len': ['warn', { code: 120 }],
            complexity: ['error', { max: 10 }],

            // TypeScript Specific Rules
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/strict-boolean-expressions': 'warn',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'explicit' }],
            '@typescript-eslint/member-ordering': 'warn',
            '@typescript-eslint/method-signature-style': ['warn', 'property'],
            '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/naming-convention': [
                'warn',
                { selector: 'default', format: ['camelCase', 'PascalCase'] },
                { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
                { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
                { selector: 'property', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
                { selector: 'typeProperty', format: ['camelCase', 'UPPER_CASE'] },
                { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
                { selector: 'typeLike', format: ['PascalCase'] },
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    prefix: ['I'],
                    filter: { regex: '^Props$', match: false }
                }
            ],

            // Import Rules
            'import/prefer-default-export': 'off',
            'import/no-unresolved': 'off', // TypeScript handles module resolution
            'import/order': 'off', // Using perfectionist instead

            // Perfectionist
            'perfectionist/sort-imports': [
                'error',
                {
                    type: 'natural',
                    order: 'asc',
                    groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']]
                }
            ],

            // Regex
            'optimize-regex/optimize-regex': 'warn',

            // SonarJS
            'sonarjs/cognitive-complexity': 'error',
            'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
            'sonarjs/no-identical-functions': 'error',
            'sonarjs/no-empty-function': 'off',
            'sonarjs/no-unused-expressions': 'off',

            // Promise
            'promise/always-return': 'error',
            'promise/no-return-wrap': 'error',
            'promise/param-names': 'error',
            'promise/catch-or-return': 'error',
            'promise/no-native': 'off',
            'promise/no-callback-in-promise': 'warn',

            // Security
            'security/detect-object-injection': 'warn',
            'security/detect-non-literal-regexp': 'error',
            'security/detect-possible-timing-attacks': 'error',
            'security/detect-unsafe-regex': 'error',

            // Node
            'n/no-missing-import': 'off',
            'n/no-unpublished-import': [
                'error',
                {
                    allowModules: [
                        'vite',
                        'rollup-plugin-visualizer',
                        'tailwindcss',
                        'vite-plugin-compression',
                        'vite-plugin-html',
                        'vite-plugin-image-optimizer',
                        'vite-plugin-inspect'
                    ]
                }
            ],

            // JSDoc
            'jsdoc/check-alignment': 'error',
            'jsdoc/check-param-names': 'warn',
            'jsdoc/check-tag-names': 'warn',
            'jsdoc/check-types': 'warn',
            'jsdoc/require-jsdoc': 'warn',
            'jsdoc/require-param': 'warn',
            'jsdoc/require-returns': 'warn',

            // Tailwind
            'tailwindcss/classnames-order': 'error',
            'tailwindcss/enforces-negative-arbitrary-values': 'error',
            'tailwindcss/enforces-shorthand': 'warn',
            'tailwindcss/migration-from-tailwind-2': 'warn',
            'tailwindcss/no-custom-classname': 'off',
            'tailwindcss/no-contradicting-classname': 'error'
        }
    },

    // TypeScript and JavaScript Files Configuration
    {
        files: ['**/*.{js,ts,mjs,cjs}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: process.cwd()
            },
            ecmaVersion: 'latest',
            sourceType: 'module'
        }
    },

    // Prettier Configuration
    prettierConfig
];
