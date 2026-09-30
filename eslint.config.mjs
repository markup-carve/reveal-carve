/**
 * The house style, enforced rather than remembered.
 *
 * Three files drifted from the rest of the repo before anything checked: no
 * file docblock, braces left off single-line ifs, lines past 120 columns. The
 * rules here are the ones that drift, not a taste manifesto.
 */

export default [
    // Build output, not source. `dist/` is gitignored, so a CI checkout has no
    // copy of it and `npm run lint` is green there whatever this config says -
    // while the same command fails locally the moment anyone has run a build.
    // The bundled vendor code carries inline eslint-disable comments naming
    // typescript-eslint rules this config does not load, which is an error in
    // itself.
    {
        ignores: ['dist/**', 'site/**', 'coverage/**'],
    },
    {
        files: ['src/**/*.js', 'scripts/**/*.mjs', 'test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                document: 'readonly',
                window: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly',
                WebSocket: 'readonly',
                CustomEvent: 'readonly',
                KeyboardEvent: 'readonly',
                globalThis: 'readonly',
                localStorage: 'readonly',
                matchMedia: 'readonly',
                Reveal: 'readonly',
                TextDecoder: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
            },
        },
        rules: {
            // The rule that would have caught a function moved to another file
            // without its imports: it threw, its own catch swallowed it, and a
            // check reported clean sources it had never looked at.
            'no-undef': 'error',
            curly: ['error', 'all'],
            'max-len': ['error', { code: 120, ignoreUrls: true, ignoreRegExpLiterals: true, ignoreTemplateLiterals: true, ignoreStrings: true }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'object-shorthand': ['error', 'always'],
            'padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: '*', next: 'return' },
            ],
            indent: ['error', 4, { SwitchCase: 1 }],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'comma-dangle': ['error', 'always-multiline'],
        },
    },
    {
        // The runtime snippet is serialized into a page, where `var` and terse
        // shapes are deliberate: it has to run before anything else has.
        files: ['src/renderer-runtime.js'],
        rules: { 'no-var': 'off', curly: 'off' },
    },
];
