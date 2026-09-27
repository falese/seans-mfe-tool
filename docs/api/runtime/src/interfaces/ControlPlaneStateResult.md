[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ControlPlaneStateResult

# Interface: ControlPlaneStateResult

Defined in: [packages/runtime/src/capability-results.ts:125](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L125)

Result from updateControlPlaneState capability.

Mirrors ControlPlaneStateResult in @seans-mfe/contracts, with `error`
optional so implementors of doUpdateControlPlaneState may omit it (the wire
form always sets it). The `resolution` shape IS the contracts `Resolution`.

## Properties

### acknowledged

> **acknowledged**: `boolean`

Defined in: [packages/runtime/src/capability-results.ts:127](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L127)

Whether the daemon acknowledged the state update

***

### correlationId

> **correlationId**: `string`

Defined in: [packages/runtime/src/capability-results.ts:129](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L129)

Correlation ID for tracing this update through the control plane

***

### error?

> `optional` **error**: `string` \| `null`

Defined in: [packages/runtime/src/capability-results.ts:131](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L131)

Non-null when the update could not be delivered (not connected, timeout, etc.)

***

### resolution?

> `optional` **resolution**: [`Resolution`](../../../contracts/src/interfaces/Resolution.md) \| `null`

Defined in: [packages/runtime/src/capability-results.ts:137](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L137)

Populated when the registry immediately resolved a new component based
on the state update. In practice this may arrive asynchronously via the
daemon's Subscription.messages channel instead.
