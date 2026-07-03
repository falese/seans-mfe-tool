[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ContextValidator

# Class: ContextValidator

Defined in: [packages/runtime/src/context.ts:247](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L247)

Context validator - ensures context meets requirements

## Constructors

### Constructor

> **new ContextValidator**(): `ContextValidator`

#### Returns

`ContextValidator`

## Methods

### validate()

> `static` **validate**(`context`, `requirements`): `object`

Defined in: [packages/runtime/src/context.ts:251](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L251)

Validate that context has required fields for a capability

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

##### requirements

###### requiredInputs?

`string`[]

###### requiresAuth?

`boolean`

###### requiresUser?

`boolean`

#### Returns

`object`

##### errors

> **errors**: `string`[]

##### valid

> **valid**: `boolean`

***

### validateUserRole()

> `static` **validateUserRole**(`context`, `requiredRoles`): `object`

Defined in: [packages/runtime/src/context.ts:291](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L291)

Validate that user has required role

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

##### requiredRoles

`string`[]

#### Returns

`object`

##### error?

> `optional` **error**: `string`

##### valid

> **valid**: `boolean`
