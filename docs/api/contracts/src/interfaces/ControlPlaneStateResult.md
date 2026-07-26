[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ControlPlaneStateResult

# Interface: ControlPlaneStateResult

Defined in: packages/contracts/src/messages.ts:251

What `BaseMFE.updateControlPlaneState()` resolves with. Maps to the
ACTION_ECHO metadata the daemon publishes; `resolution` is populated when
the registry produced a new resolution synchronously (usually it arrives
asynchronously as a COMPONENT_UPDATE instead).

## Properties

### acknowledged

> **acknowledged**: `boolean`

Defined in: packages/contracts/src/messages.ts:252

***

### correlationId

> **correlationId**: `string`

Defined in: packages/contracts/src/messages.ts:253

***

### error

> **error**: `string` \| `null`

Defined in: packages/contracts/src/messages.ts:254

***

### resolution?

> `optional` **resolution**: [`Resolution`](Resolution.md) \| `null`

Defined in: packages/contracts/src/messages.ts:255
