[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ValidationIssue

# Interface: ValidationIssue

Defined in: [packages/codegen/src/validate.ts:83](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L83)

## Properties

### actual?

> `optional` **actual**: `string`

Defined in: [packages/codegen/src/validate.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L87)

***

### expected?

> `optional` **expected**: `string`

Defined in: [packages/codegen/src/validate.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L86)

***

### fix?

> `optional` **fix**: `string`

Defined in: [packages/codegen/src/validate.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L94)

What to do about it, for rules that can say.

***

### location?

> `optional` **location**: `string`

Defined in: [packages/codegen/src/validate.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L92)

`path:line` for issues found in a specific source file.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/validate.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L85)

***

### package?

> `optional` **package**: `string`

Defined in: [packages/codegen/src/validate.ts:88](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L88)

***

### rule

> **rule**: [`ValidationRule`](../type-aliases/ValidationRule.md)

Defined in: [packages/codegen/src/validate.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L84)

***

### severity?

> `optional` **severity**: [`ValidationSeverity`](../type-aliases/ValidationSeverity.md)

Defined in: [packages/codegen/src/validate.ts:90](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L90)

Defaults to `error` when absent.
