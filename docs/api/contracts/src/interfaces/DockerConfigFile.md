[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / DockerConfigFile

# Interface: DockerConfigFile

Defined in: [packages/contracts/src/framework-plugin.ts:39](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L39)

A file copied into the runtime stage of a generated Dockerfile.
`from` selects the COPY source: the build context, or the
`seans-mfe-tool-cli` builder image (which bundles the codegen templates).

## Properties

### dest

> **dest**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L42)

***

### from

> **from**: `"context"` \| `"cli-builder"`

Defined in: [packages/contracts/src/framework-plugin.ts:40](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L40)

***

### src

> **src**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L41)
