[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LayoutManager

# Class: LayoutManager

Defined in: [packages/runtime/src/layout-manager.ts:122](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L122)

## Constructors

### Constructor

> **new LayoutManager**(`config`): `LayoutManager`

Defined in: [packages/runtime/src/layout-manager.ts:149](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L149)

#### Parameters

##### config

[`LayoutManagerConfig`](../interfaces/LayoutManagerConfig.md)

#### Returns

`LayoutManager`

## Accessors

### activeSlots

#### Get Signature

> **get** **activeSlots**(): `string`[]

Defined in: [packages/runtime/src/layout-manager.ts:192](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L192)

Slot ids currently mounted (mainly for tests and shell debugging).

##### Returns

`string`[]

## Methods

### sendAction()

> **sendAction**(`componentId`, `actionType`, `data`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-manager.ts:413](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L413)

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

Defined in: [packages/runtime/src/layout-manager.ts:157](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L157)

Connect to the daemon. The layout stays empty until experiences arrive.

#### Returns

`void`

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-manager.ts:174](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L174)

#### Returns

`Promise`\<`void`\>
