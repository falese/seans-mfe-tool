[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / assertPresentationHandles

# Function: assertPresentationHandles()

> **assertPresentationHandles**(`value`): `asserts value is PresentationHandles`

Defined in: packages/contracts/src/presentation.ts:112

Validate a handle bundle at a service/runtime boundary (usable from plain
JS providers). Throws if the guaranteed imperative floor is missing —
an MFE without it cannot be composed polyglot.

## Parameters

### value

`unknown`

## Returns

`asserts value is PresentationHandles`
