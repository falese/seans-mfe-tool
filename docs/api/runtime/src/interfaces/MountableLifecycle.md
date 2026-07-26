[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / MountableLifecycle

# Interface: MountableLifecycle

Defined in: packages/runtime/src/imperative-handle.ts:20

The neutral subset of BaseMFE that an imperative handle drives. Structural,
so this module needs neither a concrete MFE class nor a UI framework.

## Methods

### destroy()?

> `optional` **destroy**(): `void` \| `Promise`\<`void`\>

Defined in: packages/runtime/src/imperative-handle.ts:23

#### Returns

`void` \| `Promise`\<`void`\>

***

### load()?

> `optional` **load**(`context`): `unknown`

Defined in: packages/runtime/src/imperative-handle.ts:21

#### Parameters

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`unknown`

***

### render()

> **render**(`context`): `unknown`

Defined in: packages/runtime/src/imperative-handle.ts:22

#### Parameters

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`unknown`
