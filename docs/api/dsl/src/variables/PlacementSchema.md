[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / PlacementSchema

# Variable: PlacementSchema

> `const` **PlacementSchema**: `ZodObject`\<\{ `capability`: `ZodString`; `from`: `ZodOptional`\<`ZodString`\>; `into`: `ZodOptional`\<`ZodString`\>; `props`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/control-plane-schema.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-schema.ts#L41)

One placement: a capability, and where it goes.

`from` is optional because the compiler resolves capability → owning MFE
through the fleet's manifests. It becomes *required* when more than one MFE
declares the capability — abc-kids' fourteen games all declare `PlayGame` —
and the compiler reports the ambiguity with the candidate list rather than
picking one.
