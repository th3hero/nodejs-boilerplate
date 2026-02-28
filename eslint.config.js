const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
    js.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module'
            },
            globals: {
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly'
            }
        },
        plugins: {
            '@typescript-eslint': typescript
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-var-requires': 'error',
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',

            'no-console': 'warn',
            'no-debugger': 'error',
            'no-duplicate-imports': 'error',
            'no-unused-vars': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            'no-restricted-properties': [
                'error',
                {
                    object: 'process',
                    property: 'env',
                    message: 'Use @config/environment.config instead of process.env directly.'
                }
            ]
        }
    },
    {
        files: ['src/config/environment.config.ts'],
        rules: {
            'no-restricted-properties': 'off'
        }
    },
    {
        ignores: [
            'dist/',
            'node_modules/',
            'src/database/prisma/',
            '*.js',
            '*.d.ts'
        ]
    }
];
