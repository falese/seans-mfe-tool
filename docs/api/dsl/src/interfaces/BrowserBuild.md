[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / BrowserBuild

# Interface: BrowserBuild

Defined in: packages/dsl/src/browser-build.ts:58

A manifest's browser build, as the registry sees it.

## Properties

### capabilities

> **capabilities**: `string`[]

Defined in: packages/dsl/src/browser-build.ts:65

The domain capabilities it implements — `targets.rust.capabilities`, else all.

***

### name

> **name**: `string`

Defined in: packages/dsl/src/browser-build.ts:60

`<name>-wasm` — what a placement's `from` names.

***

### remoteEntryUrl?

> `optional` **remoteEntryUrl**: `string`

Defined in: packages/dsl/src/browser-build.ts:63

`<endpoint>/wasm/remoteEntry.js`; absent when the manifest has no endpoint.

***

### scope

> **scope**: `string`

Defined in: packages/dsl/src/browser-build.ts:61
