[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ChannelTransport

# Interface: ChannelTransport

Defined in: [packages/runtime/src/daemon-channel.ts:28](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L28)

The neutral slice of the host transport a channel rides — just `send`.

## Methods

### send()

> **send**(`envelope`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/daemon-channel.ts:29](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L29)

#### Parameters

##### envelope

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>
