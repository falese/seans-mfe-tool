[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / toDeclaredSlotIdUnion

# Function: toDeclaredSlotIdUnion()

> **toDeclaredSlotIdUnion**(`declarations`): `string`

Defined in: [packages/codegen/src/slot-types.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/slot-types.ts#L43)

The right-hand side of `export type DeclaredSlotId = …`, in manifest order.
`never` when nothing is declared — an MFE with no slots may register none.

## Parameters

### declarations

readonly [`DeclaredSlotIdSource`](../interfaces/DeclaredSlotIdSource.md)[]

## Returns

`string`
