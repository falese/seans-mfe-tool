[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / pushControlPlaneState

# Function: pushControlPlaneState()

> **pushControlPlaneState**(`mfe`, `stateKey`, `stateData`, `options`): `Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>

Defined in: packages/runtime/src/control-plane-state.ts:40

Push domain state to the daemon so the registry can re-evaluate placement
rules — the inherited `updateControlPlaneState` capability, with the
`Context` construction done for you.

## Parameters

### mfe

[`ControlPlaneStatePusher`](../interfaces/ControlPlaneStatePusher.md)

### stateKey

`string`

### stateData

`Record`\<`string`, `unknown`\>

### options

[`PushControlPlaneStateOptions`](../interfaces/PushControlPlaneStateOptions.md) = `{}`

## Returns

`Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>
