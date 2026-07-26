[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / WebSocketLike

# Interface: WebSocketLike

Defined in: packages/runtime/src/layout-transport.ts:43

Minimal WebSocket surface so tests can inject a fake socket factory.

## Properties

### onclose

> **onclose**: () => `void` \| `null`

Defined in: packages/runtime/src/layout-transport.ts:48

***

### onerror

> **onerror**: (`err`) => `void` \| `null`

Defined in: packages/runtime/src/layout-transport.ts:49

***

### onmessage

> **onmessage**: (`event`) => `void` \| `null`

Defined in: packages/runtime/src/layout-transport.ts:47

***

### onopen

> **onopen**: () => `void` \| `null`

Defined in: packages/runtime/src/layout-transport.ts:46

## Methods

### close()

> **close**(): `void`

Defined in: packages/runtime/src/layout-transport.ts:45

#### Returns

`void`

***

### send()

> **send**(`data`): `void`

Defined in: packages/runtime/src/layout-transport.ts:44

#### Parameters

##### data

`string`

#### Returns

`void`
