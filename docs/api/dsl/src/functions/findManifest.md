[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / findManifest

# Function: findManifest()

> **findManifest**(`directory`): `Promise`\<`string` \| `null`\>

Defined in: [packages/dsl/src/parser.ts:98](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/parser.ts#L98)

Find manifest file in a directory by searching common filenames

## Parameters

### directory

`string`

Directory to search in

## Returns

`Promise`\<`string` \| `null`\>

Path to found manifest, or null if not found
