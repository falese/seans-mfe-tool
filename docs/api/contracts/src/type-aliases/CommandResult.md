[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / CommandResult

# Type Alias: CommandResult\<T\>

> **CommandResult**\<`T`\> = `object`

Defined in: [packages/contracts/src/envelope.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L85)

## Type Parameters

### T

`T` = `unknown`

## Properties

### data?

> `optional` **data**: `T`

Defined in: [packages/contracts/src/envelope.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L87)

***

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: [packages/contracts/src/envelope.ts:88](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L88)

***

### ok

> **ok**: `boolean`

Defined in: [packages/contracts/src/envelope.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L86)

***

### telemetry

> **telemetry**: `object`

Defined in: [packages/contracts/src/envelope.ts:90](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L90)

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

Defined in: [packages/contracts/src/envelope.ts:89](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L89)
