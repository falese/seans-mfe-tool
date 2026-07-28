[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / endSpan

# Function: endSpan()

> **endSpan**(`span`, `options`): [`PlatformEvent`](../interfaces/PlatformEvent.md)

Defined in: [packages/contracts/src/observability.ts:253](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L253)

Close a span: stamp its duration, outcome, and — when it failed — the error
type and message, under the OTel-conventional `error.type` attribute.

## Parameters

### span

[`PlatformEvent`](../interfaces/PlatformEvent.md)

### options

[`EndSpanOptions`](../interfaces/EndSpanOptions.md)

## Returns

[`PlatformEvent`](../interfaces/PlatformEvent.md)
