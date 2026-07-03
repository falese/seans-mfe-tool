[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ContextFactory

# Class: ContextFactory

Defined in: [packages/runtime/src/context.ts:166](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L166)

Context factory - creates a new context with required fields

## Constructors

### Constructor

> **new ContextFactory**(): `ContextFactory`

#### Returns

`ContextFactory`

## Methods

### cloneForCapability()

> `static` **cloneForCapability**(`source`, `capability`, `inputs?`): [`Context`](../interfaces/Context.md)

Defined in: [packages/runtime/src/context.ts:202](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L202)

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

Defined in: [packages/runtime/src/context.ts:170](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L170)

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

Defined in: [packages/runtime/src/context.ts:239](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L239)

Increment retry count

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`void`

***

### recordError()

> `static` **recordError**(`context`, `error`): `void`

Defined in: [packages/runtime/src/context.ts:231](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L231)

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

Defined in: [packages/runtime/src/context.ts:224](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L224)

Update context phase

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

##### phase

`"error"` | `"before"` | `"main"` | `"after"`

#### Returns

`void`
