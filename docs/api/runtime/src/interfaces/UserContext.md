[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / UserContext

# Interface: UserContext

Defined in: packages/runtime/src/context.ts:30

User authentication and authorization context.

Extends the wire-level ControlPlaneUser (the principal a session acts as,
@seans-mfe/contracts) with the fields the lifecycle engine needs locally:
a mandatory username, mandatory roles, and optional fine-grained
permissions. Anything that crosses the daemon socket uses the contracts
base; the runtime works with this richer view.

## Extends

- [`ControlPlaneUser`](../../../contracts/src/interfaces/ControlPlaneUser.md)

## Indexable

\[`key`: `string`\]: `unknown`

## Properties

### attributes?

> `optional` **attributes**: `Record`\<`string`, `unknown`\>

Defined in: packages/contracts/src/messages.ts:28

#### Inherited from

[`ControlPlaneUser`](../../../contracts/src/interfaces/ControlPlaneUser.md).[`attributes`](../../../contracts/src/interfaces/ControlPlaneUser.md#attributes)

***

### id

> **id**: `string`

Defined in: packages/contracts/src/messages.ts:26

#### Inherited from

[`ControlPlaneUser`](../../../contracts/src/interfaces/ControlPlaneUser.md).[`id`](../../../contracts/src/interfaces/ControlPlaneUser.md#id)

***

### permissions?

> `optional` **permissions**: `string`[]

Defined in: packages/runtime/src/context.ts:33

***

### roles

> **roles**: `string`[]

Defined in: packages/runtime/src/context.ts:32

#### Overrides

[`ControlPlaneUser`](../../../contracts/src/interfaces/ControlPlaneUser.md).[`roles`](../../../contracts/src/interfaces/ControlPlaneUser.md#roles)

***

### username

> **username**: `string`

Defined in: packages/runtime/src/context.ts:31
