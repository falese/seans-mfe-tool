[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ModuleFederationContainer

# Interface: ModuleFederationContainer

Defined in: [packages/runtime/src/base-remote-mfe.ts:104](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L104)

Module Federation container interface

## Methods

### get()

> **get**(`module`): `Promise`\<() => `unknown`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:106](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L106)

#### Parameters

##### module

`string`

#### Returns

`Promise`\<() => `unknown`\>

***

### init()

> **init**(`shared`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:105](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L105)

#### Parameters

##### shared

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>
