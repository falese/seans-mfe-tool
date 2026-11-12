[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / createModuleFederationAdaptor

# Function: createModuleFederationAdaptor()

> **createModuleFederationAdaptor**(`options`): [`ExperienceAdaptor`](../interfaces/ExperienceAdaptor.md)

Defined in: [packages/runtime/src/layout-adaptors.ts:412](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L412)

The module-federation adaptor, holding the shell's allow-list (ADR-124).

A placement's `remoteEntryUrl` is injected as a <script> into the shell's
own page, so whoever can put a URL in a placement runs code as the shell.
With `allowedOrigins` set, a remote from any other origin is refused with a
SecurityError before anything is fetched or added to the page.

## Parameters

### options

[`ModuleFederationAdaptorOptions`](../interfaces/ModuleFederationAdaptorOptions.md) = `{}`

## Returns

[`ExperienceAdaptor`](../interfaces/ExperienceAdaptor.md)
