[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / logEvent

# Function: logEvent()

> **logEvent**(`context`, `severity`, `name`, `attributes?`): [`PlatformEvent`](../interfaces/PlatformEvent.md)

Defined in: [packages/contracts/src/observability.ts:276](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L276)

A point-in-time record — what a log line becomes.

It hangs off the current span as its parent, so a warning emitted during
codegen is attributable to the template render it happened inside. Error
severity also sets error status, so consumers can filter failures on one
field regardless of whether they came from a span or a log.

## Parameters

### context

[`TraceContext`](../interfaces/TraceContext.md)

### severity

[`Severity`](../type-aliases/Severity.md)

### name

`string`

### attributes?

[`Attributes`](../type-aliases/Attributes.md)

## Returns

[`PlatformEvent`](../interfaces/PlatformEvent.md)
