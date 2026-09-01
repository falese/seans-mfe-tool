[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CachingConfigSchema

# Variable: CachingConfigSchema

> `const` **CachingConfigSchema**: `ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `strategies`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `field`: `ZodString`; `ttl`: `ZodNumber`; `type`: `ZodString`; \}, `$strip`\>\>\>; `ttl`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:288](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L288)

Caching configuration
