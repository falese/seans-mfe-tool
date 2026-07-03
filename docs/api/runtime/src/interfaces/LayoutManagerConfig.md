[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LayoutManagerConfig

# Interface: LayoutManagerConfig

Defined in: [packages/runtime/src/layout-manager.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L56)

## Properties

### adaptors?

> `optional` **adaptors**: `Record`\<`string`, [`ExperienceAdaptor`](ExperienceAdaptor.md)\>

Defined in: [packages/runtime/src/layout-manager.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L70)

contentType → adaptor (the provider registry, keyed by handle kind).
 Merged over the built-in defaults.

***

### container

> **container**: [`LayoutHostLike`](LayoutHostLike.md)

Defined in: [packages/runtime/src/layout-manager.ts:58](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L58)

Where experiences are mounted. The manager creates one child per slot.

***

### createSlotElement()?

> `optional` **createSlotElement**: (`slotId`) => [`SlotElementLike`](SlotElementLike.md)

Defined in: [packages/runtime/src/layout-manager.ts:72](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L72)

Slot element factory — defaults to document.createElement('section').

#### Parameters

##### slotId

`string`

#### Returns

[`SlotElementLike`](SlotElementLike.md)

***

### hostFramework?

> `optional` **hostFramework**: `string`

Defined in: [packages/runtime/src/layout-manager.ts:67](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L67)

The host's framework (e.g. 'react'). Passed to adaptors for handle
negotiation (ADR-056). Absent for a framework-free host — every MFE then
composes via its guaranteed imperative handle (isolation).

***

### onError()?

> `optional` **onError**: (`message`) => `void`

Defined in: [packages/runtime/src/layout-manager.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L87)

Error callback (adaptor mount failures, resolution errors, slot errors).

#### Parameters

##### message

`string`

#### Returns

`void`

***

### onStatus()?

> `optional` **onStatus**: (`status`) => `void`

Defined in: [packages/runtime/src/layout-manager.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L85)

Status callback for shell chrome (connection indicator etc.).

#### Parameters

##### status

[`TransportStatus`](../type-aliases/TransportStatus.md)

#### Returns

`void`

***

### providerValues?

> `optional` **providerValues**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/layout-manager.ts:78](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L78)

Host-injected provider values delivered to every mounted MFE as
`props.hostContext` (ADR-060 value-injection). The island re-provides its
own framework context from these.

***

### renderSlotFallback()?

> `optional` **renderSlotFallback**: (`slot`, `info`) => `void`

Defined in: [packages/runtime/src/layout-manager.ts:83](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L83)

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

Defined in: [packages/runtime/src/layout-manager.ts:61](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L61)

Threaded onto every action so the registry resolves per user/app.

***

### transport

> **transport**: [`DaemonTransport`](DaemonTransport.md)

Defined in: [packages/runtime/src/layout-manager.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L59)
