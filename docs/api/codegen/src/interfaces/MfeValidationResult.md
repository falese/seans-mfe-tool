[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / MfeValidationResult

# Interface: MfeValidationResult

Defined in: [packages/codegen/src/validate.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L94)

## Properties

### checked

> **checked**: [`ValidationRule`](../type-aliases/ValidationRule.md)[]

Defined in: [packages/codegen/src/validate.ts:98](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L98)

Rules that were evaluated (framework-dependent).

***

### issues

> **issues**: [`ValidationIssue`](ValidationIssue.md)[]

Defined in: [packages/codegen/src/validate.ts:99](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L99)

***

### ok

> **ok**: `boolean`

Defined in: [packages/codegen/src/validate.ts:96](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L96)

False only when at least one issue is an `error` — warnings do not fail.
