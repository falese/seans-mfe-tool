[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LayoutManager

# Class: LayoutManager

Defined in: [packages/runtime/src/layout-manager.ts:115](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L115)

## Constructors

### Constructor

> **new LayoutManager**(`config`): `LayoutManager`

Defined in: [packages/runtime/src/layout-manager.ts:142](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L142)

#### Parameters

##### config

[`LayoutManagerConfig`](../interfaces/LayoutManagerConfig.md)

#### Returns

`LayoutManager`

## Accessors

### activeSlots

#### Get Signature

> **get** **activeSlots**(): `string`[]

Defined in: [packages/runtime/src/layout-manager.ts:182](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L182)

Slot ids currently mounted (mainly for tests and shell debugging).

##### Returns

`string`[]

## Methods

### sendAction()

> **sendAction**(`componentId`, `actionType`, `data`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-manager.ts:392](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L392)

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

Defined in: [packages/runtime/src/layout-manager.ts:147](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L147)

Connect to the daemon. The layout stays empty until experiences arrive.

#### Returns

`void`

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-manager.ts:164](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L164)

#### Returns

`Promise`\<`void`\>
