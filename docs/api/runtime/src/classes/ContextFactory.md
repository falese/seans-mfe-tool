[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ContextFactory

# Class: ContextFactory

Defined in: [packages/runtime/src/context.ts:176](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L176)

Context factory - creates a new context with required fields

## Constructors

### Constructor

> **new ContextFactory**(): `ContextFactory`

#### Returns

`ContextFactory`

## Methods

### cloneForCapability()

> `static` **cloneForCapability**(`source`, `capability`, `inputs?`): [`Context`](../interfaces/Context.md)

Defined in: [packages/runtime/src/context.ts:212](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L212)

Clone context for a new capability while preserving user/auth

#### Parameters

##### source

[`Context`](../interfaces/Context.md)

##### capability

`string`

##### inputs?

`Record`\<`string`, `unknown`\>

#### Returns

[`Context`](../interfaces/Context.md)

***

### create()

> `static` **create**(`options`): [`Context`](../interfaces/Context.md)

Defined in: [packages/runtime/src/context.ts:180](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L180)

Create a new context for a capability invocation

#### Parameters

##### options

###### capability?

`string`

###### headers?

`Record`\<`string`, `string`\>

###### inputs?

`Record`\<`string`, `unknown`\>

###### jwt?

`string`

###### query?

`Record`\<`string`, `string`\>

###### user?

[`UserContext`](../interfaces/UserContext.md)

#### Returns

[`Context`](../interfaces/Context.md)

***

### incrementRetry()

> `static` **incrementRetry**(`context`): `void`

Defined in: [packages/runtime/src/context.ts:249](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L249)

Increment retry count

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`void`

***

### recordError()

> `static` **recordError**(`context`, `error`): `void`

Defined in: [packages/runtime/src/context.ts:241](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L241)

Record error in context

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

##### error

`Error`

#### Returns

`void`

***

### setPhase()

> `static` **setPhase**(`context`, `phase`): `void`

Defined in: [packages/runtime/src/context.ts:234](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L234)

Update context phase

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

##### phase

`"error"` | `"before"` | `"main"` | `"after"` | `undefined`

#### Returns

`void`
