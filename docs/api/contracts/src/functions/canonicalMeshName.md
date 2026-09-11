[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / canonicalMeshName

# Function: canonicalMeshName()

> **canonicalMeshName**(`name`): `string`

Defined in: [packages/contracts/src/mesh-catalog.ts:122](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/mesh-catalog.ts#L122)

Resolve a manifest-written name to its canonical Mesh config key.

An unrecognised name is returned unchanged rather than transformed: the
platform accepts unknown plugins and transforms with a warning (the same
open-world policy ADR-036 applies to `framework` and `bundler`), so guessing
a canonical form for something we do not know would corrupt it.

## Parameters

### name

`string`

## Returns

`string`
