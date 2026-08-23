[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CapabilityConfigSchema

# Variable: CapabilityConfigSchema

> `const` **CapabilityConfigSchema**: `ZodObject`\<\{ `authorization`: `ZodOptional`\<`ZodString`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodOptional`\<`ZodString`\>; `inputs`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `default`: `ZodOptional`\<`ZodUnknown`\>; `description`: `ZodOptional`\<`ZodString`\>; `formats`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `name`: `ZodString`; `type`: `ZodString`; `values`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; \}, `$strip`\>\>\>; `lifecycle`: `ZodOptional`\<`ZodObject`\<\{ `after`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<...\>; `description`: `ZodOptional`\<...\>; `handler`: `ZodUnion`\<...\>; `mandatory`: `ZodOptional`\<...\>; `source`: `ZodOptional`\<...\>; \}, `$strip`\>\>\>\>; `before`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<...\>; `description`: `ZodOptional`\<...\>; `handler`: `ZodUnion`\<...\>; `mandatory`: `ZodOptional`\<...\>; `source`: `ZodOptional`\<...\>; \}, `$strip`\>\>\>\>; `error`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<...\>; `description`: `ZodOptional`\<...\>; `handler`: `ZodUnion`\<...\>; `mandatory`: `ZodOptional`\<...\>; `source`: `ZodOptional`\<...\>; \}, `$strip`\>\>\>\>; `main`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<...\>; `description`: `ZodOptional`\<...\>; `handler`: `ZodUnion`\<...\>; `mandatory`: `ZodOptional`\<...\>; `source`: `ZodOptional`\<...\>; \}, `$strip`\>\>\>\>; \}, `$strip`\>\>; `outputs`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `name`: `ZodString`; `type`: `ZodString`; \}, `$strip`\>\>\>; `type`: `ZodEnum`\<\{ `domain`: `"domain"`; `platform`: `"platform"`; \}\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:141](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L141)

Capability configuration
