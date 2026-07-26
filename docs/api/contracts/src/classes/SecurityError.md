[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SecurityError

# Class: SecurityError

Defined in: packages/contracts/src/errors/SecurityError.ts:1

## Extends

- `Error`

## Constructors

### Constructor

> **new SecurityError**(`message`, `details?`): `SecurityError`

Defined in: packages/contracts/src/errors/SecurityError.ts:8

#### Parameters

##### message

`string`

##### details?

`Record`\<`string`, `unknown`\>

#### Returns

`SecurityError`

#### Overrides

`Error.constructor`

## Properties

### auditLog

> `readonly` **auditLog**: `true` = `true`

Defined in: packages/contracts/src/errors/SecurityError.ts:4

***

### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: packages/contracts/src/errors/SecurityError.ts:6

***

### retryable

> `readonly` **retryable**: `false` = `false`

Defined in: packages/contracts/src/errors/SecurityError.ts:3

***

### type

> `readonly` **type**: `"security"` = `'security'`

Defined in: packages/contracts/src/errors/SecurityError.ts:2

***

### userMessage

> `readonly` **userMessage**: `"Access denied"` = `'Access denied'`

Defined in: packages/contracts/src/errors/SecurityError.ts:5
