[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / DaemonChannel

# Class: DaemonChannel

Defined in: [packages/runtime/src/daemon-channel.ts:27](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L27)

Platform-facing interface used in BaseMFEDependencies.
Keeps the abstract base class decoupled from the concrete implementation.

## Implements

- [`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md)

## Constructors

### Constructor

> **new DaemonChannel**(`transport`, `channelId`, `isConnected`): `DaemonChannel`

Defined in: [packages/runtime/src/daemon-channel.ts:28](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L28)

#### Parameters

##### transport

[`ChannelTransport`](../interfaces/ChannelTransport.md)

##### channelId

`string`

##### isConnected

() => `boolean`

#### Returns

`DaemonChannel`

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Defined in: [packages/runtime/src/daemon-channel.ts:35](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L35)

True when the host's single physical socket is open.

##### Returns

`boolean`

True when the underlying socket is open and ready to send frames.

#### Implementation of

[`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md).[`connected`](../interfaces/DaemonWebSocketClient.md#connected)

***

### id

#### Get Signature

> **get** **id**(): `string`

Defined in: [packages/runtime/src/daemon-channel.ts:40](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L40)

The channel's address (slot id, or nested path for recursive hosts).

##### Returns

`string`

## Methods

### child()

> **child**(`subId`): `DaemonChannel`

Defined in: [packages/runtime/src/daemon-channel.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L48)

Open a nested channel for an MFE composed inside this one. The id composes
into a path so the control plane reasons about nested slots uniformly.

#### Parameters

##### subId

`string`

#### Returns

`DaemonChannel`

***

### mutation()

> **mutation**(`_query`, `variables`, `_timeoutMs?`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/daemon-channel.ts:58](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L58)

`updateControlPlaneState` sends `sendMessage($m)` with `m` = a JSON-encoded
action envelope. Decode it, stamp the channel id for per-slot attribution,
and route it over the host's single socket rather than opening a new one.
Returns true once the envelope is handed to the transport.

#### Parameters

##### \_query

`string`

##### variables

`Record`\<`string`, `unknown`\>

##### \_timeoutMs?

`number`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md).[`mutation`](../interfaces/DaemonWebSocketClient.md#mutation)
