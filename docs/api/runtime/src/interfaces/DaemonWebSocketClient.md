[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / DaemonWebSocketClient

# Interface: DaemonWebSocketClient

Defined in: [packages/runtime/src/graphql-ws-client.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L38)

Platform-facing interface used in BaseMFEDependencies.
Keeps the abstract base class decoupled from the concrete implementation.

## Properties

### connected

> `readonly` **connected**: `boolean`

Defined in: [packages/runtime/src/graphql-ws-client.ts:40](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L40)

True when the underlying socket is open and ready to send frames.

## Methods

### mutation()

> **mutation**(`query`, `variables`, `timeoutMs?`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/graphql-ws-client.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/graphql-ws-client.ts#L52)

Execute a GraphQL mutation over the existing WS connection using the
graphql-transport-ws subscribe/next/complete protocol.

#### Parameters

##### query

`string`

Full GraphQL mutation string

##### variables

`Record`\<`string`, `unknown`\>

Variables map

##### timeoutMs?

`number`

Abort after this many ms (default 4 000, matches DaemonService.forwardTimeoutMs)

#### Returns

`Promise`\<`boolean`\>

Resolves with the Boolean result of the mutation

#### Throws

Error on timeout or GraphQL-level errors
