[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / rustWasmScope

# Function: rustWasmScope()

> **rustWasmScope**(`manifest`): `string`

Defined in: packages/dsl/src/browser-build.ts:53

The Module Federation scope the browser build registers under.

Deliberately NOT the web remote's scope (`name` with `-` → `_`): both builds
of one MFE must be able to sit on the same page, and a container is a global
keyed by scope (ADR-100).

## Parameters

### manifest

[`RustNamingInput`](../interfaces/RustNamingInput.md)

## Returns

`string`
