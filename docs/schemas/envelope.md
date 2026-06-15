# CLI Output Envelope

Source of truth: `packages/contracts/src/envelope.ts`.
Canonical prose reference: `docs/cli-contract.md`.

Refs: ADR-018, ADR-054.

---

## Contract statement

Under `--json`, every command writes **exactly one** newline-terminated JSON line to
stdout. That line is a `CommandResult<T>` envelope. Everything else — logs, warnings
printed during execution, progress indicators — goes to stderr.

Parsers must treat the envelope as a single JSON value; they must not split on newlines
within the JSON object itself.

---

## CommandResult\<T\>

```typescript
type CommandResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: CommandError;
  warnings: string[];
  telemetry: {
    durationMs: number;
    correlationId: string;   // UUID v4
  };
};
```

| Field | Type | Always present? | Description |
|---|---|---|---|
| `ok` | `boolean` | yes | `true` on success, `false` on error. |
| `data` | `T` | on success | The command's typed result payload. Shape is command-specific; see `schemas/<cmd>.json`. |
| `error` | `CommandError` | on error | Structured error detail. |
| `warnings` | `string[]` | yes (may be empty) | Advisory messages the command surfaced during execution. |
| `telemetry.durationMs` | `number` | yes | Wall-clock milliseconds from command start to envelope emission. |
| `telemetry.correlationId` | `string` | yes | UUID v4. Shared across log lines emitted to stderr for the same invocation. Use this to correlate structured logs with a result. |

The `ok` field is the authoritative discriminant:

```typescript
if (result.ok) {
  // result.data is present
} else {
  // result.error is present
}
```

---

## CommandError

```typescript
type CommandError = {
  type: string;
  code: number;
  message: string;
  retryable: boolean;
  userFacing: boolean;
  details?: unknown;
};
```

| Field | Type | Description |
|---|---|---|
| `type` | `string` | Error category. One of the keys in `EXIT_CODES`. |
| `code` | `number` | Sysexits exit code (integer). Always a number — never a string. |
| `message` | `string` | Human-readable error message. |
| `retryable` | `boolean` | `true` when the same command may succeed on a subsequent attempt (e.g. network timeouts). |
| `userFacing` | `boolean` | `true` when `message` is safe to display directly to an end user without sanitisation. |
| `details` | `unknown` | Error-type-specific context. See [Details by error type](#details-by-error-type) below. |

---

## Exit codes

The process exit code always matches `error.code` in the envelope. Parsers that do not
parse the envelope can still branch on the exit code alone.

| `error.type` | `error.code` | Sysexits name | Meaning |
|---|---|---|---|
| `ok` | `0` | EX_OK | Success (no error envelope emitted) |
| `generic` | `1` | — | Unclassified error |
| `usage` | `2` | — | Incorrect CLI usage (bad flags, missing args) |
| `validation` | `64` | EX_USAGE | Input failed schema validation |
| `business` | `65` | EX_DATAERR | Valid input, violated business rule |
| `network` | `66` | EX_NOHOST | Upstream HTTP/network error |
| `system` | `69` | EX_UNAVAILABLE | OS or infrastructure error |
| `unknown` | `70` | EX_SOFTWARE | Unrecognised error type |
| `security` | `77` | EX_NOPERM | Authorisation or access-control failure |
| `timeout` | `124` | — | Operation exceeded its deadline |

---

## Details by error type

The `details` field is populated by `buildDetails()` in `envelope.ts` based on which
properties are present on the thrown error.

| Thrown type | `details` shape |
|---|---|
| `ValidationError` | `{ field: string; constraint: string }` |
| `BusinessError` | The error's `.details` property (`Record<string, unknown>`) |
| `NetworkError` | `{ statusCode: number }` |
| `SystemError`, `TimeoutError`, `SecurityError` | `undefined` (unless the error carries a `.details` property) |

---

## --json mode runtime behaviour

When `--json` is passed:

1. **Chalk/color suppression** — `chalk.level` is set to `0`; `NO_COLOR=1` is written to `process.env`.
2. **stdout → stderr redirect** — `console.log`, `console.info`, `console.debug`, and `process.stdout.write` are redirected to stderr. Only `writeJsonLine()` writes to the real stdout.
3. **Interactive prompt blocking** — `process.stdin.isTTY` is set to `false`. If `inquirer.prompt` is called, it throws `SystemError('interactive input disabled in --json mode')` instead of blocking.
4. **Single envelope line** — on success or error, exactly one `\n`-terminated JSON line is written to the real stdout.
5. **process.exit** — always called with the appropriate exit code after the envelope is flushed.

Human-mode (no `--json`): errors are re-thrown so oclif's default handler formats them for the terminal; no envelope is emitted.

---

## Correlation ID (ADR-054)

The `correlationId` is minted once per command invocation using the Web Crypto API
(`globalThis.crypto.randomUUID()`), which is available in both Node ≥18 and browsers.
The `envelope.ts` module deliberately does **not** import Node's `crypto` module so the
package can be bundled into browser shells without a Node-specific polyfill.

---

## Isomorphic note

`@seans-mfe/contracts` is consumed by browser shells (the control-plane protocol). The
`envelope.ts` module is specifically written to be bundleable with rspack/webpack
without `crypto` polyfills. Do not add Node-only imports to `envelope.ts`.
