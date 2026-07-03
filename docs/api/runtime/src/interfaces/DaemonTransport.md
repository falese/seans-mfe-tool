[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / DaemonTransport

# Interface: DaemonTransport

Defined in: [packages/runtime/src/layout-transport.ts:10](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L10)

Daemon transport for the LayoutManager (ADR-055): a self-contained
graphql-transport-ws client for the daemon's `messages` subscription and
`sendMessage` mutation, with bounded-backoff reconnect. Deliberately
dependency-free so the runtime ships no WS library.

## Methods

### send()

> **send**(`envelope`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-transport.ts:15](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L15)

Fire the sendMessage mutation with a JSON-encoded envelope.

#### Parameters

##### envelope

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(`onMessage`, `onStatus?`): `void`

Defined in: [packages/runtime/src/layout-transport.ts:12](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L12)

Open the `messages` subscription; deliver each envelope to onMessage.

#### Parameters

##### onMessage

(`envelope`) => `void`

##### onStatus?

(`s`) => `void`

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [packages/runtime/src/layout-transport.ts:13](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L13)

#### Returns

`void`
