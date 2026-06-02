// ESLint v9 flat config.
// Replaces the legacy .eslintrc.json (not loaded by ESLint >= 9).
// Formatting concerns are owned by Prettier; this config focuses on correctness.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    // Generated output, vendored code, and example projects are not linted.
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'examples/**',
      'packages/*/dist/**',
      'schemas/**',
      'src/codegen/templates/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      // Defer to Prettier for stylistic concerns.
      'no-console': 'off',
      'no-process-exit': 'warn',
      // Unused vars are signal, not failure; allow intentional `_`-prefixed args.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` is discouraged (see CLAUDE.md) but flagged as a warning so the
      // gate surfaces it without blocking incremental cleanup.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      // Browser-only dynamic imports legitimately need @ts-ignore because their
      // types are not present in the root tsconfig. Require a description so the
      // suppression stays self-documenting.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': 'allow-with-description', minimumDescriptionLength: 5 },
      ],
    },
  },
  {
    // Tests use Jest globals and looser typing conventions.
    files: ['**/__tests__/**', '**/*.{test,spec}.{js,ts}', 'tests/**', 'jest.setup.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
