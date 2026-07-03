[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ErrorHandlingState

# Interface: ErrorHandlingState

Defined in: [packages/runtime/src/handlers/error-handling.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/error-handling.ts#L4)

Error-handling state this handler owns on the context.

## Properties

### fallbackApplied?

> `optional` **fallbackApplied**: `boolean`

Defined in: [packages/runtime/src/handlers/error-handling.ts:6](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/error-handling.ts#L6)

***

### recoverable?

> `optional` **recoverable**: `boolean`

Defined in: [packages/runtime/src/handlers/error-handling.ts:5](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/error-handling.ts#L5)

***

### retryStrategy?

> `optional` **retryStrategy**: `"exponential"` \| `"linear"` \| `"none"`

Defined in: [packages/runtime/src/handlers/error-handling.ts:7](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/error-handling.ts#L7)
