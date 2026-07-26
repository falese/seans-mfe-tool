[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / TimeoutError

# Class: TimeoutError

Defined in: packages/contracts/src/errors/TimeoutError.ts:1

## Extends

- `Error`

## Constructors

### Constructor

> **new TimeoutError**(`message`, `timeout`, `elapsed`): `TimeoutError`

Defined in: packages/contracts/src/errors/TimeoutError.ts:7

#### Parameters

##### message

`string`

##### timeout

`number`

##### elapsed

`number`

#### Returns

`TimeoutError`

#### Overrides

`Error.constructor`

## Properties

### elapsed

> `readonly` **elapsed**: `number`

Defined in: packages/contracts/src/errors/TimeoutError.ts:4

***

### retryable

> `readonly` **retryable**: `true` = `true`

Defined in: packages/contracts/src/errors/TimeoutError.ts:3

***

### timeout

> `readonly` **timeout**: `number`

Defined in: packages/contracts/src/errors/TimeoutError.ts:5

***

### type

> `readonly` **type**: `"timeout"` = `'timeout'`

Defined in: packages/contracts/src/errors/TimeoutError.ts:2
