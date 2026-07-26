[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ValidationError

# Class: ValidationError

Defined in: packages/contracts/src/errors/ValidationError.ts:1

## Extends

- `Error`

## Constructors

### Constructor

> **new ValidationError**(`message`, `field`, `constraint`): `ValidationError`

Defined in: packages/contracts/src/errors/ValidationError.ts:8

#### Parameters

##### message

`string`

##### field

`string`

##### constraint

`string`

#### Returns

`ValidationError`

#### Overrides

`Error.constructor`

## Properties

### constraint

> **constraint**: `string`

Defined in: packages/contracts/src/errors/ValidationError.ts:6

***

### field

> **field**: `string`

Defined in: packages/contracts/src/errors/ValidationError.ts:5

***

### retryable

> `readonly` **retryable**: `false` = `false`

Defined in: packages/contracts/src/errors/ValidationError.ts:3

***

### type

> `readonly` **type**: `"validation"` = `'validation'`

Defined in: packages/contracts/src/errors/ValidationError.ts:2

***

### userFacing

> `readonly` **userFacing**: `true` = `true`

Defined in: packages/contracts/src/errors/ValidationError.ts:4
