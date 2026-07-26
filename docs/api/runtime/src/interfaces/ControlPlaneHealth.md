[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ControlPlaneHealth

# Interface: ControlPlaneHealth

Defined in: packages/runtime/src/base-control-plane.ts:45

## Properties

### registered

> **registered**: `string`[]

Defined in: packages/runtime/src/base-control-plane.ts:48

Names of registered MFEs.

***

### status

> **status**: [`ControlPlaneStatus`](../type-aliases/ControlPlaneStatus.md)

Defined in: packages/runtime/src/base-control-plane.ts:46

***

### uptime?

> `optional` **uptime**: `number`

Defined in: packages/runtime/src/base-control-plane.ts:50

Milliseconds since start() completed. Absent when not running.
