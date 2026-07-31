[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ControlPlaneStatePusher

# Interface: ControlPlaneStatePusher

Defined in: packages/runtime/src/control-plane-state.ts:26

The neutral subset of BaseMFE this module needs — structural, so callers
never have to import a concrete MFE class or cast to a narrow local type.

## Methods

### updateControlPlaneState()

> **updateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](ControlPlaneStateResult.md)\>

Defined in: packages/runtime/src/control-plane-state.ts:27

#### Parameters

##### context

[`Context`](Context.md)

#### Returns

`Promise`\<[`ControlPlaneStateResult`](ControlPlaneStateResult.md)\>
