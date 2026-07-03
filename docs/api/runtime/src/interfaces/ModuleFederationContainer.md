[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ModuleFederationContainer

# Interface: ModuleFederationContainer

Defined in: [packages/runtime/src/base-remote-mfe.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L92)

Module Federation container interface

## Methods

### get()

> **get**(`module`): `Promise`\<() => `unknown`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L94)

#### Parameters

##### module

`string`

#### Returns

`Promise`\<() => `unknown`\>

***

### init()

> **init**(`shared`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:93](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L93)

#### Parameters

##### shared

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>
