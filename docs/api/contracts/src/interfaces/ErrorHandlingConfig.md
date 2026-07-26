[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ErrorHandlingConfig

# Interface: ErrorHandlingConfig

Defined in: [packages/contracts/src/error-classifier.ts:9](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L9)

## Properties

### types

> **types**: `object`[]

Defined in: [packages/contracts/src/error-classifier.ts:10](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L10)

#### backoff?

> `optional` **backoff**: `"exponential"` \| `"linear"` \| `"constant"`

#### baseDelay?

> `optional` **baseDelay**: `number`

#### fallbackHandler?

> `optional` **fallbackHandler**: `string`

#### jitter?

> `optional` **jitter**: `boolean`

#### maxDelay?

> `optional` **maxDelay**: `number`

#### maxRetries?

> `optional` **maxRetries**: `number`

#### message?

> `optional` **message**: `string`

#### onRetry?

> `optional` **onRetry**: `string`

#### pattern?

> `optional` **pattern**: `string`

#### retryable

> **retryable**: `boolean`

#### type

> **type**: `string`

#### userFacing?

> `optional` **userFacing**: `boolean`
