# seans-mfe-tool — Session Prompt

> Update this file before each coding session. Hand it to the agent alongside CLAUDE.md.
> Keep CLAUDE.md open in every session. Reference @docs/spec.md only for sections relevant
> to the active issue.

---

## Session: 2026-05-24

### Active issue(s)

**[#176](https://github.com/falese/seans-mfe-tool/issues/176) — Migrate UnifiedGenerator `isAngularWebpack` branching → `loadFrameworkPlugin()` (Phase 2, ADR-071)**

### Scope

Replace the manual `isAngularWebpack` boolean in `buildTemplateVars()` with a call to
`loadFrameworkPlugin()`. The plugin provides `framework`, `bundler`, and `id` (which
matches the existing `templateVariant` string) so the rest of the file (all the
`templateVariant === 'angular-webpack'` checks) stays untouched.

Before:
```ts
// line 413 — unified-generator.ts
const isAngularWebpack = manifest.framework === 'angular' || manifest.bundler === 'webpack';
// lines 434-438
framework: (isAngularWebpack ? 'angular' : 'react') as 'react' | 'angular',
bundler:   (isAngularWebpack ? 'webpack' : 'rspack') as 'rspack' | 'webpack',
templateVariant: (isAngularWebpack ? 'angular-webpack' : 'react-rspack') as ...
```

After:
```ts
const frameworkName = manifest.framework ?? (manifest.bundler === 'webpack' ? 'angular' : 'react');
const plugin = loadFrameworkPlugin(frameworkName);
// ...
framework: plugin.framework as 'react' | 'angular',
bundler:   plugin.bundler   as 'rspack' | 'webpack',
templateVariant: plugin.id  as 'react-rspack' | 'angular-webpack',
```

NOT changing: any `templateVariant === 'angular-webpack'` checks elsewhere in the file,
any template files, any tests not directly covering the variant-selection logic.

**Acceptance criteria:**
- `isAngularWebpack` is gone; `loadFrameworkPlugin()` drives variant selection
- Backward compat preserved: `bundler:'webpack'` alone (no `framework` field) still → angular-webpack
- Existing test suites (`angular-variant.test.ts`, `unified-generator.test.ts`) still pass
- New test (or updated test) covers the plugin-delegation path
- `npm test`, `npm run typecheck`, `npm run build` all green

### ADR check

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-071 | Framework plugins — abstract BaseFrameworkPlugin | Replaces O(n) conditionals with plugin lookup |

### Spec context

Key files:
- `src/codegen/UnifiedGenerator/unified-generator.ts:413` — `isAngularWebpack` declaration (only occurrence)
- `src/codegen/UnifiedGenerator/unified-generator.ts:434-438` — 3 derived fields
- `src/framework/loader.ts` — `loadFrameworkPlugin(name): BaseFrameworkPlugin`
- `src/codegen/UnifiedGenerator/__tests__/angular-variant.test.ts` — angular variant tests
- `src/codegen/UnifiedGenerator/__tests__/unified-generator.test.ts` — base tests

`plugin.id` values: `'react-rspack'` | `'angular-webpack'` — matches existing `templateVariant` strings exactly.

### Current file tree

```
src/codegen/UnifiedGenerator/unified-generator.ts   ← MODIFY (lines 413-438)
src/codegen/UnifiedGenerator/__tests__/...          ← VERIFY / UPDATE if needed
session-prompt.md                                   ← UPDATED (this file)
```

### TDD order

1. Run existing tests — confirm they pass on main (baseline)
2. Make the change (4-line swap)
3. Run tests — confirm no regressions
4. Add/update test to explicitly cover `loadFrameworkPlugin()` delegation if not already covered
