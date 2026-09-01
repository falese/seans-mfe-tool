[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / findOrphanedGeneratedFiles

# Function: findOrphanedGeneratedFiles()

> **findOrphanedGeneratedFiles**(`realFiles`, `maximalFiles`, `readCurrent`): [`DriftEntry`](../interfaces/DriftEntry.md)[]

Defined in: [packages/codegen/src/drift.ts:89](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/drift.ts#L89)

Generator-owned paths that a *broader* generation of the same manifest
would own but the *current* generation does not — and that are still
present on disk. These are left over from a manifest that used to imply
them (most commonly: `data:` removed after a BFF was once generated).

## Parameters

### realFiles

[`GeneratedFile`](../interfaces/GeneratedFile.md)[]

the current, real generation for this manifest

### maximalFiles

[`GeneratedFile`](../interfaces/GeneratedFile.md)[]

a generation of the same manifest with the
                      manifest-shape fields that gate optional
                      generator-owned output (e.g. `data`) forced present,
                      so it includes every generator-owned path the real
                      generation *could* have produced

### readCurrent

(`path`) => `string` \| `null`

returns the current on-disk content for a path, or
                      `null` if the file does not exist

## Returns

[`DriftEntry`](../interfaces/DriftEntry.md)[]
