[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / GraphQLTransportWsDaemonTransport

# Class: GraphQLTransportWsDaemonTransport

Defined in: [packages/runtime/src/layout-transport.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L62)

Self-contained graphql-transport-ws client for the daemon's `messages`
subscription and `sendMessage` mutation, with bounded-backoff reconnect.

## Implements

- [`DaemonTransport`](../interfaces/DaemonTransport.md)

## Constructors

### Constructor

> **new GraphQLTransportWsDaemonTransport**(`url`, `createSocket`): `GraphQLTransportWsDaemonTransport`

Defined in: [packages/runtime/src/layout-transport.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L68)

#### Parameters

##### url

`string`

##### createSocket

(`url`, `protocol`) => [`WebSocketLike`](../interfaces/WebSocketLike.md)

#### Returns

`GraphQLTransportWsDaemonTransport`

## Methods

### send()

> **send**(`envelope`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-transport.ts:122](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L122)

Fire the sendMessage mutation with a JSON-encoded envelope.

#### Parameters

##### envelope

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`DaemonTransport`](../interfaces/DaemonTransport.md).[`send`](../interfaces/DaemonTransport.md#send)

***

### start()

> **start**(`onMessage`, `onStatus?`): `void`

Defined in: [packages/runtime/src/layout-transport.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L73)

Open the `messages` subscription; deliver each envelope to onMessage.

#### Parameters

##### onMessage

(`envelope`) => `void`

##### onStatus?

(`s`) => `void`

#### Returns

`void`

#### Implementation of

[`DaemonTransport`](../interfaces/DaemonTransport.md).[`start`](../interfaces/DaemonTransport.md#start)

***

### stop()

> **stop**(): `void`

Defined in: [packages/runtime/src/layout-transport.ts:116](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L116)

#### Returns

`void`

#### Implementation of

[`DaemonTransport`](../interfaces/DaemonTransport.md).[`stop`](../interfaces/DaemonTransport.md#stop)
