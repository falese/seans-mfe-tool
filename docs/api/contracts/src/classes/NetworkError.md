[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / NetworkError

# Class: NetworkError

Defined in: [packages/contracts/src/errors/NetworkError.ts:1](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/NetworkError.ts#L1)

## Extends

- `Error`

## Constructors

### Constructor

> **new NetworkError**(`message`, `statusCode`): `NetworkError`

Defined in: [packages/contracts/src/errors/NetworkError.ts:6](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/NetworkError.ts#L6)

#### Parameters

##### message

`string`

##### statusCode

`number`

#### Returns

`NetworkError`

#### Overrides

`Error.constructor`

## Properties

### retryable

> `readonly` **retryable**: `true` = `true`

Defined in: [packages/contracts/src/errors/NetworkError.ts:3](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/NetworkError.ts#L3)

***

### statusCode

> **statusCode**: `number`

Defined in: [packages/contracts/src/errors/NetworkError.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/NetworkError.ts#L4)

***

### type

> `readonly` **type**: `"network"` = `'network'`

Defined in: [packages/contracts/src/errors/NetworkError.ts:2](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/NetworkError.ts#L2)
