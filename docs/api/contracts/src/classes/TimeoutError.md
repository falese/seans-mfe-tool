[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / TimeoutError

# Class: TimeoutError

Defined in: [packages/contracts/src/errors/TimeoutError.ts:1](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/TimeoutError.ts#L1)

## Extends

- `Error`

## Constructors

### Constructor

> **new TimeoutError**(`message`, `timeout`, `elapsed`): `TimeoutError`

Defined in: [packages/contracts/src/errors/TimeoutError.ts:7](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/TimeoutError.ts#L7)

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

Defined in: [packages/contracts/src/errors/TimeoutError.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/TimeoutError.ts#L4)

***

### retryable

> `readonly` **retryable**: `true` = `true`

Defined in: [packages/contracts/src/errors/TimeoutError.ts:3](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/TimeoutError.ts#L3)

***

### timeout

> `readonly` **timeout**: `number`

Defined in: [packages/contracts/src/errors/TimeoutError.ts:5](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/TimeoutError.ts#L5)

***

### type

> `readonly` **type**: `"timeout"` = `'timeout'`

Defined in: [packages/contracts/src/errors/TimeoutError.ts:2](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/TimeoutError.ts#L2)
