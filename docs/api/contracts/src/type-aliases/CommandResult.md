[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / CommandResult

# Type Alias: CommandResult\<T\>

> **CommandResult**\<`T`\> = `object`

Defined in: [packages/contracts/src/envelope.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L92)

## Type Parameters

### T

`T` = `unknown`

## Properties

### data?

> `optional` **data**: `T`

Defined in: [packages/contracts/src/envelope.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L94)

***

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: [packages/contracts/src/envelope.ts:95](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L95)

***

### ok

> **ok**: `boolean`

Defined in: [packages/contracts/src/envelope.ts:93](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L93)

***

### telemetry

> **telemetry**: `object`

Defined in: [packages/contracts/src/envelope.ts:97](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L97)

#### correlationId

> **correlationId**: `string`

#### durationMs

> **durationMs**: `number`

#### traceId?

> `optional` **traceId**: `string`

W3C trace id for this invocation (ADR-081), tying the envelope to the
events the command emitted and to anything it spawned.

Optional because this envelope is a published contract (ADR-018) with
generated schemas behind it: `correlationId` stays, and consumers that
predate tracing keep working.

***

### warnings

> **warnings**: `string`[]

Defined in: [packages/contracts/src/envelope.ts:96](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L96)
