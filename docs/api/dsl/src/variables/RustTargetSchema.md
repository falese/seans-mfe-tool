[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / RustTargetSchema

# Variable: RustTargetSchema

> `const` **RustTargetSchema**: `ZodObject`\<\{ `capabilities`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `crateName`: `ZodOptional`\<`ZodString`\>; `edition`: `ZodDefault`\<`ZodEnum`\<\{ `2021`: `"2021"`; `2024`: `"2024"`; \}\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:132](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L132)

The Rust native target (ADR-095, ADR-099).

Same principle as the Swift block: a secondary target declares how to BUILD,
never what the MFE IS. Capability set, identity and lifecycle come from the
manifest proper.
