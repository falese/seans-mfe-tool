[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ControlPlaneStateResult

# Interface: ControlPlaneStateResult

Defined in: [packages/runtime/src/base-mfe.ts:167](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L167)

Result from updateControlPlaneState capability.

Mirrors ControlPlaneStateResult in @seans-mfe/contracts, with `error`
optional so implementors of doUpdateControlPlaneState may omit it (the wire
form always sets it). The `resolution` shape IS the contracts `Resolution`.

## Properties

### acknowledged

> **acknowledged**: `boolean`

Defined in: [packages/runtime/src/base-mfe.ts:169](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L169)

Whether the daemon acknowledged the state update

***

### correlationId

> **correlationId**: `string`

Defined in: [packages/runtime/src/base-mfe.ts:171](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L171)

Correlation ID for tracing this update through the control plane

***

### error?

> `optional` **error**: `string`

Defined in: [packages/runtime/src/base-mfe.ts:173](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L173)

Non-null when the update could not be delivered (not connected, timeout, etc.)

***

### resolution?

> `optional` **resolution**: [`Resolution`](../../../contracts/src/interfaces/Resolution.md)

Defined in: [packages/runtime/src/base-mfe.ts:179](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L179)

Populated when the registry immediately resolved a new component based
on the state update. In practice this may arrive asynchronously via the
daemon's Subscription.messages channel instead.
