[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / PerformanceConfigSchema

# Variable: PerformanceConfigSchema

> `const` **PerformanceConfigSchema**: `ZodObject`\<\{ `caching`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `strategies`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `field`: `ZodString`; `ttl`: `ZodNumber`; `type`: `ZodString`; \}, `$strip`\>\>\>; `ttl`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>\>; `filterSchema`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `filters`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; \}, `$strip`\>\>; `observability`: `ZodOptional`\<`ZodObject`\<\{ `opentelemetry`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `exporters`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<..., ...\>\>\>; `sampling`: `ZodOptional`\<`ZodObject`\<\{ `probability`: ...; \}, `$strip`\>\>; `serviceName`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; `prometheus`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `endpoint`: `ZodDefault`\<`ZodString`\>; `port`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>\>; \}, `$strip`\>\>; `rateLimit`: `ZodOptional`\<`ZodObject`\<\{ `config`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `field`: `ZodString`; `identifyContext`: `ZodOptional`\<`ZodString`\>; `max`: `ZodNumber`; `ttl`: `ZodNumber`; `type`: `ZodString`; \}, `$strip`\>\>\>; `enabled`: `ZodDefault`\<`ZodBoolean`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:363](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L363)

Performance configuration
