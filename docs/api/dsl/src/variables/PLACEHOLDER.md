[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / PLACEHOLDER

# Variable: PLACEHOLDER

> `const` **PLACEHOLDER**: `RegExp`

Defined in: [packages/dsl/src/control-plane-schema.ts:27](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-schema.ts#L27)

`{name}` placeholders, as used by `forEach` expansion.

Deliberately the same brace syntax as the keyed-slot grammar (ADR-066's
`berth.{id}`), because in practice a keyed slot and the loop that fills it
are written together and reusing the syntax keeps them looking related.
