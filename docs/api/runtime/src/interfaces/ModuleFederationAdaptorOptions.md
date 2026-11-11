[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ModuleFederationAdaptorOptions

# Interface: ModuleFederationAdaptorOptions

Defined in: [packages/runtime/src/layout-adaptors.ts:387](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L387)

## Properties

### allowedOrigins?

> `optional` **allowedOrigins**: readonly `string`[]

Defined in: [packages/runtime/src/layout-adaptors.ts:394](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L394)

Origins this shell loads remotes from, e.g. `['https://mfe.example.com']`.
The shell's own origin is always allowed. Omit to load from anywhere,
which is only safe when everything that can write to the registry is
trusted.
