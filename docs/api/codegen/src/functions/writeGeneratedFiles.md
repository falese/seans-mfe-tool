[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / writeGeneratedFiles

# Function: writeGeneratedFiles()

> **writeGeneratedFiles**(`files`, `options`): `Promise`\<\{ `errors`: `string`[]; `files`: [`GeneratedFile`](../interfaces/GeneratedFile.md)[]; `skipped`: `string`[]; \}\>

Defined in: [packages/codegen/src/template-io.ts:72](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/template-io.ts#L72)

Write generated files to disk

## Parameters

### files

[`GeneratedFile`](../interfaces/GeneratedFile.md)[]

### options

#### dryRun?

`boolean`

#### force?

`boolean`

## Returns

`Promise`\<\{ `errors`: `string`[]; `files`: [`GeneratedFile`](../interfaces/GeneratedFile.md)[]; `skipped`: `string`[]; \}\>
