[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ValidationIssue

# Interface: ValidationIssue

Defined in: [packages/codegen/src/validate.ts:75](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L75)

## Properties

### actual?

> `optional` **actual**: `string`

Defined in: [packages/codegen/src/validate.ts:79](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L79)

***

### expected?

> `optional` **expected**: `string`

Defined in: [packages/codegen/src/validate.ts:78](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L78)

***

### fix?

> `optional` **fix**: `string`

Defined in: [packages/codegen/src/validate.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L86)

What to do about it, for rules that can say.

***

### location?

> `optional` **location**: `string`

Defined in: [packages/codegen/src/validate.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L84)

`path:line` for issues found in a specific source file.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/validate.ts:77](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L77)

***

### package?

> `optional` **package**: `string`

Defined in: [packages/codegen/src/validate.ts:80](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L80)

***

### rule

> **rule**: [`ValidationRule`](../type-aliases/ValidationRule.md)

Defined in: [packages/codegen/src/validate.ts:76](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L76)

***

### severity?

> `optional` **severity**: [`ValidationSeverity`](../type-aliases/ValidationSeverity.md)

Defined in: [packages/codegen/src/validate.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L82)

Defaults to `error` when absent.
