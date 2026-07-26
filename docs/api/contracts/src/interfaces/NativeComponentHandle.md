[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / NativeComponentHandle

# Interface: NativeComponentHandle

Defined in: packages/contracts/src/presentation.ts:68

An opt-in, framework-native artifact. `component` is opaque to the core —
only a Framework Provider for `framework` knows its shape (e.g. a React
component). Tagging, never inspection, is what keeps the core neutral.

## Properties

### component

> **component**: `unknown`

Defined in: packages/contracts/src/presentation.ts:72

***

### framework

> **framework**: `string`

Defined in: packages/contracts/src/presentation.ts:71

***

### kind

> **kind**: `string`

Defined in: packages/contracts/src/presentation.ts:70

Anything but 'imperative-dom', e.g. 'react-component'.
