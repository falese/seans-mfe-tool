[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / RateLimitConfigSchema

# Variable: RateLimitConfigSchema

> `const` **RateLimitConfigSchema**: `ZodObject`\<\{ `config`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `field`: `ZodString`; `identifyContext`: `ZodOptional`\<`ZodString`\>; `max`: `ZodNumber`; `ttl`: `ZodNumber`; `type`: `ZodString`; \}, `$strip`\>\>\>; `enabled`: `ZodDefault`\<`ZodBoolean`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:327](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L327)

Rate limiting configuration
