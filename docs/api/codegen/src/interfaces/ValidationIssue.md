[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ValidationIssue

# Interface: ValidationIssue

Defined in: [packages/codegen/src/validate.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L82)

## Properties

### actual?

> `optional` **actual**: `string`

Defined in: [packages/codegen/src/validate.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L86)

***

### expected?

> `optional` **expected**: `string`

Defined in: [packages/codegen/src/validate.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L85)

***

### fix?

> `optional` **fix**: `string`

Defined in: [packages/codegen/src/validate.ts:93](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L93)

What to do about it, for rules that can say.

***

### location?

> `optional` **location**: `string`

Defined in: [packages/codegen/src/validate.ts:91](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L91)

`path:line` for issues found in a specific source file.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/validate.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L84)

***

### package?

> `optional` **package**: `string`

Defined in: [packages/codegen/src/validate.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L87)

***

### rule

> **rule**: [`ValidationRule`](../type-aliases/ValidationRule.md)

Defined in: [packages/codegen/src/validate.ts:83](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L83)

***

### severity?

> `optional` **severity**: [`ValidationSeverity`](../type-aliases/ValidationSeverity.md)

Defined in: [packages/codegen/src/validate.ts:89](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L89)

Defaults to `error` when absent.
