[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SecurityError

# Class: SecurityError

Defined in: [packages/contracts/src/errors/SecurityError.ts:1](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L1)

## Extends

- `Error`

## Constructors

### Constructor

> **new SecurityError**(`message`, `details?`): `SecurityError`

Defined in: [packages/contracts/src/errors/SecurityError.ts:8](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L8)

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

Defined in: [packages/contracts/src/errors/SecurityError.ts:4](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L4)

***

### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/errors/SecurityError.ts:6](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L6)

***

### retryable

> `readonly` **retryable**: `false` = `false`

Defined in: [packages/contracts/src/errors/SecurityError.ts:3](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L3)

***

### type

> `readonly` **type**: `"security"` = `'security'`

Defined in: [packages/contracts/src/errors/SecurityError.ts:2](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L2)

***

### userMessage

> `readonly` **userMessage**: `"Access denied"` = `'Access denied'`

Defined in: [packages/contracts/src/errors/SecurityError.ts:5](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/errors/SecurityError.ts#L5)
