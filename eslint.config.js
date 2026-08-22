// ESLint v9 flat config.
// Replaces the legacy .eslintrc.json (not loaded by ESLint >= 9).
// Formatting concerns are owned by Prettier; this config focuses on correctness.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
  {
    // Generated output and vendored code are not linted.
    //
    // `examples/**` stays excluded deliberately: those trees are generator
    // OUTPUT, held to their manifests by check:mfe-drift and
    // check:mfe-consistency rather than by eslint. Everything a human writes —
    // packages/**, scripts/**, tests/** — is linted, which it was not before:
    // the script said `eslint src jest.setup.js`, so the gate scripts
    // enforcing every other invariant were themselves unchecked.
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
      // The Node global set comes from `globals`, not a hand-written list.
      // The hand-written one was incomplete — it omitted AbortController, which
      // surfaced as a phantom no-undef the moment lint was widened past `src`.
      // A maintained-by-hand copy of facts that exist upstream is the ADR-075
      // pattern; this is the same fix applied to a lint config.
      globals: globals.node,
    },
    rules: {
      // Defer to Prettier for stylistic concerns.
      'no-console': 'off',
      // Escalated per-directory below rather than warned globally: in command
      // code `process.exit` bypasses the CommandResult envelope (ADR-016 /
      // ADR-018), which is a defect; in a standalone script it is the correct
      // idiom. Warning everywhere meant 39 permanent warnings and a gate no one
      // reads.
      'no-process-exit': 'off',
      // Unused vars are signal, not failure; allow intentional `_`-prefixed args.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` is forbidden in production code (CLAUDE.md, ADR-023) — narrow to
      // `unknown` and guard instead. Tests get a looser override below.
      '@typescript-eslint/no-explicit-any': 'error',
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
    // Command code and the CLI base: exiting the process here skips envelope
    // emission and the typed exit-code mapping that every machine consumer
    // (and the MCP layer) depends on. ADR-016, ADR-018.
    files: ['src/commands/**', 'src/hooks/**', 'packages/oclif-base/src/**'],
    rules: {
      'no-process-exit': 'error',
    },
  },
  {
    // Tests use Jest globals and looser typing conventions.
    files: ['**/__tests__/**', '**/*.{test,spec}.{js,ts}', 'tests/**', 'jest.setup.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
