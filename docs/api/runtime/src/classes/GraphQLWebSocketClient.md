[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / GraphQLWebSocketClient

# Class: GraphQLWebSocketClient

Defined in: [packages/runtime/src/graphql-ws-client.ts:71](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L71)

Concrete implementation of DaemonWebSocketClient.

Protocol sketch for a mutation over graphql-transport-ws:
  1. Client → `{ type: "subscribe", id, payload: { query, variables } }`
  2. Server → `{ type: "next",      id, payload: { data: { <field>: <value> } } }`
  3. Server → `{ type: "complete",  id }`                (server signals done)
  4. Client → `{ type: "complete",  id }`                (client acknowledges)

We resolve on step 2 (first "next" frame) and send the client-side "complete"
immediately after to free server-side resources.

## Implements

- [`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md)

## Constructors

### Constructor

> **new GraphQLWebSocketClient**(`socket`): `GraphQLWebSocketClient`

Defined in: [packages/runtime/src/graphql-ws-client.ts:74](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L74)

#### Parameters

##### socket

`MinimalSocket`

#### Returns

`GraphQLWebSocketClient`

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Defined in: [packages/runtime/src/graphql-ws-client.ts:78](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L78)

True when the underlying socket is open and ready to send frames.

##### Returns

`boolean`

True when the underlying socket is open and ready to send frames.

#### Implementation of

[`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md).[`connected`](../interfaces/DaemonWebSocketClient.md#connected)

## Methods

### mutation()

> **mutation**(`query`, `variables`, `timeoutMs`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/graphql-ws-client.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L82)

Execute a GraphQL mutation over the existing WS connection using the
graphql-transport-ws subscribe/next/complete protocol.

#### Parameters

##### query

`string`

Full GraphQL mutation string

##### variables

`Record`\<`string`, `unknown`\>

Variables map

##### timeoutMs

`number` = `4_000`

Abort after this many ms (default 4 000, matches DaemonService.forwardTimeoutMs)

#### Returns

`Promise`\<`boolean`\>

Resolves with the Boolean result of the mutation

#### Throws

Error on timeout or GraphQL-level errors

#### Implementation of

[`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md).[`mutation`](../interfaces/DaemonWebSocketClient.md#mutation)
