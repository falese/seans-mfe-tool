[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / isValidLifecycleTransition

# Function: isValidLifecycleTransition()

> **isValidLifecycleTransition**(`from`, `to`): `boolean`

Defined in: packages/contracts/src/platform-contract.ts:76

Whether `from → to` is an edge of the machine.

## Parameters

### from

`"uninitialized"` | `"loading"` | `"ready"` | `"rendering"` | `"error"` | `"destroyed"`

### to

`"uninitialized"` | `"loading"` | `"ready"` | `"rendering"` | `"error"` | `"destroyed"`

## Returns

`boolean`
