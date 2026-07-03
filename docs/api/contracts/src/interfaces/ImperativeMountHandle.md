[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ImperativeMountHandle

# Interface: ImperativeMountHandle

Defined in: [packages/contracts/src/presentation.ts:57](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L57)

The universal, guaranteed port. Every client MFE exposes exactly one.
`framework` is observability/negotiation metadata only — the host never
needs it to invoke `mount` (that is the whole point of the floor).

## Properties

### framework?

> `optional` **framework**: `string`

Defined in: [packages/contracts/src/presentation.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L59)

***

### kind

> **kind**: `"imperative-dom"`

Defined in: [packages/contracts/src/presentation.ts:58](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L58)

***

### mount

> **mount**: [`ImperativeMount`](../type-aliases/ImperativeMount.md)

Defined in: [packages/contracts/src/presentation.ts:60](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L60)
