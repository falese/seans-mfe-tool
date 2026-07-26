[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / WebSocketLike

# Interface: WebSocketLike

Defined in: [packages/runtime/src/layout-transport.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L43)

Minimal WebSocket surface so tests can inject a fake socket factory.

## Properties

### onclose

> **onclose**: () => `void` \| `null`

Defined in: [packages/runtime/src/layout-transport.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L48)

***

### onerror

> **onerror**: (`err`) => `void` \| `null`

Defined in: [packages/runtime/src/layout-transport.ts:49](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L49)

***

### onmessage

> **onmessage**: (`event`) => `void` \| `null`

Defined in: [packages/runtime/src/layout-transport.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L47)

***

### onopen

> **onopen**: () => `void` \| `null`

Defined in: [packages/runtime/src/layout-transport.ts:46](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L46)

## Methods

### close()

> **close**(): `void`

Defined in: [packages/runtime/src/layout-transport.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L45)

#### Returns

`void`

***

### send()

> **send**(`data`): `void`

Defined in: [packages/runtime/src/layout-transport.ts:44](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L44)

#### Parameters

##### data

`string`

#### Returns

`void`
