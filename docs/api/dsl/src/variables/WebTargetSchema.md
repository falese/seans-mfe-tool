[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / WebTargetSchema

# Variable: WebTargetSchema

> `const` **WebTargetSchema**: `ZodObject`\<\{ `bundler`: `ZodOptional`\<`ZodString`\>; `framework`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:168](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L168)

The web target — the Module Federation remote.

Carries the same two values the top-level `framework`/`bundler` scalars do.
Those scalars remain the shorthand and are what all 21 example manifests
use; this is the spelling that lets a manifest name every build it produces
in ONE list rather than privileging the web one structurally (ADR-095 §6).
