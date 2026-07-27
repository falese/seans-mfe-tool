[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / TraceContext

# Interface: TraceContext

Defined in: [packages/contracts/src/observability.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L73)

The identity a record is emitted under, threaded through a call path.

## Properties

### parentSpanId?

> `optional` **parentSpanId**: `string`

Defined in: [packages/contracts/src/observability.ts:76](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L76)

***

### sampled?

> `optional` **sampled**: `boolean`

Defined in: [packages/contracts/src/observability.ts:78](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L78)

Whether downstream should record. Absent means yes.

***

### spanId

> **spanId**: `string`

Defined in: [packages/contracts/src/observability.ts:75](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L75)

***

### traceId

> **traceId**: `string`

Defined in: [packages/contracts/src/observability.ts:74](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L74)
