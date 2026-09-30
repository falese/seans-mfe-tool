[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ControlPlaneDocumentSchema

# Variable: ControlPlaneDocumentSchema

> `const` **ControlPlaneDocumentSchema**: `ZodObject`\<\{ `mfes`: `ZodArray`\<`ZodString`\>; `namespace`: `ZodString`; `project`: `ZodString`; `routes`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `forEach`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodArray`\<`ZodString`\>\>\>; `place`: `ZodArray`\<`ZodObject`\<\{ `capability`: `ZodString`; `from`: `ZodOptional`\<`ZodString`\>; `into`: `ZodOptional`\<`ZodString`\>; `props`: `ZodOptional`\<`ZodRecord`\<..., ...\>\>; \}, `$strip`\>\>; `when`: `ZodString`; \}, `$strip`\>\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/control-plane-schema.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-schema.ts#L94)

The whole document.
