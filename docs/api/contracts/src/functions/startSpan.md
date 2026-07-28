[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / startSpan

# Function: startSpan()

> **startSpan**(`context`, `name`, `attributes?`): [`PlatformEvent`](../interfaces/PlatformEvent.md)

Defined in: [packages/contracts/src/observability.ts:227](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L227)

Begin a span. Pair with `endSpan` to give it a duration and an outcome.

## Parameters

### context

[`TraceContext`](../interfaces/TraceContext.md)

### name

`string`

### attributes?

[`Attributes`](../type-aliases/Attributes.md)

## Returns

[`PlatformEvent`](../interfaces/PlatformEvent.md)
