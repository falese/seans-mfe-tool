[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / classifyMeshEntry

# Function: classifyMeshEntry()

> **classifyMeshEntry**(`name`): [`MeshEntryKind`](../type-aliases/MeshEntryKind.md)

Defined in: [packages/contracts/src/mesh-catalog.ts:143](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/mesh-catalog.ts#L143)

Classify a manifest-declared Mesh entry, resolving aliases first.

`unknown` is not an error — callers warn and carry on, because Mesh has more
plugins than this table will ever track. `ambiguous` means the name is valid
in either position and no misclassification should be reported.

## Parameters

### name

`string`

## Returns

[`MeshEntryKind`](../type-aliases/MeshEntryKind.md)
