[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / diffGeneratedOwned

# Function: diffGeneratedOwned()

> **diffGeneratedOwned**(`files`, `readCurrent`): [`DriftResult`](../interfaces/DriftResult.md)

Defined in: [packages/codegen/src/drift.ts:55](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/drift.ts#L55)

Compare the generator-owned files against their current on-disk content.

## Parameters

### files

[`GeneratedFile`](../interfaces/GeneratedFile.md)[]

all files the generator produced for an MFE

### readCurrent

(`path`) => `string` \| `null`

returns the current on-disk content for a path, or `null`
                   if the file does not exist

## Returns

[`DriftResult`](../interfaces/DriftResult.md)
