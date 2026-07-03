[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / BuildError

# Interface: BuildError

Defined in: [packages/contracts/src/framework-plugin.ts:74](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L74)

Classified build error with optional source location.

## Properties

### category

> **category**: `"unknown"` \| `"type"` \| `"syntax"` \| `"dependency"` \| `"config"` \| `"runtime"`

Defined in: [packages/contracts/src/framework-plugin.ts:79](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L79)

***

### column?

> `optional` **column**: `number`

Defined in: [packages/contracts/src/framework-plugin.ts:77](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L77)

***

### file?

> `optional` **file**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:75](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L75)

***

### line?

> `optional` **line**: `number`

Defined in: [packages/contracts/src/framework-plugin.ts:76](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L76)

***

### message

> **message**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:78](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L78)

***

### suggestion?

> `optional` **suggestion**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:80](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L80)
