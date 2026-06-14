# Contract Alignment Pass — Docs vs. Implementation

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#219)
**Method:** Read the implementation, compare to the documented contract, record drift with file:line citations and a remediation.

This pass audits the **integration surface** — the things a consumer (agent, shell operator, plugin author) binds to — against the actual code on `main`. Each finding cites the implementation so the fix is unambiguous. Severities use the [Gap Matrix](./documentation-gap-matrix.md) scale.

> **Scope note.** This document records *findings and the authoritative behavior*. It does not edit the affected ADRs (ADR-018 is `Accepted`); per `CLAUDE.md`, ADRs are reconciled via a follow-up, not mid-pass. The recommended home for the corrected, consumer-facing contract is a new `docs/cli-contract.md` (Gap G05).

---

## Finding CA-1 — `CommandResult<T>` envelope shape (S1)

**Documented (ADR-018).** `interface CommandResult<T> { success: boolean; data?: T; error?: { message; code: string; type }; meta?: { dryRun?: boolean; duration?: number } }`.

**Implemented** (`packages/contracts/src/envelope.ts:158–173`):

```typescript
export type CommandResult<T = unknown> = {
  ok: boolean;                 // NOT `success`
  data?: T;
  error?: CommandError;
  warnings: string[];          // top-level, always present
  telemetry: { durationMs: number; correlationId: string };  // NOT `meta`
};
export type CommandError = {
  type: string;
  code: number;                // numeric exit code, NOT a string
  message: string;
  retryable: boolean;          // not documented
  userFacing: boolean;         // not documented
  details?: unknown;           // not documented
};
```

**Drift.**
- `success` → **`ok`** (a consumer keying on `success` reads `undefined`).
- `error.code` is a **number** (the sysexits exit code), not a string.
- `error` carries **`retryable` / `userFacing` / `details`** (valuable for agents — undocumented).
- `meta: { dryRun?, duration? }` → **`telemetry: { durationMs, correlationId }`** (renamed, required, and there is **no `dryRun`** field).
- **`warnings: string[]`** is a top-level field (populated from `BaseCommand.warnings`) — undocumented.

**Authoritative behavior.** The shape in `envelope.ts` is canonical. `formatSuccess()` (`envelope.ts:205–219`) and `formatError()` (`:221–249`) are the only constructors.

**Remediation.** Document the real shape in `cli-contract.md`; update ADR-018's interface block (or add an "Implemented shape" addendum) so the ADR matches code. Tracking: G05.

---

## Finding CA-2 — `--json` mode runtime behavior (S1)

**Was under-documented.** ADR-018 stated the intent ("one envelope on stdout; everything else on stderr") but not the mechanism, so consumers couldn't predict side effects.

**Implemented** (`packages/oclif-base/src/BaseCommand.ts:43–73`, `json-output.ts`). In `--json` mode `run()` does, in order:

1. `suppressChalk()` — sets `chalk.level = 0` and `NO_COLOR=1` (`json-output.ts:17–20`).
2. `redirectStdoutToStderr()` — monkey-patches `process.stdout.write` and `console.log/info/debug` to write to **stderr**, preserving a reference to the real stdout (`json-output.ts:27–57`).
3. `blockInteractivePrompts()` — forces `process.stdin.isTTY = false` and makes `inquirer.prompt` reject with a `SystemError` instead of hanging (`json-output.ts:79–104`).
4. Runs `runCommand()`; on success emits **exactly one** line — `JSON.stringify(formatSuccess(...))` — to the **real** stdout via `writeJsonLine()` (`BaseCommand.ts:57–63`), then `process.exit(EXIT_CODES.ok)`.
5. On throw, emits `formatError(...)` the same way and exits with `exitCodeFor(error.type)` (`BaseCommand.ts:65–70`).

**Human mode** (no `--json`): `runCommand()` runs unchanged and errors re-throw to oclif's default handler (`BaseCommand.ts:39–41, 71`).

**Authoritative behavior (consumer contract).**
- Under `--json`, **stdout contains exactly one line**: the JSON envelope. *All* progress, logs, and warnings are on stderr — even `console.log` in command code.
- Interactive prompts are impossible under `--json`; a command that needs input fails fast with a `SystemError` envelope.
- The process always exits via `process.exit` with a sysexits code (see CA-3).

**Remediation.** Capture this as the "JSON mode" section of `cli-contract.md`; add a conformance test asserting one stdout line per command. Tracking: G06.

---

## Finding CA-3 — Exit-code table (S2)

**Implemented** (`packages/contracts/src/envelope.ts:179–190`):

| Key | Code | Meaning | Agent action |
|---|---|---|---|
| `ok` | 0 | Success | proceed |
| `generic` | 1 | Uncaught/generic failure | inspect `error` |
| `usage` | 2 | Bad invocation / flags | fix command, retry |
| `validation` | 64 | `ValidationError` (input invalid) | fix input, retry |
| `business` | 65 | `BusinessError` (domain rule) | do not blind-retry |
| `network` | 66 | `NetworkError` | retry with backoff |
| `system` | 69 | `SystemError` (env/IO) | escalate |
| `unknown` | 70 | Unclassified | escalate |
| `security` | 77 | `SecurityError` | escalate, do not retry |
| `timeout` | 124 | `TimeoutError` | retry / increase timeout |

**Drift.** ADR-033's `enforcer-config` lists `[0, 2, 64, 65, 66, 69, 70, 77, 124]` — it **omits `generic: 1`**, which the implementation emits via `exitCodeFor()` fallback paths. Minor, but agents branching on exit code should expect `1`.

**Remediation.** Publish this table in `cli-contract.md`; align ADR-033's list to include `1`. Tracking: G33.

---

## Finding CA-4 — `query()` BFF URL resolution order (S1)

**Was undocumented for consumers.** The order matters because a shell, an env var, and a manifest can each supply a URL.

**Implemented** (`src/runtime/base-mfe.ts:872–886`), resolution is first-non-nullish of:

1. `context.inputs.bffUrl` — caller/shell override
2. `deps.bffUrl` — constructor injection
3. `process.env.BFF_URL` — runtime config
4. `manifest.endpoint + manifest.data.serve.endpoint` — derived self-describing URL
5. `manifest.data.serve.endpoint` alone — relative path
6. `'/graphql'` — fallback

```typescript
const servePath  = m.data?.serve?.endpoint ?? '/graphql';
const derivedUrl = m.endpoint ? `${m.endpoint}${servePath}` : servePath;
const bffUrl =
  inputs.bffUrl ?? this.deps.bffUrl ??
  (typeof process !== 'undefined' ? process.env['BFF_URL'] : undefined) ??
  derivedUrl;
```

**Internal drift.** The method's own doc comment (`base-mfe.ts:848–849`) says "`deps.bffUrl → BFF_URL env var → manifest.data.serve.endpoint → '/graphql'`" — it **omits** the highest-priority `context.inputs.bffUrl` and the `manifest.endpoint` composition. The inline numbered comment (`:872–878`) is correct; the summary comment above it is stale.

**Authoritative behavior.** The six-step order above (matching `:883–886`) is canonical.

**Remediation.** Fix the summary comment at `base-mfe.ts:848–849`; document the order in `architecture-bff.md` and the runtime doc. Tracking: G07, G03.

---

## Finding CA-5 — Per-capability lifecycle-state constraints (S2)

**Was unclear.** Docs describe a state machine but not which state each of the ten capabilities requires.

**Implemented** (from `assertState(...)` calls in `src/runtime/base-mfe.ts`):

| Capability | Required state(s) | Line | Note |
|---|---|---|---|
| `load` | `uninitialized`, `ready`, `error` | :596 | re-loadable from `ready`/`error` (retry) — not just initial |
| `render` | `ready` | :618 | |
| `refresh` | `ready` | :640 | |
| `authorizeAccess` | `ready` | :657 | |
| `health` | any except `destroyed` | :676 | observability — works mid-lifecycle |
| `describe` | any except `destroyed` | :695 | observability — works mid-lifecycle |
| `schema` | `ready` | :713 | |
| `query` | `ready` | :731 | |
| `emit` | **any state** (no assertion) | :748–749 | explicitly "Emit can run in any state" |
| `updateControlPlaneState` | `ready`, `rendering` | :789 | may push state mid-render |

**Authoritative behavior.** `emit()` is intentionally unconstrained; `health()`/`describe()` work in any non-terminal state; everything else requires `ready` (with `load` also re-enterable from `ready`/`error`, and `updateControlPlaneState` also valid in `rendering`).

**Remediation.** Add this table to `PLATFORM-CONTRACT.md` / the runtime doc. Tracking: G08, G11.

---

## Finding CA-6 — Lifecycle state-machine transitions vs. README diagram (S2)

**Documented.** README's lifecycle diagram shows `uninitialized → loading → ready → rendering → ready`, with `→ error` and `→ destroyed` branches.

**Implemented** (`src/runtime/base-mfe.ts:180–186`):

```typescript
export const VALID_TRANSITIONS: Record<MFEState, MFEState[]> = {
  uninitialized: ['loading'],
  loading:       ['ready', 'error'],
  ready:         ['loading', 'rendering', 'destroyed'],
  rendering:     ['ready', 'error'],
  error:         ['loading', 'destroyed'],
  destroyed:     [],
};
```

**Drift.** The README diagram does not clearly show two real edges: **`ready → loading`** (reload/refresh) and **`error → loading`** (retry after failure). Both are valid in code.

**Authoritative behavior.** `VALID_TRANSITIONS` is canonical; `transitionState()` (`:276–301`) enforces it, with an optional injected `stateValidator` override.

**Remediation.** Update the README/runtime diagram to include `ready → loading` and `error → loading`. Cross-reference ADR-042. Tracking: G08.

---

## Finding CA-7 — Runtime package path / name drift (S3)

**Documented.** README, `spec.md`, and `CLAUDE.md` refer to the runtime as `packages/runtime/` and import path `@seans-mfe-tool/runtime`.

**Implemented.** The runtime source lives in **`src/runtime/`** (e.g. `src/runtime/base-mfe.ts`, `remote-mfe.ts`); there is no `packages/runtime/` directory. Runtime files are copied into the build output by `scripts/copy-runtime-files.js` (referenced in the `build` script).

**Authoritative behavior.** Author against `src/runtime/`; the published `@seans-mfe-tool/runtime` entry is produced by the copy step at build time.

**Remediation.** Note the source-vs-published distinction in the runtime doc and the IA ownership map; verify the published import path in `architecture-runtime-platform.md`. Tracking: G15 (cross-reference accuracy).

---

## Summary & handoff

| Finding | Severity | Canonical source (code) | Fix tracked by |
|---|:--:|---|---|
| CA-1 Envelope shape | S1 | `packages/contracts/src/envelope.ts:158–173` | G05 |
| CA-2 `--json` behavior | S1 | `packages/oclif-base/src/BaseCommand.ts:43–73` | G06 |
| CA-3 Exit codes | S2 | `packages/contracts/src/envelope.ts:179–190` | G33 |
| CA-4 Query URL order | S1 | `src/runtime/base-mfe.ts:872–886` | G07, G03 |
| CA-5 Capability states | S2 | `src/runtime/base-mfe.ts:596–789` | G08, G11 |
| CA-6 State transitions | S2 | `src/runtime/base-mfe.ts:180–186` | G08 |
| CA-7 Runtime path/name | S3 | `src/runtime/`, `scripts/copy-runtime-files.js` | G15 |

The S1 findings (CA-1, CA-2, CA-4) are the highest-priority targets in the [90-Day Execution Roadmap](./execution-roadmap-90-day.md). CA-4's stale summary comment and CA-6's diagram are small, high-value fixes that can land immediately.
