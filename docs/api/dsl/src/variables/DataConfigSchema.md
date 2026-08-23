[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / DataConfigSchema

# Variable: DataConfigSchema

> `const` **DataConfigSchema**: `ZodObject`\<\{ `generatedFrom`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `openapi`: `ZodOptional`\<`ZodString`\>; `service`: `ZodOptional`\<`ZodString`\>; `version`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>\>; `mockSwitch`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; \}, `$strip`\>\>; `plugins`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `serve`: `ZodOptional`\<`ZodObject`\<\{ `endpoint`: `ZodString`; `playground`: `ZodBoolean`; \}, `$strip`\>\>; `sources`: `ZodArray`\<`ZodObject`\<\{ `handler`: `ZodObject`\<\{ `openapi`: `ZodObject`\<\{ `operationHeaders`: `ZodOptional`\<`ZodRecord`\<..., ...\>\>; `source`: `ZodString`; \}, `$strip`\>; \}, `$strip`\>; `name`: `ZodString`; `transforms`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; \}, `$strip`\>\>; `transforms`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:261](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L261)
