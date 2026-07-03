[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ControlPlaneHealth

# Interface: ControlPlaneHealth

Defined in: [packages/runtime/src/base-control-plane.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L45)

## Properties

### registered

> **registered**: `string`[]

Defined in: [packages/runtime/src/base-control-plane.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L48)

Names of registered MFEs.

***

### status

> **status**: [`ControlPlaneStatus`](../type-aliases/ControlPlaneStatus.md)

Defined in: [packages/runtime/src/base-control-plane.ts:46](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L46)

***

### uptime?

> `optional` **uptime**: `number`

Defined in: [packages/runtime/src/base-control-plane.ts:50](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L50)

Milliseconds since start() completed. Absent when not running.
