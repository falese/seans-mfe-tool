[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / GeneratorDiagnostic

# Interface: GeneratorDiagnostic

Defined in: [packages/codegen/src/file-plan.ts:104](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L104)

Something the generator has to say, returned instead of printed (ADR-092).

Deliberately the same shape wherever it comes from — the file plan, manifest
validation, a variant's missing slot template — so a caller renders one list
rather than learning three reporting conventions. `severity` decides whether
it blocks; `fix` is filled in by whoever can say what to do about it.

## Properties

### code

> **code**: `string`

Defined in: [packages/codegen/src/file-plan.ts:107](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L107)

Stable, greppable kind — e.g. `missing-template`, `mesh-unknown`.

***

### fix?

> `optional` **fix**: `string`

Defined in: [packages/codegen/src/file-plan.ts:112](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L112)

What to do about it, when that can be said concretely.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/file-plan.ts:108](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L108)

***

### severity

> **severity**: `"error"` \| `"warning"`

Defined in: [packages/codegen/src/file-plan.ts:105](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L105)

***

### target?

> `optional` **target**: `string`

Defined in: [packages/codegen/src/file-plan.ts:110](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L110)

What the diagnostic is about: an output path, a manifest field, a name.
