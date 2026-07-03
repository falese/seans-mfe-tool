[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / DaemonConfig

# Interface: DaemonConfig

Defined in: [packages/contracts/src/messages.ts:264](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L264)

Configuration accepted by every daemon implementation. Reconnect constants
are exposed so tests can inject small values.

## Properties

### forwardTimeoutMs?

> `optional` **forwardTimeoutMs**: `number`

Defined in: [packages/contracts/src/messages.ts:276](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L276)

Timeout (ms) for a forwarded action mutation. Default: 4000.

***

### port?

> `optional` **port**: `number`

Defined in: [packages/contracts/src/messages.ts:268](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L268)

Port the daemon's own GraphQL/WebSocket server listens on. Default: 3001.

***

### reconnectBaseMs?

> `optional` **reconnectBaseMs**: `number`

Defined in: [packages/contracts/src/messages.ts:270](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L270)

Starting delay (ms) for the first reconnect attempt. Default: 400.

***

### reconnectFactor?

> `optional` **reconnectFactor**: `number`

Defined in: [packages/contracts/src/messages.ts:274](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L274)

Exponential growth rate per failed attempt. Default: 1.6.

***

### reconnectMaxMs?

> `optional` **reconnectMaxMs**: `number`

Defined in: [packages/contracts/src/messages.ts:272](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L272)

Maximum reconnect delay (ms). Default: 5000.

***

### registryUrl?

> `optional` **registryUrl**: `string`

Defined in: [packages/contracts/src/messages.ts:266](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L266)

WebSocket URL to the registry. Default: ws://registry:4000/graphql.
