[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / mergeTemplateRoots

# Function: mergeTemplateRoots()

> **mergeTemplateRoots**(`variantRoot`, `contributors`): `object`

Defined in: [packages/codegen/src/file-plan.ts:149](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L149)

Build the template-root table from the variant's directory and whatever
contributors registered.

`variant` is reserved: it is the root every spec falls back to when it names
none, which is most of them. The table used to be assembled as
`{ variant: templateDir, ...contributorRoots }` keyed by contributor id —
and `FileContributor.id` is an open string, so a contributor registering
under `variant` silently replaced the variant's own directory and the whole
MFE rendered from that package's templates. No error, no missing file: a
complete MFE built from the wrong source, which is why the collision is an
error diagnostic rather than a warning.

Duplicate ids get the same treatment. `fileContributors()` de-duplicates by
id today, so this is defence for any other caller assembling the list.

## Parameters

### variantRoot

`string`

### contributors

readonly `object`[]

## Returns

`object`

### diagnostics

> **diagnostics**: [`GeneratorDiagnostic`](../interfaces/GeneratorDiagnostic.md)[]

### roots

> **roots**: `Record`\<`string`, `string`\> & `object`

#### Type Declaration

##### variant

> **variant**: `string`
