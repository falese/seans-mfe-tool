# seans-mfe-tool — Session Prompt

> Update this file before each coding session. Hand it to the agent alongside CLAUDE.md.
> Keep CLAUDE.md open in every session. Reference @docs/spec.md only for sections relevant
> to the active issue.

---

## Session: 2026-05-24

### Active issue(s)

**[#175](https://github.com/falese/seans-mfe-tool/issues/175) — `build:prod` command (Phase 2, ADR-071)**

### Scope

Implement the `build:prod` oclif command. Core orchestrates; plugin implements `buildProduction()`.

The command:
1. Resolves framework from `--framework` flag or auto-detected `mfe-manifest.yaml`
2. Loads the concrete plugin via `loadFrameworkPlugin()`
3. Calls `plugin.buildProduction(manifest, { cwd, outputDir })` → `BuildResult`
4. Prints structured output (artifacts, warnings, errors)
5. Returns `BuildProdResult` under `--json`; exits non-zero if `BuildResult.success === false`

NOT changing: plugin implementations, `BaseFrameworkPlugin` contract, `loadFrameworkPlugin()`, `build:dev` or `build:check`.

**Acceptance criteria:**
- `build:prod --framework react` runs the React production build
- `build:prod --framework angular` runs the Angular production build
- `build:prod` auto-detects framework from `mfe-manifest.yaml` in cwd
- `--output-dir` overrides the default output directory
- Non-zero exit on build failure (via `BusinessError` or process exit code)
- `--json` returns `BuildProdResult` envelope
- Tests pass (TDD: tests written first)
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all green

### ADR check

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-071 | Framework plugins — abstract BaseFrameworkPlugin | This entire issue; `build:prod` calls `plugin.buildProduction()` polymorphically |

### Spec context

`BuildResult` interface (`packages/contracts/src/framework-plugin.ts:45`):
```ts
interface BuildResult {
  success: boolean;
  artifacts: string[];
  duration_ms: number;
  warnings: string[];
  errors: BuildError[];
}
interface BuildError {
  file?: string; line?: number; column?: number;
  message: string;
  category: 'syntax' | 'type' | 'dependency' | 'config' | 'runtime' | 'unknown';
  suggestion?: string;
}
```

Plugin `buildProduction` signature:
```ts
abstract buildProduction(manifest: unknown, opts: { cwd: string; outputDir: string }): Promise<BuildResult>;
```

### Current file tree

```
src/commands/build/prod.ts                     ← CREATE
src/commands/build/__tests__/prod.test.ts      ← CREATE
src/oclif/results.ts                           ← MODIFY (add BuildProdResult)
session-prompt.md                              ← UPDATED (this file)
```

### TDD order

1. Write `prod.test.ts` — all tests fail (no implementation)
2. Add `BuildProdResult` to `src/oclif/results.ts`
3. Implement `src/commands/build/prod.ts`
4. All tests pass

### Existing patterns to follow

- `src/commands/build/dev.ts` — manifest resolution + plugin loading pattern
- `src/commands/build/check.ts` — non-blocking command returning structured result
- `src/commands/build/__tests__/dev.test.ts` — pre-aborted signal / mock plugin pattern
