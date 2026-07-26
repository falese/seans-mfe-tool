[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / BuildError

# Interface: BuildError

Defined in: packages/contracts/src/framework-plugin.ts:74

Classified build error with optional source location.

## Properties

### category

> **category**: `"syntax"` \| `"type"` \| `"dependency"` \| `"config"` \| `"runtime"` \| `"unknown"`

Defined in: packages/contracts/src/framework-plugin.ts:79

***

### code?

> `optional` **code**: `string`

Defined in: packages/contracts/src/framework-plugin.ts:85

Compiler diagnostic code where the toolchain emits one (`TS2339`). Lets an
agent look the failure up or match on it without parsing the message.

***

### column?

> `optional` **column**: `number`

Defined in: packages/contracts/src/framework-plugin.ts:77

***

### file?

> `optional` **file**: `string`

Defined in: packages/contracts/src/framework-plugin.ts:75

***

### line?

> `optional` **line**: `number`

Defined in: packages/contracts/src/framework-plugin.ts:76

***

### message

> **message**: `string`

Defined in: packages/contracts/src/framework-plugin.ts:78

***

### suggestion?

> `optional` **suggestion**: `string`

Defined in: packages/contracts/src/framework-plugin.ts:80
