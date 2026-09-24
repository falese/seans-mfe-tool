[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / DataTransformSchema

# Variable: DataTransformSchema

> `const` **DataTransformSchema**: `ZodRecord`\<`ZodString`, `ZodUnknown`\>

Defined in: [packages/dsl/src/schema.ts:332](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L332)

Mesh transform — open record, rejected only when the name is a Mesh *plugin*
put in the wrong section. Classification is single-sourced in
`@seans-mfe/contracts` (ADR-092); an unknown name passes, and a name Mesh
ships in both positions (`mock`, `snapshot`) is never reported as misplaced.
