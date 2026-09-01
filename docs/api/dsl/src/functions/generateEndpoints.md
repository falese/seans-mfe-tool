[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / generateEndpoints

# Function: generateEndpoints()

> **generateEndpoints**(`name`, `port`): `Pick`\<[`DSLManifest`](../type-aliases/DSLManifest.md), `"endpoint"` \| `"remoteEntry"` \| `"discovery"`\>

Defined in: [packages/dsl/src/parser.ts:368](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/parser.ts#L368)

Generate endpoint URLs from name and port

## Parameters

### name

`string`

MFE name

### port

`number`

Port number

## Returns

`Pick`\<[`DSLManifest`](../type-aliases/DSLManifest.md), `"endpoint"` \| `"remoteEntry"` \| `"discovery"`\>

Endpoint configuration
