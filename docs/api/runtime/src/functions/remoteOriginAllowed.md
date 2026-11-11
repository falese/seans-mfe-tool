[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / remoteOriginAllowed

# Function: remoteOriginAllowed()

> **remoteOriginAllowed**(`remoteEntryUrl`, `allowedOrigins`, `pageOrigin`): `boolean`

Defined in: [packages/runtime/src/layout-adaptors.ts:364](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L364)

Whether `remoteEntryUrl` is served from one of `allowedOrigins`, or from the
page's own origin (ADR-124).

Compared as parsed origins — scheme, host and port together — never as
string prefixes: `https://mfe.example.com.evil.example` starts with an
allowed origin and is not one. A relative URL resolves against `pageOrigin`
and is the shell's own, so it is allowed; with no page to resolve against
it is refused. Anything that does not parse, or has no origin of its own
(`data:`, `javascript:`), is refused.

## Parameters

### remoteEntryUrl

`string`

### allowedOrigins

readonly `string`[]

### pageOrigin

`string` | `undefined`

## Returns

`boolean`
