[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ValidationError

# Class: ValidationError

Defined in: [packages/contracts/src/errors/ValidationError.ts:1](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L1)

## Extends

- `Error`

## Constructors

### Constructor

> **new ValidationError**(`message`, `field`, `constraint`): `ValidationError`

Defined in: [packages/contracts/src/errors/ValidationError.ts:8](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L8)

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

Defined in: [packages/contracts/src/errors/ValidationError.ts:6](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L6)

***

### field

> **field**: `string`

Defined in: [packages/contracts/src/errors/ValidationError.ts:5](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L5)

***

### retryable

> `readonly` **retryable**: `false` = `false`

Defined in: [packages/contracts/src/errors/ValidationError.ts:3](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L3)

***

### type

> `readonly` **type**: `"validation"` = `'validation'`

Defined in: [packages/contracts/src/errors/ValidationError.ts:2](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L2)

***

### userFacing

> `readonly` **userFacing**: `true` = `true`

Defined in: [packages/contracts/src/errors/ValidationError.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/ValidationError.ts#L4)
