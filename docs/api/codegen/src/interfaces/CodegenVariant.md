[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / CodegenVariant

# Interface: CodegenVariant

Defined in: [packages/codegen/src/variants/types.ts:51](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L51)

## Properties

### bundler

> **bundler**: `string`

Defined in: [packages/codegen/src/variants/types.ts:55](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L55)

***

### framework

> **framework**: `string`

Defined in: [packages/codegen/src/variants/types.ts:54](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L54)

***

### id

> **id**: `string`

Defined in: [packages/codegen/src/variants/types.ts:53](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L53)

Stable id, also the `templateVariant` value in the render model.

***

### ownsRootTsconfig

> **ownsRootTsconfig**: `boolean`

Defined in: [packages/codegen/src/variants/types.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L70)

This variant emits its own root `tsconfig.json`, so shared plans must not.
Asked as a question rather than inferred from the id: the Angular variant
ships a tsconfig with `experimentalDecorators` and `angularCompilerOptions`
that the BFF's generic one would clobber.

***

### remoteEntry

> **remoteEntry**: `object`

Defined in: [packages/codegen/src/variants/types.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L84)

The barrel re-exporting every domain capability.

#### out

> **out**: `string`

#### template

> **template**: `string`

***

### slots?

> `optional` **slots**: `object`

Defined in: [packages/codegen/src/variants/types.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L92)

Slot sugar this variant ships, if any (ADR-067). React ships a
`DeclaredSlot` component, Angular a directive; a variant with no slot
support omits this and a manifest declaring `providesSlots` gets a
diagnostic rather than a silently missing file.

#### out

> **out**: `string`

#### template

> **template**: `string`

***

### specs

> **specs**: [`FileSpec`](FileSpec.md)[]

Defined in: [packages/codegen/src/variants/types.ts:95](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L95)

Root and entry files. Everything not per-capability and not shared.

***

### templateDirName

> **templateDirName**: `string`

Defined in: [packages/codegen/src/variants/types.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L62)

Directory under `packages/codegen/templates/`, or an absolute path — the
generator resolves it with `path.resolve`, so a variant shipped by a
plugin points at its own package's templates without the generator
knowing where that is.

## Methods

### featureFiles()

> **featureFiles**(`capability`): [`FeatureFileNames`](FeatureFileNames.md)

Defined in: [packages/codegen/src/variants/types.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L73)

Per-capability filenames and their templates, under `features/`.

#### Parameters

##### capability

`string`

#### Returns

[`FeatureFileNames`](FeatureFileNames.md)

***

### implementedPatterns()

> **implementedPatterns**(`capability`): `RegExp`[]

Defined in: [packages/codegen/src/variants/types.ts:81](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L81)

Patterns meaning "this capability is already implemented in this file".
A framework question — React exports a const/function/class of that name,
Angular a `<Name>Component` class — so the variant answers it instead of
the generator branching on an id.

#### Parameters

##### capability

`string`

#### Returns

`RegExp`[]
