[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / CommandResult

# Type Alias: CommandResult\<T\>

> **CommandResult**\<`T`\> = `object`

Defined in: [packages/contracts/src/envelope.ts:57](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L57)

## Type Parameters

### T

`T` = `unknown`

## Properties

### data?

> `optional` **data**: `T`

Defined in: [packages/contracts/src/envelope.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L59)

***

### error?

> `optional` **error**: [`CommandError`](CommandError.md)

Defined in: [packages/contracts/src/envelope.ts:60](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L60)

***

### ok

> **ok**: `boolean`

Defined in: [packages/contracts/src/envelope.ts:58](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L58)

***

### telemetry

> **telemetry**: `object`

Defined in: [packages/contracts/src/envelope.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L62)

#### correlationId

> **correlationId**: `string`

#### durationMs

> **durationMs**: `number`

***

### warnings

> **warnings**: `string`[]

Defined in: [packages/contracts/src/envelope.ts:61](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L61)
