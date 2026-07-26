[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / BuildError

# Interface: BuildError

Defined in: [packages/contracts/src/framework-plugin.ts:74](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L74)

Classified build error with optional source location.

## Properties

### category

> **category**: `"syntax"` \| `"type"` \| `"dependency"` \| `"config"` \| `"runtime"` \| `"unknown"`

Defined in: [packages/contracts/src/framework-plugin.ts:79](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L79)

***

### code?

> `optional` **code**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L85)

Compiler diagnostic code where the toolchain emits one (`TS2339`). Lets an
agent look the failure up or match on it without parsing the message.

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
