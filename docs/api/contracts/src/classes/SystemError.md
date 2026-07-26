[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SystemError

# Class: SystemError

Defined in: packages/contracts/src/errors/SystemError.ts:1

## Extends

- `Error`

## Constructors

### Constructor

> **new SystemError**(`message`, `cause?`): `SystemError`

Defined in: packages/contracts/src/errors/SystemError.ts:6

#### Parameters

##### message

`string`

##### cause?

`Error`

#### Returns

`SystemError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `Error`

Defined in: packages/contracts/src/errors/SystemError.ts:4

***

### retryable

> `readonly` **retryable**: `true` = `true`

Defined in: packages/contracts/src/errors/SystemError.ts:3

***

### type

> `readonly` **type**: `"system"` = `'system'`

Defined in: packages/contracts/src/errors/SystemError.ts:2
