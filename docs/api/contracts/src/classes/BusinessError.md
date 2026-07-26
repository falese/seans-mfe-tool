[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / BusinessError

# Class: BusinessError

Defined in: packages/contracts/src/errors/BusinessError.ts:1

## Extends

- `Error`

## Constructors

### Constructor

> **new BusinessError**(`message`, `code`, `details?`): `BusinessError`

Defined in: packages/contracts/src/errors/BusinessError.ts:7

#### Parameters

##### message

`string`

##### code

`string`

##### details?

`Record`\<`string`, `unknown`\>

#### Returns

`BusinessError`

#### Overrides

`Error.constructor`

## Properties

### code

> **code**: `string`

Defined in: packages/contracts/src/errors/BusinessError.ts:4

***

### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: packages/contracts/src/errors/BusinessError.ts:5

***

### retryable

> `readonly` **retryable**: `false` = `false`

Defined in: packages/contracts/src/errors/BusinessError.ts:3

***

### type

> `readonly` **type**: `"business"` = `'business'`

Defined in: packages/contracts/src/errors/BusinessError.ts:2
