[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / NAMESPACE\_PATTERN

# Variable: NAMESPACE\_PATTERN

> `const` **NAMESPACE\_PATTERN**: `RegExp`

Defined in: [packages/dsl/src/schema.ts:213](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L213)

A control-plane namespace: letters, digits, `-` and `_`, starting with a
letter. The single definition — `control-plane.yaml`'s `namespace` (ADR-083
§1) and a manifest's `hosts[].id` must agree, because the second names the
first.
