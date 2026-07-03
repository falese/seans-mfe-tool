[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LayoutManager

# Class: LayoutManager

Defined in: [packages/runtime/src/layout-manager.ts:106](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L106)

## Constructors

### Constructor

> **new LayoutManager**(`config`): `LayoutManager`

Defined in: [packages/runtime/src/layout-manager.ts:112](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L112)

#### Parameters

##### config

[`LayoutManagerConfig`](../interfaces/LayoutManagerConfig.md)

#### Returns

`LayoutManager`

## Accessors

### activeSlots

#### Get Signature

> **get** **activeSlots**(): `string`[]

Defined in: [packages/runtime/src/layout-manager.ts:133](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L133)

Slot ids currently mounted (mainly for tests and shell debugging).

##### Returns

`string`[]

## Methods

### sendAction()

> **sendAction**(`componentId`, `actionType`, `data`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-manager.ts:260](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L260)

Send an action up the control plane, carrying the session context.

#### Parameters

##### componentId

`string`

##### actionType

`string`

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(): `void`

Defined in: [packages/runtime/src/layout-manager.ts:117](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L117)

Connect to the daemon. The layout stays empty until experiences arrive.

#### Returns

`void`

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-manager.ts:127](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L127)

#### Returns

`Promise`\<`void`\>
