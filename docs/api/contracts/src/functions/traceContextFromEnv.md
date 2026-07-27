[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / traceContextFromEnv

# Function: traceContextFromEnv()

> **traceContextFromEnv**(`env`): [`TraceContext`](../interfaces/TraceContext.md)

Defined in: packages/contracts/src/observability.ts:181

The trace context this process should emit under.

Inherits from `TRACEPARENT` when a caller set one — becoming a child of that
span — and starts a fresh root trace otherwise. This is what ties a `mesh
build` or an MCP child process (ADR-019) back to the command that spawned it.

The environment is a parameter rather than read from `process.env` so this
module stays free of Node globals and directly testable.

## Parameters

### env

`Record`\<`string`, `string` \| `undefined`\>

## Returns

[`TraceContext`](../interfaces/TraceContext.md)
