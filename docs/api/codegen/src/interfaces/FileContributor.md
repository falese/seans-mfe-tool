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

> **specs**: [`FileSpec`](FileSpec.md)[] \| (`ctx`) => [`FileSpec`](FileSpec.md)[]

Defined in: [packages/codegen/src/contributors.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/contributors.ts#L42)

Specs to resolve against `templateRoot`.

A function when the set of files depends on the manifest — one per
capability, say. `FileSpec.out` is a static string, so a fixed array can
only describe files whose paths are known before any manifest is read.
That limit shaped the Swift lane badly before this existed: unable to emit
`Features/<Cap>View.swift` per capability the way the web lane's
`featureSpecs()` does, it put every view in one developer-owned file, and
a capability added later then had nowhere to land — which was written up
as an intentional "migration notice" rather than as the workaround it was.

The array form stays valid and is what the BFF uses.

***

### templateRoot

> **templateRoot**: `string`

Defined in: [packages/codegen/src/contributors.ts:27](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/contributors.ts#L27)

Absolute path to the directory this contributor's templates live in —
resolved by the contributor, inside its own package, so the generator
never needs to know where that is.
