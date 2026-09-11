[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / FileContributor

# Interface: FileContributor

Defined in: [packages/codegen/src/contributors.ts:19](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/contributors.ts#L19)

## Properties

### id

> **id**: `string`

Defined in: [packages/codegen/src/contributors.ts:21](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/contributors.ts#L21)

Stable id; registering the same id twice replaces the earlier entry.

***

### specs

> **specs**: [`FileSpec`](FileSpec.md)[]

Defined in: [packages/codegen/src/contributors.ts:29](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/contributors.ts#L29)

Specs to resolve against `templateRoot`.

***

### templateRoot

> **templateRoot**: `string`

Defined in: [packages/codegen/src/contributors.ts:27](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/contributors.ts#L27)

Absolute path to the directory this contributor's templates live in —
resolved by the contributor, inside its own package, so the generator
never needs to know where that is.
