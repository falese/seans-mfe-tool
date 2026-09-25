[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / MfeValidationResult

# Interface: MfeValidationResult

Defined in: [packages/codegen/src/validate.ts:101](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L101)

## Properties

### checked

> **checked**: [`ValidationRule`](../type-aliases/ValidationRule.md)[]

Defined in: [packages/codegen/src/validate.ts:105](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L105)

Rules that were evaluated (framework-dependent).

***

### issues

> **issues**: [`ValidationIssue`](ValidationIssue.md)[]

Defined in: [packages/codegen/src/validate.ts:106](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L106)

***

### ok

> **ok**: `boolean`

Defined in: [packages/codegen/src/validate.ts:103](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L103)

False only when at least one issue is an `error` — warnings do not fail.
