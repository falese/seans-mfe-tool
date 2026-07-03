[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ChannelTransport

# Interface: ChannelTransport

Defined in: [packages/runtime/src/daemon-channel.ts:23](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L23)

The neutral slice of the host transport a channel rides — just `send`.

## Methods

### send()

> **send**(`envelope`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/daemon-channel.ts:24](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/daemon-channel.ts#L24)

#### Parameters

##### envelope

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>
