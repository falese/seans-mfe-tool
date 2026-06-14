# Error Hierarchy

Source of truth: `packages/contracts/src/errors/` (classes), `packages/contracts/src/error-classifier.ts` (classifier).

Refs: ADR-030.

---

## Design rule

**Never `throw new Error()`** in platform code. Use the typed error classes below.
The classifier maps every thrown error to a `type` string, which determines the exit
code and the `retryable`/`userFacing` flags in the CLI envelope (see
[envelope.md](envelope.md)).

---

## Error class reference

### ValidationError

```typescript
class ValidationError extends Error {
  readonly type = 'validation';
  readonly retryable = false;
  readonly userFacing = true;
  field: string;
  constraint: string;
}
new ValidationError(message, field, constraint)
```

| Property | Value | Description |
|---|---|---|
| `type` | `'validation'` | Classifies as validation failure |
| `retryable` | `false` | The same input will fail again |
| `userFacing` | `true` | Message is safe to show to the end user |
| `field` | caller-supplied | The input field that failed (e.g. `'context.inputs.document'`) |
| `constraint` | caller-supplied | The violated constraint (e.g. `'required'`, `'min-length'`) |

**Exit code:** 64. **Details in envelope:** `{ field, constraint }`.

**When to use:** Input that fails schema validation — missing required fields, wrong
types, out-of-range values.

---

### BusinessError

```typescript
class BusinessError extends Error {
  readonly type = 'business';
  readonly retryable = false;
  code: string;
  details: Record<string, unknown>;
}
new BusinessError(message, code, details?)
```

| Property | Value | Description |
|---|---|---|
| `type` | `'business'` | Classifies as business-rule violation |
| `retryable` | `false` | The same valid input violates an invariant |
| `code` | caller-supplied | Machine-readable domain code (e.g. `'GAME_ALREADY_STARTED'`) |
| `details` | caller-supplied | Structured context (e.g. `{ gameId, state }`) |

**Exit code:** 65. **Details in envelope:** the `.details` record.

**When to use:** Valid input that violates a domain constraint — e.g. attempting to
start a game session that is already running.

---

### NetworkError

```typescript
class NetworkError extends Error {
  readonly type = 'network';
  readonly retryable = true;
  statusCode: number;
}
new NetworkError(message, statusCode)
```

| Property | Value | Description |
|---|---|---|
| `type` | `'network'` | Classifies as upstream communication failure |
| `retryable` | `true` | A subsequent attempt may succeed |
| `statusCode` | caller-supplied | HTTP status from the upstream response (e.g. `503`) |

**Exit code:** 66. **Details in envelope:** `{ statusCode }`.

**When to use:** Upstream HTTP errors, unreachable services, BFF fetch failures.

---

### SystemError

```typescript
class SystemError extends Error {
  readonly type = 'system';
  readonly retryable = true;
  cause?: unknown;
}
new SystemError(message, cause?)
```

| Property | Value | Description |
|---|---|---|
| `type` | `'system'` | Classifies as infrastructure or OS failure |
| `retryable` | `true` | The condition may be transient |
| `cause` | optional | Underlying error or reason |

**Exit code:** 69. **Details in envelope:** none (unless `cause` carries a `.details` property).

**When to use:** File system errors, process spawn failures, infrastructure unavailability.
Also used by `--json` mode to signal that interactive prompts are disabled.

---

### TimeoutError

```typescript
class TimeoutError extends Error {
  readonly type = 'timeout';
  readonly retryable = true;
  timeout: number;
  elapsed: number;
}
new TimeoutError(message, timeout, elapsed)
```

| Property | Value | Description |
|---|---|---|
| `type` | `'timeout'` | Classifies as deadline exceeded |
| `retryable` | `true` | Retry may succeed if conditions improve |
| `timeout` | caller-supplied | Configured deadline in milliseconds |
| `elapsed` | caller-supplied | Actual elapsed time in milliseconds |

**Exit code:** 124.

**When to use:** Operations that exceed a configured deadline — BFF requests, MFE
capability calls, health checks.

---

### SecurityError

```typescript
class SecurityError extends Error {
  readonly type = 'security';
  readonly retryable = false;
  details?: Record<string, unknown>;
}
new SecurityError(message, details?)
```

| Property | Value | Description |
|---|---|---|
| `type` | `'security'` | Classifies as access-control failure |
| `retryable` | `false` | The caller is not authorised regardless of retry |
| `userFacing` | `'Access denied'` | Fixed safe message |
| `details` | optional | Internal context (not forwarded to users) |

**Exit code:** 77.

**When to use:** JWT validation failures, capability `authorizeAccess` rejections,
forbidden operations.

---

## Quick-reference table

| Class | `type` | Exit | `retryable` | `userFacing` | Key extra props |
|---|---|---|---|---|---|
| `ValidationError` | `validation` | 64 | false | true | `field`, `constraint` |
| `BusinessError` | `business` | 65 | false | false | `code`, `details` |
| `NetworkError` | `network` | 66 | true | false | `statusCode` |
| `SystemError` | `system` | 69 | true | false | `cause?` |
| `TimeoutError` | `timeout` | 124 | true | false | `timeout`, `elapsed` |
| `SecurityError` | `security` | 77 | false | false | `details?` |

---

## Error classifier

`classifyError(error, config)` in `packages/contracts/src/error-classifier.ts` maps
any thrown value to an `ErrorClassification`.

### ErrorClassification

```typescript
interface ErrorClassification {
  type: string;       // matches EXIT_CODES key
  retryable: boolean;
  userFacing: boolean | string;
  auditLog: boolean;
  userMessage?: string;
}
```

### Classification logic

1. If the error has a `.type` string property that is a key in `EXIT_CODES`, that type is used directly. This is the path for all typed errors in the hierarchy above.
2. Otherwise, pattern matching against `config.types` entries (message/name regex patterns) is attempted.
3. If no pattern matches, the error is classified as `type: 'unknown'` (exit 70).

### formatErrorResponse

`formatErrorResponse(error, config)` returns a user-safe message string. If
`classification.userFacing` is a string, that string is returned verbatim. If `true`,
the error message is returned. If `false`, a generic `'An unexpected error occurred'`
message is returned.

---

## Importing

```typescript
import {
  ValidationError,
  BusinessError,
  NetworkError,
  SystemError,
  TimeoutError,
  SecurityError,
} from '@seans-mfe/contracts';
```
