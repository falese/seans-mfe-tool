[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / DaemonTransport

# Interface: DaemonTransport

Defined in: [packages/runtime/src/layout-transport.ts:12](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L12)

## Methods

### send()

> **send**(`envelope`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/layout-transport.ts:17](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L17)

Fire the sendMessage mutation with a JSON-encoded envelope.

#### Parameters

##### envelope

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(`onMessage`, `onStatus?`): `void`

Defined in: [packages/runtime/src/layout-transport.ts:14](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L14)

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

Defined in: [packages/runtime/src/layout-transport.ts:15](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L15)

#### Returns

`void`
