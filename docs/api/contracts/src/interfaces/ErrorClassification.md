[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ErrorClassification

# Interface: ErrorClassification

Defined in: [packages/contracts/src/error-classifier.ts:1](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L1)

## Properties

### auditLog?

> `optional` **auditLog**: `boolean`

Defined in: [packages/contracts/src/error-classifier.ts:5](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L5)

***

### retryable

> **retryable**: `boolean`

Defined in: [packages/contracts/src/error-classifier.ts:3](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L3)

***

### type

> **type**: `"network"` \| `"validation"` \| `"business"` \| `"security"` \| `"system"` \| `"timeout"` \| `"unknown"`

Defined in: [packages/contracts/src/error-classifier.ts:2](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L2)

***

### userFacing?

> `optional` **userFacing**: `boolean`

Defined in: [packages/contracts/src/error-classifier.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L4)

***

### userMessage?

> `optional` **userMessage**: `string`

Defined in: [packages/contracts/src/error-classifier.ts:6](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L6)
