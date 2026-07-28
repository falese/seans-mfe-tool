[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / isValidLifecycleTransition

# Function: isValidLifecycleTransition()

> **isValidLifecycleTransition**(`from`, `to`): `boolean`

Defined in: [packages/contracts/src/platform-contract.ts:76](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/platform-contract.ts#L76)

Whether `from → to` is an edge of the machine.

## Parameters

### from

`"error"` | `"uninitialized"` | `"loading"` | `"ready"` | `"rendering"` | `"destroyed"`

### to

`"error"` | `"uninitialized"` | `"loading"` | `"ready"` | `"rendering"` | `"destroyed"`

## Returns

`boolean`
