[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / FileSpec

# Interface: FileSpec

Defined in: [packages/codegen/src/file-plan.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L41)

One file the generator may emit.

Exactly one of `template` or `content` is required: most files come from an
EJS template, and a couple are fixed strings that were previously inline
literals in the middle of the render procedure.

## Properties

### content?

> `optional` **content**: `string`

Defined in: [packages/codegen/src/file-plan.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L45)

Literal file content, for files with no template.

***

### optional?

> `optional` **optional**: `boolean`

Defined in: [packages/codegen/src/file-plan.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L68)

A missing template is this variant's choice, not a defect — emitted
silently instead of warned about. `base-mfe-angular` ships neither
`demo.html` nor `favicon.ico`; warning anyway printed two lines per Angular
MFE on every run, in the middle of output a reader is meant to study.

***

### out

> **out**: `string`

Defined in: [packages/codegen/src/file-plan.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L47)

Output path relative to the MFE root.

***

### owner

> **owner**: `"generator"` \| `"developer"`

Defined in: [packages/codegen/src/file-plan.ts:55](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L55)

Who owns the emitted file. THE most consequential field in a spec:
`generator` becomes `overwrite: true` — re-stamped every run and held
byte-identical by `check:mfe-drift`; `developer` becomes `overwrite: false`
— seeded once and then the developer's, reachable afterwards only by an
explicit `--force` re-seed (ADR-089).

***

### root?

> `optional` **root**: [`TemplateRootName`](../type-aliases/TemplateRootName.md)

Defined in: [packages/codegen/src/file-plan.ts:57](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L57)

Template root to resolve `template` against. Defaults to `variant`.

***

### template?

> `optional` **template**: `string`

Defined in: [packages/codegen/src/file-plan.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L43)

Template path relative to its root. Mutually exclusive with `content`.

***

### vars()?

> `optional` **vars**: (`ctx`) => `Record`\<`string`, `unknown`\>

Defined in: [packages/codegen/src/file-plan.ts:61](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L61)

Extra template variables, merged over the shared model.

#### Parameters

##### ctx

`unknown`

#### Returns

`Record`\<`string`, `unknown`\>

***

### when()?

> `optional` **when**: (`ctx`) => `boolean`

Defined in: [packages/codegen/src/file-plan.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L59)

Emit only when this returns true. Absent means always.

#### Parameters

##### ctx

`unknown`

#### Returns

`boolean`
