[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / CommandResult

# Type Alias: CommandResult\<T\>

> **CommandResult**\<`T`\> = `object`

Defined in: packages/contracts/src/envelope.ts:57

## Type Parameters

### T

`T` = `unknown`

## Properties

### data?

> `optional` **data**: `T`

Defined in: packages/contracts/src/envelope.ts:59

***

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: packages/contracts/src/envelope.ts:60

***

### ok

> **ok**: `boolean`

Defined in: packages/contracts/src/envelope.ts:58

***

### telemetry

> **telemetry**: `object`

Defined in: packages/contracts/src/envelope.ts:62

#### correlationId

> **correlationId**: `string`

#### durationMs

> **durationMs**: `number`

***

### warnings

> **warnings**: `string`[]

Defined in: packages/contracts/src/envelope.ts:61
