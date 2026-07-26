[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ImperativeMount

# Type Alias: ImperativeMount()

> **ImperativeMount** = (`element`, `options?`) => [`ImperativeUnmount`](ImperativeUnmount.md) \| `Promise`\<[`ImperativeUnmount`](ImperativeUnmount.md)\>

Defined in: [packages/contracts/src/presentation.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L47)

Imperative mount: element + options (capability + props) in, teardown out.

## Parameters

### element

[`MountElement`](../interfaces/MountElement.md)

### options?

[`MountOptions`](../interfaces/MountOptions.md)

## Returns

[`ImperativeUnmount`](ImperativeUnmount.md) \| `Promise`\<[`ImperativeUnmount`](ImperativeUnmount.md)\>
