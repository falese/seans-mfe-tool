# CLI Contract — Output Envelope, `--json` Mode, and Exit Codes

**Status:** Normative. This is the canonical reference for what every `seans-mfe-tool`
command emits and how it terminates. It supersedes the prose in ADR-018 where the two
disagree — the shapes here are taken directly from the implementation.

**Authoritative sources (code is canonical):**

| Concept | Source of truth |
| --- | --- |
| Envelope shape | `packages/contracts/src/envelope.ts:57–72` |
| Exit codes | `packages/contracts/src/envelope.ts:78–89` |
| `--json` runtime behavior | `packages/oclif-base/src/BaseCommand.ts:43–73` |
| Error classification | `packages/contracts/src/error-classifier.ts` |
| Governing decisions | ADR-016 (BaseCommand), ADR-017 (typed errors), ADR-018 (envelope), ADR-030 (classification) |

> Why this doc exists: the Contract Alignment Pass (CA-1, CA-2) found that ADR-018
> documented an older envelope (`{success, error.code: string, meta}`) while the code
> emits `{ok, error.code: number, warnings[], telemetry}`. Rather than edit the ADR
> mid-flight (forbidden by `CLAUDE.md`), this doc records the **implemented** contract
> and is the reference agents and integrators should code against.

---

## 1. The `CommandResult<T>` envelope

Under `--json`, a command emits **exactly one** `CommandResult<T>` as a single line on
stdout. The type (`envelope.ts:57–72`):

```ts
type CommandResult<T = unknown> = {
  ok: boolean;                 // true on success, false on failure
  data?: T;                    // present only when ok === true
  error?: CommandError;        // present only when ok === false
  warnings: string[];          // always present (possibly empty)
  telemetry: {
    durationMs: number;
    correlationId: string;     // RFC-4122 v4 uuid
  };
};

type CommandError = {
  type: string;                // classifier type, e.g. "validation"
  code: number;                // sysexits exit code (see §3) — a NUMBER, not a string
  message: string;
  retryable: boolean;
  userFacing: boolean;
  details?: unknown;           // present only when extractable (see §4)
};
```

Key invariants:

- `ok` is the success discriminant. **There is no `success` field** (that was the
  pre-remediation name in ADR-018).
- `error.code` is a **number** (the sysexits exit code), not a string error-code.
- `warnings` and `telemetry` are **always** present, including on success.
- On success `data` is set and `error` is absent; on failure `error` is set and `data`
  is absent. The two are mutually exclusive.

### Success example

```json
{"ok":true,"data":{"name":"checkout","version":"1.2.0"},"warnings":[],"telemetry":{"durationMs":42,"correlationId":"7f3c…"}}
```

### Failure example

```json
{"ok":false,"error":{"type":"validation","code":64,"message":"Version must be semver","retryable":false,"userFacing":true,"details":{"field":"version","constraint":"semver"}},"warnings":[],"telemetry":{"durationMs":3,"correlationId":"a91e…"}}
```

Both are produced by the only two constructors — `formatSuccess()`
(`envelope.ts:104–118`) and `formatError()` (`envelope.ts:120–148`). Do not hand-build
envelopes; call these.

---

## 2. `--json` runtime behavior

`BaseCommand.run()` (`packages/oclif-base/src/BaseCommand.ts:43–73`) wraps every command.
When `--json` is present it changes process behavior so the envelope is the **only** thing
on stdout:

1. **stdout is redirected to stderr** (`redirectStdoutToStderr()`, line 50). Any
   `console.log` inside command code — and all progress/log output — goes to **stderr**.
   stdout is reserved for the single envelope line.
2. **chalk/colors are suppressed** (`suppressChalk()`, line 49) so the envelope is clean
   JSON with no ANSI escapes.
3. **interactive prompts are blocked** (`blockInteractivePrompts()`, line 51). A command
   that tries to prompt fails fast rather than hanging — there is no TTY contract under
   `--json`.
4. On success: `formatSuccess(result, warnings, telemetry)` → written via
   `writeJsonLine()` → `process.exit(0)` (lines 57–63).
5. On failure: the thrown error is caught, `formatError()` builds the envelope, it is
   written, and the process exits with the **type-derived sysexits code**
   (`exitCodeFor(envelope.error.type)`, line 69).

`writeJsonLine()` (`packages/oclif-base/src/json-output.ts:62`) writes `json + '\n'`
through the **original** (pre-redirect) stdout handle, guaranteeing exactly one newline-
terminated line regardless of the redirect.

Consequence for integrators and agents:

- Parse **stdout** as a single JSON line. Treat **stderr** as human/log noise.
- Never parse stderr for results. Never expect more than one stdout line.
- In human mode (no `--json`), `runCommand()` runs unchanged and errors propagate to
  oclif's default handler (lines 38–41, 71) — no envelope is emitted.

---

## 3. Exit codes (sysexits-style)

From `EXIT_CODES` (`packages/contracts/src/envelope.ts:78–89`). `exitCodeFor(type)`
(`:97–102`) maps a classifier type to its code, falling back to `unknown` (70):

| Key | Code | Meaning |
| --- | --- | --- |
| `ok` | 0 | Success |
| `generic` | 1 | Unscoped failure (rarely used directly) |
| `usage` | 2 | CLI usage error (bad flags/args) |
| `validation` | 64 | Input failed validation (`ValidationError`) |
| `business` | 65 | Business-rule violation (`BusinessError`) |
| `network` | 66 | Network failure (`NetworkError`) |
| `system` | 69 | System/IO failure (`SystemError`) |
| `unknown` | 70 | Unclassified error (fallback) |
| `security` | 77 | Security violation (`SecurityError`) |
| `timeout` | 124 | Operation timed out (`TimeoutError`) |

The numeric `error.code` in the envelope equals the process exit code. Scripts can branch
on either the parsed `error.type` (string) or `$?` (number).

---

## 4. Error model

Errors are never raw `Error`. Command code throws one of the typed errors from
`@seans-mfe/contracts` (`packages/contracts/src/errors/`): `ValidationError`,
`BusinessError`, `NetworkError`, `SystemError`, `TimeoutError`, `SecurityError`
(ADR-017). `classifyError()` (`error-classifier.ts`) maps the thrown error to a `type`,
and `retryable` / `userFacing` flags, which `formatError()` copies into the envelope
(`envelope.ts:130–137`).

`details` is populated by `buildDetails()` (`envelope.ts:154–166`) when the error carries
structured context, in priority order:

1. `{ field, constraint }` — for `ValidationError`-style errors.
2. `error.details` — passthrough when present.
3. `{ statusCode }` — for HTTP/network errors.
4. otherwise omitted.

---

## 5. MCP relationship

The MCP server spawns `seans-mfe-tool <cmd> --json` per tool call and parses the single
stdout envelope (ADR-019). The guarantees above — one line on stdout, everything else on
stderr, deterministic exit code — are exactly what makes that child-process boundary
reliable. See the [MCP Integration Playbook](./platform-design-review/mcp-integration-playbook.md).

---

## 6. Conformance

A regression test asserts the single-line stdout invariant and the success/error shapes
so the contract cannot silently drift again (tracked under CA-2). Treat any change to the
envelope shape as a breaking change requiring a new ADR and a bump to consumers.

## Related

- [Contract Alignment Pass](./platform-design-review/contract-alignment-pass.md) — CA-1/CA-2/CA-3 findings this doc resolves.
- ADR-016, ADR-017, ADR-018, ADR-030 — see [`spec.md#adr-index`](./spec.md#adr-index).
- [Architecture: current state](./architecture-current-state.md)
</content>
</invoke>
