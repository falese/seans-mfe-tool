[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / MfeValidationResult

# Interface: MfeValidationResult

Defined in: [packages/codegen/src/validate.ts:100](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L100)

## Properties

### checked

> **checked**: [`ValidationRule`](../type-aliases/ValidationRule.md)[]

Defined in: [packages/codegen/src/validate.ts:104](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L104)

Rules that were evaluated (framework-dependent).

***

### issues

> **issues**: [`ValidationIssue`](ValidationIssue.md)[]

Defined in: [packages/codegen/src/validate.ts:105](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L105)

***

### ok

> **ok**: `boolean`

Defined in: [packages/codegen/src/validate.ts:102](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L102)

False only when at least one issue is an `error` — warnings do not fail.
