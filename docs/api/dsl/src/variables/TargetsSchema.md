[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / TargetsSchema

# Variable: TargetsSchema

> `const` **TargetsSchema**: `ZodObject`\<\{ `swift`: `ZodOptional`\<`ZodObject`\<\{ `bundleId`: `ZodOptional`\<`ZodString`\>; `deploymentTarget`: `ZodDefault`\<`ZodString`\>; `moduleName`: `ZodOptional`\<`ZodString`\>; `swiftToolsVersion`: `ZodDefault`\<`ZodString`\>; \}, `$strip`\>\>; `web`: `ZodOptional`\<`ZodObject`\<\{ `bundler`: `ZodOptional`\<`ZodString`\>; `framework`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$catchall`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>

Defined in: [packages/dsl/src/schema.ts:142](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L142)

Every build this manifest produces.

`web` is the Module Federation remote; any other key is a build produced
beside it from the same capabilities. `swift` is the only other key the
platform ships a generator for today, which is NOT the same as the only key
that may appear.

`.catchall()` is load-bearing. A plain `z.object` strips unknown keys, so
before it a manifest declaring `targets.kotlin` warned on stderr from the raw
parse and then lost the key entirely in the validated path every command
uses — the exact opposite of the open-world policy this is supposed to
follow (ADR-036 §181, ADR-095 §2). The known keys keep their own schemas;
everything else is preserved as-is for whichever generator claims it.
