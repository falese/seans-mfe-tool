# seans-mfe-tool — Session Prompt

> Update this file before each coding session. Hand it to the agent alongside CLAUDE.md.
> Keep CLAUDE.md open in every session. Reference @docs/spec.md only for sections relevant
> to the active issue.

---

## How to use this template

1. Fill in **Active issue** and **Scope** below
2. Run the ADR check — confirm which existing ADRs govern this work; if none exist for a decision, stop and create one (or waive explicitly)
3. Copy the relevant spec sections from `@docs/spec.md` into **Spec context**
4. Update **Current file tree** to reflect actual state
5. Hand `CLAUDE.md` + this file to the coding agent
6. After the session, update **Current state** in `CLAUDE.md` and any resolved decisions in `docs/spec.md`

---

## Session: 2026-05-24

### Active issue(s)

**ADR-036 Phase 4 close-out — [#181](https://github.com/falese/seans-mfe-tool/issues/181), [#185](https://github.com/falese/seans-mfe-tool/issues/185), [#182](https://github.com/falese/seans-mfe-tool/issues/182)**

Validated at session start: #180 (contracts exports) and #172 (build:check) were already done and closed.

### Scope

#181: `FrameworkSchema` / `BundlerSchema` in `src/dsl/schema.ts` changed from `z.enum` to `z.string().min(1)`. `KNOWN_FRAMEWORKS` / `KNOWN_BUNDLERS` constants exported for use in warnings. `parseManifestFile` in `src/dsl/parser.ts` emits a stderr warning (not error) for unknown values.

#185: `remote:init --framework` flag drops the hardcoded `options: ['react', 'angular']` list. Any string accepted by oclif; unknown frameworks fail at `loadFrameworkPlugin()` with `ValidationError`. Type cast `as 'react' | 'angular'` removed from `init.ts`.

#182: New `docs/framework-plugin-authoring.md` — full guide for third-party plugin authors. Covers all abstract methods, VueVitePlugin skeleton, template directory conventions, npm package structure, and publishing steps. Link added to `README.md`.

NOT changing: existing plugin implementations, build commands, deploy logic, abc-kids examples.

**Acceptance criteria:**
- `FrameworkSchema.parse('svelte')` passes without error
- Unknown framework in manifest → warning on stderr, no schema error
- `remote:init --framework vue` → `ValidationError` from loader (not oclif)
- `docs/framework-plugin-authoring.md` exists with vue-vite skeleton
- All existing tests pass (2 pre-existing failures in cli-workflow + codegen-workflow are unrelated)

### ADR check

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-036 | Framework plugin pattern (`BaseFrameworkPlugin`) | All Phase 4 issues |

### Spec context

From ADR-036:
> Third-party plugins live at `@seans-mfe/framework-<name>` and are resolved by `loadFrameworkPlugin()`.
> The schema must accept arbitrary framework/bundler strings so plugin authors don't need to fork the core.

### Current branch

`claude/phase4-adr071-close-out` — PR #188 open against `main`.

### Key files modified this session

| File | Change |
|---|---|
| `src/dsl/schema.ts` | `FrameworkSchema`/`BundlerSchema` → open string; `KNOWN_*` constants |
| `src/dsl/parser.ts` | `warnUnknownPluginValues()` added to `parseManifestFile` |
| `src/commands/remote/init.ts` | Removed `options:[]` list + type cast |
| `src/dsl/__tests__/validator.test.ts` | 2 tests flipped to expect acceptance of unknown values |
| `src/commands/__tests__/remote-init.test.ts` | New test: unknown framework → `ValidationError` |
| `docs/framework-plugin-authoring.md` | New — full authoring guide |
| `README.md` | Link to authoring guide |
