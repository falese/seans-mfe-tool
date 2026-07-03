[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / BusinessError

# Class: BusinessError

Defined in: [packages/contracts/src/errors/BusinessError.ts:1](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/BusinessError.ts#L1)

## Extends

- `Error`

## Constructors

### Constructor

> **new BusinessError**(`message`, `code`, `details?`): `BusinessError`

Defined in: [packages/contracts/src/errors/BusinessError.ts:7](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/BusinessError.ts#L7)

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

Defined in: [packages/contracts/src/errors/BusinessError.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/BusinessError.ts#L4)

***

### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/errors/BusinessError.ts:5](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/BusinessError.ts#L5)

***

### retryable

> `readonly` **retryable**: `false` = `false`

Defined in: [packages/contracts/src/errors/BusinessError.ts:3](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/BusinessError.ts#L3)

***

### type

> `readonly` **type**: `"business"` = `'business'`

Defined in: [packages/contracts/src/errors/BusinessError.ts:2](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/BusinessError.ts#L2)
