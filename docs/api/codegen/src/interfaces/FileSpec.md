[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / FileSpec

# Interface: FileSpec

Defined in: [packages/codegen/src/file-plan.ts:50](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L50)

One file the generator may emit.

Exactly one of `template` or `content` is required: most files come from an
EJS template, and a couple are fixed strings that were previously inline
literals in the middle of the render procedure.

## Properties

### content?

> `optional` **content**: `string`

Defined in: [packages/codegen/src/file-plan.ts:54](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L54)

Literal file content, for files with no template.

***

### optional?

> `optional` **optional**: `boolean`

Defined in: [packages/codegen/src/file-plan.ts:77](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L77)

A missing template is this variant's choice, not a defect — emitted
silently instead of warned about. `base-mfe-angular` ships neither
`demo.html` nor `favicon.ico`; warning anyway printed two lines per Angular
MFE on every run, in the middle of output a reader is meant to study.

***

### out

> **out**: `string`

Defined in: [packages/codegen/src/file-plan.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L56)

Output path relative to the MFE root.

***

### owner

> **owner**: `"generator"` \| `"developer"`

Defined in: [packages/codegen/src/file-plan.ts:64](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L64)

Who owns the emitted file. THE most consequential field in a spec:
`generator` becomes `overwrite: true` — re-stamped every run and held
byte-identical by `check:mfe-drift`; `developer` becomes `overwrite: false`
— seeded once and then the developer's, reachable afterwards only by an
explicit `--force` re-seed (ADR-089).

***

### root?

> `optional` **root**: [`TemplateRootName`](../type-aliases/TemplateRootName.md)

Defined in: [packages/codegen/src/file-plan.ts:66](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L66)

Template root to resolve `template` against. Defaults to `variant`.

***

### template?

> `optional` **template**: `string`

Defined in: [packages/codegen/src/file-plan.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L52)

Template path relative to its root. Mutually exclusive with `content`.

***

### vars()?

> `optional` **vars**: (`ctx`) => `Record`\<`string`, `unknown`\>

Defined in: [packages/codegen/src/file-plan.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L70)

Extra template variables, merged over the shared model.

#### Parameters

##### ctx

`unknown`

#### Returns

`Record`\<`string`, `unknown`\>

***

### when()?

> `optional` **when**: (`ctx`) => `boolean`

Defined in: [packages/codegen/src/file-plan.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L68)

Emit only when this returns true. Absent means always.

#### Parameters

##### ctx

`unknown`

#### Returns

`boolean`
