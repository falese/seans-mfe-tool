[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / NetworkError

# Class: NetworkError

Defined in: packages/contracts/src/errors/NetworkError.ts:1

## Extends

- `Error`

## Constructors

### Constructor

> **new NetworkError**(`message`, `statusCode`): `NetworkError`

Defined in: packages/contracts/src/errors/NetworkError.ts:6

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

Defined in: packages/contracts/src/errors/NetworkError.ts:3

***

### statusCode

> **statusCode**: `number`

Defined in: packages/contracts/src/errors/NetworkError.ts:4

***

### type

> `readonly` **type**: `"network"` = `'network'`

Defined in: packages/contracts/src/errors/NetworkError.ts:2
