[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / TraceContext

# Interface: TraceContext

Defined in: packages/contracts/src/observability.ts:73

The identity a record is emitted under, threaded through a call path.

## Properties

### parentSpanId?

> `optional` **parentSpanId**: `string`

Defined in: packages/contracts/src/observability.ts:76

***

### sampled?

> `optional` **sampled**: `boolean`

Defined in: packages/contracts/src/observability.ts:78

Whether downstream should record. Absent means yes.

***

### spanId

> **spanId**: `string`

Defined in: packages/contracts/src/observability.ts:75

***

### traceId

> **traceId**: `string`

Defined in: packages/contracts/src/observability.ts:74
