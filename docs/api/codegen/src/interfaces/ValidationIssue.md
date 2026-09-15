[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ValidationIssue

# Interface: ValidationIssue

Defined in: [packages/codegen/src/validate.ts:79](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L79)

## Properties

### actual?

> `optional` **actual**: `string`

Defined in: [packages/codegen/src/validate.ts:83](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L83)

***

### expected?

> `optional` **expected**: `string`

Defined in: [packages/codegen/src/validate.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L82)

***

### fix?

> `optional` **fix**: `string`

Defined in: [packages/codegen/src/validate.ts:90](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L90)

What to do about it, for rules that can say.

***

### location?

> `optional` **location**: `string`

Defined in: [packages/codegen/src/validate.ts:88](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L88)

`path:line` for issues found in a specific source file.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/validate.ts:81](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L81)

***

### package?

> `optional` **package**: `string`

Defined in: [packages/codegen/src/validate.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L84)

***

### rule

> **rule**: [`ValidationRule`](../type-aliases/ValidationRule.md)

Defined in: [packages/codegen/src/validate.ts:80](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L80)

***

### severity?

> `optional` **severity**: [`ValidationSeverity`](../type-aliases/ValidationSeverity.md)

Defined in: [packages/codegen/src/validate.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L86)

Defaults to `error` when absent.
