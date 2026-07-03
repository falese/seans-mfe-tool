[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / formatSuccess

# Function: formatSuccess()

> **formatSuccess**\<`T`\>(`data`, `warnings`, `telemetry?`): [`CommandResult`](../type-aliases/CommandResult.md)\<`T`\>

Defined in: [packages/contracts/src/envelope.ts:104](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L104)

## Type Parameters

### T

`T`

## Parameters

### data

`T`

### warnings

`string`[] = `[]`

### telemetry?

`Partial`\<\{ `correlationId`: `string`; `durationMs`: `number`; \}\>

## Returns

[`CommandResult`](../type-aliases/CommandResult.md)\<`T`\>
