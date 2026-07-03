[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / AdaptorHelpers

# Interface: AdaptorHelpers

Defined in: [packages/runtime/src/layout-adaptors.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L42)

## Properties

### channel?

> `optional` **channel**: [`DaemonWebSocketClient`](DaemonWebSocketClient.md)

Defined in: [packages/runtime/src/layout-adaptors.ts:50](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L50)

A virtual daemon channel for this slot (ADR-057): the host's single socket,
scoped to this slot. Injected into a composed MFE's `deps.wsClient` so its
`updateControlPlaneState` platform capability rides the shared connection.

***

### hostFramework?

> `optional` **hostFramework**: `string`

Defined in: [packages/runtime/src/layout-adaptors.ts:66](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L66)

The host's framework (e.g. 'react'), when known. Threaded for ADR-056
handle negotiation: a provider will pick the MFE's native handle when the
host framework matches. The in-tree native path is DEFERRED (ADR-056), so
today every adaptor composes via the guaranteed imperative floor regardless
of this value — it is carried, not yet acted on.

***

### providerValues?

> `optional` **providerValues**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/layout-adaptors.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L73)

Host-injected provider values (theme, locale, auth claims, router state, …)
that cross the waist as DATA (ADR-060 value-injection). The MFE island
re-provides its own context from these — context reaches the MFE without a
shared reconciler, so isolation, polyglot, and multi-version React all hold.

***

### session?

> `optional` **session**: [`SessionContext`](../../../contracts/src/interfaces/SessionContext.md)

Defined in: [packages/runtime/src/layout-adaptors.ts:58](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L58)

The session this experience was rendered for, when known.

## Methods

### provideSlot()?

> `optional` **provideSlot**(`slotId`, `element`): `void`

Defined in: [packages/runtime/src/layout-adaptors.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L56)

Contribute a named slot to the host layout (ADR-058): the MFE renders a
region and registers its element so the host routes later experiences
(`props.slot === slotId`) into it. The layout itself becomes an MFE.

#### Parameters

##### slotId

`string`

##### element

[`SlotElementLike`](SlotElementLike.md)

#### Returns

`void`

***

### reportError()

> **reportError**(`error`, `info?`): `void`

Defined in: [packages/runtime/src/layout-adaptors.ts:80](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L80)

Report an unrecovered error from inside the mounted island (ADR-060). The
MFE's framework error boundary / lifecycle `error` phase routes here via its
`emit` capability. The host renders a slot-scoped fallback and escalates to
the control plane; it is slot-isolated and never cascades to siblings.

#### Parameters

##### error

`unknown`

##### info?

###### phase?

`string`

#### Returns

`void`

***

### sendAction()

> **sendAction**(`actionType`, `data`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-adaptors.ts:44](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L44)

Send an action back up the control plane for this experience.

#### Parameters

##### actionType

`string`

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>
