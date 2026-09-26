[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / LifecycleHookSchema

# Variable: LifecycleHookSchema

> `const` **LifecycleHookSchema**: `ZodObject`\<\{ `contained`: `ZodOptional`\<`ZodBoolean`\>; `description`: `ZodOptional`\<`ZodString`\>; `errorHandling`: `ZodOptional`\<`ZodObject`\<\{ `types`: `ZodArray`\<`ZodObject`\<\{ `backoff`: `ZodOptional`\<`ZodEnum`\<\{ `constant`: ...; `exponential`: ...; `linear`: ...; \}\>\>; `baseDelay`: `ZodOptional`\<`ZodNumber`\>; `fallbackHandler`: `ZodOptional`\<`ZodString`\>; `jitter`: `ZodOptional`\<`ZodBoolean`\>; `maxDelay`: `ZodOptional`\<`ZodNumber`\>; `maxRetries`: `ZodOptional`\<`ZodNumber`\>; `message`: `ZodOptional`\<`ZodString`\>; `onRetry`: `ZodOptional`\<`ZodString`\>; `pattern`: `ZodOptional`\<`ZodString`\>; `retryable`: `ZodBoolean`; `type`: `ZodEnum`\<\{ `business`: `"business"`; `network`: `"network"`; `security`: `"security"`; `system`: `"system"`; `timeout`: `"timeout"`; `unknown`: `"unknown"`; `validation`: `"validation"`; \}\>; `userFacing`: `ZodOptional`\<`ZodBoolean`\>; \}, `$strip`\>\>; \}, `$strip`\>\>; `handler`: `ZodUnion`\<readonly \[`ZodString`, `ZodArray`\<`ZodString`\>\]\>; `mandatory`: `ZodOptional`\<`ZodBoolean`\>; `onTimeout`: `ZodOptional`\<`ZodEnum`\<\{ `error`: `"error"`; `skip`: `"skip"`; `warn`: `"warn"`; \}\>\>; `source`: `ZodOptional`\<`ZodString`\>; `timeout`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:272](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L272)
