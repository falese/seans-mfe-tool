[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / Context

# Interface: Context

Defined in: [packages/runtime/src/context.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L41)

Shared context object that flows through all lifecycle phases
and across multiple capability invocations (load → render → query → emit)

## Indexable

\[`key`: `string`\]: `unknown`

Backward-compat escape hatch: handlers historically wrote their state as
ad-hoc top-level fields (context.retry, context.timeouts, …). Those writes
keep compiling via this index signature; new code should use `extensions`.

## Properties

### capability?

> `optional` **capability**: `string`

Defined in: [packages/runtime/src/context.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L82)

Current capability being executed — one of the ten platform capabilities
(single-sourced in @falese/smt-contracts, ADR-080) or a domain capability
name, which is why the union stays open.

***

### emit()?

> `optional` **emit**: (`event`) => `Promise`\<`void`\>

Defined in: [packages/runtime/src/context.ts:104](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L104)

Telemetry emit function (injected by the engine, not handler state)

#### Parameters

##### event

[`TelemetryEvent`](TelemetryEvent.md)

#### Returns

`Promise`\<`void`\>

***

### error?

> `optional` **error**: `Error`

Defined in: [packages/runtime/src/context.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L87)

Error that triggered error phase

***

### extensions?

> `optional` **extensions**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/context.ts:113](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L113)

Handler-owned extension state, namespaced per handler. The shapes are
declared by the owning modules (e.g. RetryState in retry-wrapper.ts,
TimeoutState in timeout-wrapper.ts) — the core Context stays agnostic.

***

### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [packages/runtime/src/context.ts:67](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L67)

HTTP headers (for auth, content-type, etc.)

***

### inputs?

> `optional` **inputs**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/context.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L59)

Inputs for the current capability (set before execution)

***

### jwt?

> `optional` **jwt**: `string`

Defined in: [packages/runtime/src/context.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L48)

JWT token for authentication

***

### outputs?

> `optional` **outputs**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/context.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L62)

Outputs from capability execution (populated during/after)

***

### phase?

> `optional` **phase**: `"error"` \| `"before"` \| `"main"` \| `"after"`

Defined in: [packages/runtime/src/context.ts:75](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L75)

Current lifecycle phase

***

### query?

> `optional` **query**: `Record`\<`string`, `string`\>

Defined in: [packages/runtime/src/context.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L70)

Query parameters from request URL

***

### requestId

> **requestId**: `string`

Defined in: [packages/runtime/src/context.ts:51](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L51)

Unique request identifier for tracing

***

### retryCount?

> `optional` **retryCount**: `number`

Defined in: [packages/runtime/src/context.ts:90](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L90)

Number of retry attempts for current capability

***

### telemetry?

> `optional` **telemetry**: `object`

Defined in: [packages/runtime/src/context.ts:95](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L95)

Telemetry data for observability

#### duration?

> `optional` **duration**: `number`

#### endTime?

> `optional` **endTime**: `number`

#### events?

> `optional` **events**: [`TelemetryEvent`](TelemetryEvent.md)[]

#### startTime?

> `optional` **startTime**: `number`

#### subphases?

> `optional` **subphases**: `Record`\<`string`, \{ `duration`: `number`; `start`: `number`; \}\>

***

### timestamp

> **timestamp**: `Date`

Defined in: [packages/runtime/src/context.ts:54](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L54)

Request timestamp

***

### user?

> `optional` **user**: [`UserContext`](UserContext.md)

Defined in: [packages/runtime/src/context.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L45)

Authenticated user information
