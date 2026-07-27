[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / parseTraceparent

# Function: parseTraceparent()

> **parseTraceparent**(`header`): [`TraceContext`](../interfaces/TraceContext.md) \| `undefined`

Defined in: packages/contracts/src/observability.ts:156

Parse a `traceparent`, returning `undefined` for anything malformed.

Undefined rather than throwing: an unparseable inherited header means we
start a new trace, which is a recoverable loss of correlation. Failing a
command because a caller passed a bad env var would not be.

## Parameters

### header

`string` | `undefined`

## Returns

[`TraceContext`](../interfaces/TraceContext.md) \| `undefined`
