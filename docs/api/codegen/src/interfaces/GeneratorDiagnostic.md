[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / GeneratorDiagnostic

# Interface: GeneratorDiagnostic

Defined in: [packages/codegen/src/file-plan.ts:117](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L117)

Something the generator has to say, returned instead of printed (ADR-094).

Deliberately the same shape wherever it comes from — the file plan, manifest
validation, a variant's missing slot template — so a caller renders one list
rather than learning three reporting conventions. `severity` decides whether
it blocks; `fix` is filled in by whoever can say what to do about it.

## Properties

### code

> **code**: `string`

Defined in: [packages/codegen/src/file-plan.ts:120](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L120)

Stable, greppable kind — e.g. `missing-template`, `mesh-unknown`.

***

### fix?

> `optional` **fix**: `string`

Defined in: [packages/codegen/src/file-plan.ts:125](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L125)

What to do about it, when that can be said concretely.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/file-plan.ts:121](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L121)

***

### severity

> **severity**: `"error"` \| `"warning"`

Defined in: [packages/codegen/src/file-plan.ts:118](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L118)

***

### target?

> `optional` **target**: `string`

Defined in: [packages/codegen/src/file-plan.ts:123](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L123)

What the diagnostic is about: an output path, a manifest field, a name.
