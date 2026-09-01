---
id: 0081
title: One OpenTelemetry-shaped event schema for the whole platform, propagated by W3C trace context
status: Accepted
impl:
  stage: phased
  refs: ["#322"]
date: 2026-07-27
deciders: [sean]
area: Observability / contracts / CLI
enforcement: code
tags: [observability, telemetry, opentelemetry, tracing, contracts, logging, cli]
relates-to: [16, 18, 26, 39, 54, 56]
supersedes: [39]
superseded-by: []
implements-pdr: []
implemented-by:
  - packages/contracts/src/observability.ts
  - packages/oclif-base/src/logger.ts
  - packages/oclif-base/src/BaseCommand.ts
verified-by:
  - packages/contracts/src/__tests__/observability.test.ts
  - packages/oclif-base/src/__tests__/logger.test.ts
tracked-by: []
summary: >-
  Every surface of the platform — CLI, codegen, control plane, MFE runtime, BFF — describes itself
  with one PlatformEvent type shaped as an OpenTelemetry span or log record, correlated by a W3C
  trace context that propagates across process boundaries, with no @opentelemetry/* dependency in
  any package the browser loads.
rationale-summary: >-
  The platform already emits OpenTelemetry from its BFF layer and already emits span-shaped data
  from its runtime, but under three unrelated correlation ids that never join up, so no one can
  ask what a single build or a single user action did across surfaces. Adopting the OTel data
  shape rather than the OTel SDK gets the vocabulary and the tooling compatibility without putting
  an external dependency inside a federated browser bundle.
long-form: true
---

## Context

Five surfaces of this platform produce observability data. Four of them invented
their own shape.

| Surface | What it emits | Where |
| --- | --- | --- |
| MFE runtime | `TelemetryEvent` — `{name, capability, phase, user?, duration?, status, metadata?, timestamp}` | `packages/runtime/src/context.ts:126` |
| CLI | `CommandResult.telemetry` — `{durationMs, correlationId}` | `packages/contracts/src/envelope.ts:62` |
| Control plane | `MessageMetadata` — `{correlationId, acknowledged, error}` | `packages/contracts/src/messages.ts:220` |
| BFF / Mesh | **OpenTelemetry**, via `@graphql-mesh/plugin-opentelemetry` | `packages/dsl/src/schema.ts:300` |
| Codegen, CI | unstructured `console.*` | ~55 call sites in `packages/codegen`, `packages/plugin-bff` |

Three observations forced this decision.

**The runtime is already emitting spans, without a span type.** ADR-026's load
capability runs three subphases, each with a start time, a duration, a status
and a parent operation. `LoadResult.telemetry.{entry, mount, enableRender}` is a
span tree flattened into a struct because there was nothing else to put it in.
Verifying ADR-026's criteria (#318) meant asserting on the flattened form.

**`correlationId` is a trace id doing three unrelated jobs.** `BaseCommand.ts:63`
mints one per command invocation. `buildMessage` (`messages.ts:333`) mints one
per control-plane message. The runtime uses `Context.requestId`. None of them is
derived from another, so a `render` cannot be attributed to the `remote:generate`
that produced the MFE, and an action echoed by the daemon cannot be tied to the
capability call that sent it. `base-remote-mfe.ts:572` reads
`inputs.correlationId ?? context.requestId` — the join trying to exist, in one
direction, in one file.

**OpenTelemetry is already in the request path.** `observability.opentelemetry`
in the DSL renders `@graphql-mesh/plugin-opentelemetry` into every generated
BFF's `.meshrc.yaml`. Any event vocabulary invented next to it would be a second
vocabulary describing the same request.

Meanwhile ADR-039 mandated a structured logger that was never built, on a
rationale that has since stopped being true. It exists because "`console.log` in
`--json` mode corrupts stdout and breaks the `CommandResult<T>` contract" — but
`redirectStdoutToStderr()` (`packages/oclif-base/src/json-output.ts:28`) already
patches `console.log`/`info`/`debug` and `process.stdout.write` to stderr in
`--json` mode, with `writeJsonLine` bypassing the redirect for the envelope.
ADR-018's implementation owns that contract. A logger is still worth having, but
for structure and correlation, not for safety — and ADR-039 scoped it as a CLI
concern when the gap is platform-wide.

## Decision

### 1. One event type, shaped as an OpenTelemetry span or log record

`PlatformEvent` in `@seans-mfe/contracts` is the only shape any surface emits.
It carries what OTel carries: identity (`traceId`, `spanId`, `parentSpanId`),
a `name`, timing (`startTime`, `duration`), a `status` of `unset | ok | error`,
a `severity` for log-shaped records, and free-form `attributes`.

A record with a `duration` reads as a span; one without reads as a log event.
Both travel the same channel, because splitting logs from traces at the
producer is what makes them impossible to join at the consumer.

### 2. W3C trace context is the correlation id, and it propagates

The three `correlationId` fields converge on one 16-byte trace id, formatted and
parsed as a W3C `traceparent`. It is minted once at the outermost boundary and
inherited everywhere below:

- the CLI adopts `TRACEPARENT` from the environment if present, else mints one;
- anything it spawns — `mesh build`, `npm install`, an MCP child process
  (ADR-019) — inherits it through that same environment variable;
- the control plane carries it in `MessageMetadata`;
- the runtime carries it on `Context`;
- the BFF's Mesh plugin already emits under whatever context it receives.

This is the part that does not exist today and the part that makes the schema
worth more than the sum of its emitters.

### 3. The shape, not the SDK — no `@opentelemetry/*` anywhere

`packages/contracts` and `packages/runtime` take **no** OpenTelemetry
dependency. The runtime is federated into a browser bundle, and `boundary.test.ts`
(ADR-056, tightened by #235) requires barrel-reachable runtime modules to import
nothing of the sort.

`PlatformEvent` is therefore structurally OTel-compatible and nothing more: the
mapping to `@opentelemetry/api`'s `Span` is documented below, and an exporter
that performs it is a separate, Node-only package built when a collector is
actually wanted. Adopting the SDK's own `Span` type as the platform interface
was rejected for exactly the boundary reason.

### 4. Attribute naming follows OTel semantic conventions, then a platform namespace

Where a convention exists, use it — `service.name`, `service.version`,
`error.type`. Where none does, namespace by surface: `cli.command`,
`codegen.template`, `mfe.id`, `mfe.capability`, `mfe.phase`, `slot.address`.
Attribute values are the OTel primitive set (string, number, boolean, and
homogeneous arrays of those), because anything else cannot be exported without
lossy coercion.

### 5. The structured logger is one emitter of this schema

ADR-039's logger is built, in `@seans-mfe/oclif-base` as that ADR said — but as
a `PlatformEvent` emitter writing JSON lines to **stderr unconditionally**,
rather than a CLI logging convenience. Writing to stderr directly makes it
correct whether or not the `--json` redirect is active, instead of depending on
a monkey-patch for its correctness.

Library code with no output seam of its own — `packages/codegen`,
`packages/plugin-bff` — emits through it. Commands keep `this.log()` and their
deliberate human-readable rendering.

## Boundaries

- **This does not migrate every `console.*` call.** #322 counted ~292 and read
  them as one backlog. Sorting them by why they exist leaves far less than that:

  | Group | Count | Why it stays, or what it needs |
  | --- | --- | --- |
  | Commands rendering for a human | ~270 | Tables, file lists, next-step hints. A structured emitter is the wrong instrument, and `--json` already redirects them. |
  | `packages/runtime` | 4 | Browser code; `console.error`/`warn` only, never stdout. See below. |
  | `packages/plugin-bff/src/shared.ts` | 4 | `✓ Generated …` progress lines. Same category as the commands — they are rendering, called from a command. |
  | `packages/codegen` | 14 | Genuine library diagnostics. Blocked on a seam — see below. |

- **Codegen needs an injection seam before it can emit.** Its 14 diagnostics are
  the one group that should become events: a missing template today is a string
  on stderr with nothing tying it to the generation that hit it.
  `packages/codegen` must not depend on `@seans-mfe/oclif-base` to say so — that
  inverts the layering and drags an oclif peer into a pure generator — so the
  logger has to arrive by injection, the way the runtime already takes
  `deps.telemetry`. That is a follow-up, and it is why this ADR is `phased`
  rather than `Implemented`.

- **The emitter cannot live in `@seans-mfe/contracts`.** Its barrel is consumed
  by browser shells and `package-exports.test.ts` requires every module in that
  package to be re-exported from it, so a `process.stderr` writer there would
  reach a browser bundle. The schema lives in contracts; the writing lives in
  `@seans-mfe/oclif-base`, exactly where ADR-039 said it would.
- **`packages/runtime` keeps its four `console.error`/`console.warn` calls.**
  They are browser code, they never touched stdout, and the emitter lives in an
  oclif package that must not enter a federated bundle. The runtime's adoption
  of `PlatformEvent` is a follow-up that goes through its existing injected
  `deps.telemetry` seam, not through this logger.
- **`CommandResult.telemetry` keeps `correlationId`.** ADR-018's envelope is a
  published contract with generated schemas behind it; `traceId` is added
  alongside as an optional field rather than replacing anything.
- **No sampling, batching, or export in this decision.** Emitters write; whoever
  consumes decides. Sampling belongs with the exporter, where the BFF already
  configures it (`sampling.probability`).

- **A fire-and-forget hook sink is still truncated under `--json`.** `postrun`
  hooks now run on that path — they did not, because `run()` exits once the
  envelope is written and oclif fires `postrun` after the command returns. But
  the daemon hook does not await its own emission ("never delay the CLI"), and
  `process.exit` arrives before the socket does. Measured against a listener:

  | | connections reaching the daemon |
  | --- | --- |
  | human mode | 2 |
  | `--json` | 0 |

  This is why the command span is emitted **synchronously to stderr** rather
  than pushed anywhere: a sink that races the exit is a sink that loses the
  events it was added to capture. Making the daemon push survive means either
  awaiting it (up to the 2s connect timeout, bounded by the 60s offline cache)
  or a bounded flush window before exit — a trade between CLI latency and
  telemetry completeness that this ADR does not settle.
- **Not a metrics decision.** Prometheus config already exists separately in the
  DSL (`PrometheusConfigSchema`) and is untouched.

## Mapping to OpenTelemetry

For the exporter that will eventually be written, and as the definition of
"OTel-shaped":

| `PlatformEvent` | OTel |
| --- | --- |
| `traceId`, `spanId`, `parentSpanId` | `SpanContext.traceId` / `spanId`, parent link |
| `name` | `Span.name` |
| `startTime`, `duration` | `Span.startTime`, `endTime = startTime + duration` |
| `status` | `SpanStatusCode.UNSET` / `OK` / `ERROR` |
| `attributes` | `Span.attributes` |
| `severity` (no `duration`) | `LogRecord.severityNumber` |

## Consequences

**Better.** One question — "what happened during this build / this render / this
action" — becomes answerable across surfaces for the first time. The runtime's
existing span-shaped data gets a type that admits it. Generated BFFs already
speaking OTel stop being an island. Library warnings that were `console.warn`
strings become queryable records with a trace id on them.

**Worse, and knowingly accepted.** A second event vocabulary exists during
migration: `TelemetryEvent` and `MessageMetadata` keep their current shapes until
their follow-ups land, so for a while the platform has both the new schema and
the old fields. The alternative — changing the ADR-018 envelope, the ADR-054 wire
protocol and every generated MFE in one change — is a worse risk than a
transition period.

**The cost.** Maintaining a hand-written OTel-compatible type means tracking a
spec we do not import. If OTel changes its data model the mapping table above
goes stale silently; no gate can catch that. Accepted because the alternative
puts an external dependency inside a federated browser bundle, which ADR-056
forbids for stronger reasons than convenience.

## References

- ADR-018 — the `CommandResult<T>` envelope whose `telemetry` field gains an
  optional trace id.
- ADR-039 — mandated a structured logger in `@seans-mfe/oclif-base` that was
  never built; superseded because its stdout-safety rationale is now handled by
  ADR-018's redirect, and the real gap is platform-wide rather than CLI-local.
- ADR-016 — `BaseCommand`, where the trace context is minted or adopted.
- ADR-026 — the atomic load capability whose subphase timings are the clearest
  existing example of span-shaped data without a span type.
- ADR-054 — the control-plane message protocol carrying `correlationId` today.
- ADR-056 — the presentation boundary whose dependency rule keeps the OTel SDK
  out of the runtime.
- #322 — the tracking issue, refiled from "the logger does not exist" to this.
