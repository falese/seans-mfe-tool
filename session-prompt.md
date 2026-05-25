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

**[#174](https://github.com/falese/seans-mfe-tool/issues/174) — `build:dev` command (Phase 2, ADR-071)**

### Scope

Implement the `build:dev` oclif command. Core orchestrates; plugin implements `startDevServer()`.

The command:
1. Resolves framework from `--framework` flag or auto-detected `mfe-manifest.yaml`
2. Loads the concrete plugin via `loadFrameworkPlugin()`
3. Calls `plugin.startDevServer(manifest, { port, cwd })` → `DevServerHandle`
4. Prints the server URL, blocks until SIGINT/SIGTERM, then calls `handle.stop()`
5. Returns `BuildDevResult` under `--json`

NOT changing: plugin implementations (`framework-react`, `framework-angular`), `BaseFrameworkPlugin` contract, `loadFrameworkPlugin()` loader, any other commands.

**Acceptance criteria:**
- `build:dev --framework react` starts the React dev server
- `build:dev --framework angular` starts the Angular dev server
- `build:dev` with no flags auto-detects framework from `mfe-manifest.yaml` in cwd
- `--port` overrides the plugin default
- SIGINT causes graceful `handle.stop()` then exit
- `--json` returns `BuildDevResult` envelope
- Tests pass (TDD: tests written first)
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all green

### ADR check

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-071 | Framework plugins — abstract BaseFrameworkPlugin | This entire issue; `build:dev` is one of the core commands that calls plugin methods polymorphically |

### Spec context

Phase 2 of the framework-plugins roadmap (issues #174, #175, #176). Phase 1 (issues #168–#172, #185) merged in PR #186.

`DevServerHandle` interface (`packages/contracts/src/framework-plugin.ts:64`):
```ts
interface DevServerHandle {
  stop: () => Promise<void>;
  url: string;
}
```

Plugin `startDevServer` signature:
```ts
abstract startDevServer(manifest: unknown, opts: { port: number; cwd: string }): Promise<DevServerHandle>;
```

### Current file tree

```
src/commands/build/dev.ts                     ← CREATE
src/commands/build/__tests__/dev.test.ts      ← CREATE
src/oclif/results.ts                          ← MODIFY (add BuildDevResult)
session-prompt.md                             ← UPDATED (this file)
```

### TDD order

1. Write `dev.test.ts` — all tests fail (no implementation)
2. Add `BuildDevResult` to `src/oclif/results.ts`
3. Implement `src/commands/build/dev.ts`
4. All tests pass

### Existing tests (summary)

- `src/commands/build/__tests__/check.test.ts` — pattern to follow for `dev.test.ts`
- `src/framework/__tests__/loader.test.ts` — verifies `loadFrameworkPlugin()` (reused by `build:dev`)
