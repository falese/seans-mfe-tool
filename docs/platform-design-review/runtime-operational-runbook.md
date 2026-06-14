# Runtime & Lifecycle Operational Runbook

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#220)
**Audience:** Operators and integrators running MFEs in a shell — diagnosing why a unit won't load, render, or respond.
**Grounding:** ADR-041 (lifecycle state machine), ADR-042 (hook execution semantics), `src/runtime/base-mfe.ts`. Contract specifics are in the [Contract Alignment Pass](./contract-alignment-pass.md).

This is operator-grade: every symptom maps to a cause in code (with `file:line`) and a concrete action. It does not restate the architecture — see [`architecture-runtime-platform.md`](../architecture-runtime-platform.md) for that.

---

## 1. The lifecycle at a glance

States and the **only** legal transitions (`base-mfe.ts:180–186`):

```
uninitialized → loading
loading       → ready | error
ready         → loading | rendering | destroyed
rendering     → ready | error
error         → loading | destroyed
destroyed     → (terminal)
```

Two edges operators miss because the README diagram under-shows them: **`ready → loading`** (reload) and **`error → loading`** (retry). Both are legal (CA-6).

Transitions are enforced by `transitionState()` (`base-mfe.ts:276–303`); an illegal one throws `Invalid state transition: <from> → <to>. Valid transitions: …`. Every transition is appended to `stateHistory` with a timestamp (`:298–302`) — that history is your primary forensic record.

---

## 2. Lifecycle troubleshooting

| Symptom (what you observe) | Likely cause | Where (code) | Action |
|---|---|---|---|
| `Invalid state: expected ready, got loading` | A capability was called before `load()` completed | `assertState()` `base-mfe.ts:258–270` | Await `load()` resolution before `render`/`refresh`/`query`/`schema`; check the host orchestrator sequencing |
| `Invalid state transition: ready → rendering` never happens | `render()` threw in a `before`/`main` hook and the MFE went `rendering → error` | `:282–293`, hook exec `:316+` | Inspect `stateHistory` for the `→ error` entry; read the emitted hook-failure telemetry (§3) |
| MFE stuck in `loading` | `load()` hook awaiting a promise that never resolves (e.g. network) | hook `main` phase | Check `BFF_URL`/endpoint resolution (§4); add a timeout; expect a `TimeoutError` envelope, exit 124 |
| `error` and won't recover | Operator never re-issued `load()` | `error → loading` is legal `:184` | Re-invoke `load()` (retry path) rather than recreating the instance |
| Capability silently does nothing | It ran in a non-`main` hook phase that is allowed to fail (see §3) | `:378–381` | Check stderr telemetry for a `warn`-severity hook failure |
| `Re-entrant lifecycle detected for capability=… phase=…` on stderr | A hook re-entered the same capability/phase | guard `:321–325` | Remove the recursive call; the runtime skips it to prevent infinite loops |

**First place to look, always:** the instance's `stateHistory`. The sequence of `{from, to, timestamp}` tells you exactly where the lifecycle diverged.

---

## 3. Handler & hook failure modes (ADR-042 / REQ-042 / REQ-045)

Each capability runs hooks in phases: **`before` → `main` → `after`**, with an **`error`** phase on failure. The failure semantics differ by phase and by the `contained` flag:

| Phase | On handler throw | Severity emitted | Lifecycle effect |
|---|---|---|---|
| `before` | Continue to next handler; do not abort capability | `warn` | none (best-effort) |
| `main` | **Propagates** — capability fails | `error` | transitions toward `error` |
| `after` | Continue to next handler | `warn` | none |
| `error` | Continue to next handler | `warn` | none |
| any, with `contained: true` | Caught and downgraded | `warn` | none — failure is swallowed by design |

Grounded in `base-mfe.ts:378–420`: handler arrays execute **sequentially** (`:389–396`); the `contained` flag wraps a handler in try/catch and downgrades it to a `warn` (`:398–407`); main-phase failures use `error` severity, all other phases use `warn` (`:413`).

**Diagnostic output.** Every hook failure calls `emitHookFailure(...)` (`base-mfe.ts:531+`). If a `telemetry` dependency is injected it receives a structured event (`{ hookName, handlerName, severity, … }`); otherwise the runtime logs `[Telemetry] { … }` to **stderr** as JSON. So:

- **Missing telemetry sink?** Failures still appear on stderr — grep for `[Telemetry]`.
- **A capability "half-worked"?** A `before`/`after` handler failed `warn`-only; the `main` result is still valid. Confirm via the severity in the event.

### Platform vs. custom handler resolution

`invokeHandler()` (`base-mfe.ts:432+`) resolves `platform.<name>` from the runtime standard library (`./handlers`, `:475–506`) and `custom.<name>` from the developer's MFE class. Common failure:

- `Platform handler not implemented: platform.<name>. Expected method do<Name> on MFE class.` (`:503–504`) → the manifest references a platform handler the runtime doesn't ship, **or** a custom handler whose method name doesn't match the `do<Capability>` convention. Fix the manifest handler name or implement the method.
- `Failed to import platform handlers: <msg>` (`:500–501`) → the runtime build is missing `dist/runtime/handlers` (see CLAUDE.md: rebuild with `npm run build && npm run docker:build:cli` after any `src/runtime/**` change).

---

## 4. Capability execution diagnostics

### 4.1 Which state does each capability require?

(From the `assertState(...)` calls — see [Contract Alignment Pass CA-5](./contract-alignment-pass.md#finding-ca-5--per-capability-lifecycle-state-constraints-s2).) Quick reference:

- `ready`-only: `render`, `refresh`, `authorizeAccess`, `schema`, `query`
- any non-terminal: `health`, `describe`
- any state: `emit` (never asserts)
- `ready`/`rendering`: `updateControlPlaneState`
- `uninitialized`/`ready`/`error`: `load`

If a capability errors with `Invalid state`, this table tells you the precondition you violated.

### 4.2 `query()` returns nothing / hits the wrong BFF

`query()` resolves the BFF URL in this order (`base-mfe.ts:872–886`, CA-4):

1. `context.inputs.bffUrl` (caller/shell override) →
2. `deps.bffUrl` (injection) →
3. `process.env.BFF_URL` →
4. `manifest.endpoint + manifest.data.serve.endpoint` →
5. `manifest.data.serve.endpoint` →
6. `'/graphql'`

**Diagnostic ladder:** if queries hit the wrong host, something *higher* in this list is set. Check `BFF_URL` in the environment and any `bffUrl` the shell passes in `inputs` before blaming the manifest. (Note the stale summary comment at `:848–849` omits steps 1 and 4 — trust the numbered order, CA-4.)

### 4.3 `emit()` "works" in a broken MFE

`emit()` is intentionally unconstrained (`:748–749`, "Emit can run in any state") — it will fire even from `error`/`uninitialized`. Don't infer health from a successful `emit`; use `health()`/`describe()`.

---

## 5. Operator workflows (worked examples)

### Workflow A — "The MFE won't render"

1. Call `describe()` (legal in any non-terminal state) → confirm the instance is alive and read its reported state.
2. Inspect `stateHistory`: did it reach `ready`? If it's in `error`, find the `→ error` entry's timestamp.
3. Grep stderr around that timestamp for `[Telemetry]` → identify the failing `handlerName` and phase.
4. If phase is `main`, fix the handler; if `before`/`after`, the render likely succeeded and the warning is non-fatal.
5. Recover with `load()` (legal from `error`) — do **not** rebuild the instance.

### Workflow B — "Queries fail in one environment only"

1. Print the effective `BFF_URL` and any shell-passed `inputs.bffUrl`.
2. Walk the §4.2 ladder top-down; the first non-nullish wins.
3. If only the manifest is set and it's wrong, the env/shell isn't overriding as expected — that's the bug.

### Workflow C — "Capability throws `Invalid state`"

1. Read the error: `expected <X>, got <Y>`.
2. Cross-check §4.1 for the capability's required state.
3. Fix call ordering (usually a missing `await load()` or calling `render` after `destroy`).

---

## 6. Escalation

| Class | Exit code | Operator action |
|---|:--:|---|
| `ValidationError` | 64 | Fix input/manifest, retry |
| `BusinessError` | 65 | Do not blind-retry; domain rule rejected the request |
| `NetworkError` | 66 | Retry with backoff; check BFF reachability (§4.2) |
| `TimeoutError` | 124 | Increase timeout / investigate the stuck hook |
| `SystemError` | 69 | Environment/IO — escalate (e.g. missing runtime handlers) |
| `SecurityError` | 77 | Escalate; do not retry |

Codes are canonical in `packages/contracts/src/envelope.ts:179–190` (CA-3). For the full envelope shape an operator parses, see [CA-1](./contract-alignment-pass.md#finding-ca-1--commandresultt-envelope-shape-s1).

---

*This runbook is informative (operational guidance). The normative sources are ADR-041, ADR-042, and the cited code; where they disagree with older prose, the code wins (per the Contract Alignment Pass).*
