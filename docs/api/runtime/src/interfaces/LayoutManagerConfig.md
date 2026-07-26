[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LayoutManagerConfig

# Interface: LayoutManagerConfig

Defined in: packages/runtime/src/layout-manager.ts:57

## Properties

### adaptors?

> `optional` **adaptors**: `Record`\<`string`, [`ExperienceAdaptor`](ExperienceAdaptor.md)\>

Defined in: packages/runtime/src/layout-manager.ts:71

contentType → adaptor (the provider registry, keyed by handle kind).
 Merged over the built-in defaults.

***

### container

> **container**: [`LayoutHostLike`](LayoutHostLike.md)

Defined in: packages/runtime/src/layout-manager.ts:59

Where experiences are mounted. The manager creates one child per slot.

***

### createSlotElement()?

> `optional` **createSlotElement**: (`slotId`) => [`SlotElementLike`](SlotElementLike.md)

Defined in: packages/runtime/src/layout-manager.ts:73

Slot element factory — defaults to document.createElement('section').

#### Parameters

##### slotId

`string`

#### Returns

[`SlotElementLike`](SlotElementLike.md)

***

### hostFramework?

> `optional` **hostFramework**: `string`

Defined in: packages/runtime/src/layout-manager.ts:68

The host's framework (e.g. 'react'). Passed to adaptors for handle
negotiation (ADR-056). Absent for a framework-free host — every MFE then
composes via its guaranteed imperative handle (isolation).

***

### onError()?

> `optional` **onError**: (`message`) => `void`

Defined in: packages/runtime/src/layout-manager.ts:88

Error callback (adaptor mount failures, resolution errors, slot errors).

#### Parameters

##### message

`string`

#### Returns

`void`

***

### onStatus()?

> `optional` **onStatus**: (`status`) => `void`

Defined in: packages/runtime/src/layout-manager.ts:86

Status callback for shell chrome (connection indicator etc.).

#### Parameters

##### status

[`TransportStatus`](../type-aliases/TransportStatus.md)

#### Returns

`void`

***

### providerValues?

> `optional` **providerValues**: `Record`\<`string`, `unknown`\>

Defined in: packages/runtime/src/layout-manager.ts:79

Host-injected provider values delivered to every mounted MFE as
`props.hostContext` (ADR-060 value-injection). The island re-provides its
own framework context from these.

***

### renderSlotFallback()?

> `optional` **renderSlotFallback**: (`slot`, `info`) => `void`

Defined in: packages/runtime/src/layout-manager.ts:84

Render the slot-scoped fallback shown when an experience fails (ADR-060).
Defaults to neutral inline markup; override for branded fallbacks.

#### Parameters

##### slot

[`SlotElementLike`](SlotElementLike.md)

##### info

[`SlotErrorInfo`](SlotErrorInfo.md)

#### Returns

`void`

***

### session?

> `optional` **session**: [`SessionContext`](../../../contracts/src/interfaces/SessionContext.md)

Defined in: packages/runtime/src/layout-manager.ts:62

Threaded onto every action so the registry resolves per user/app.

***

### transport

> **transport**: [`DaemonTransport`](DaemonTransport.md)

Defined in: packages/runtime/src/layout-manager.ts:60
