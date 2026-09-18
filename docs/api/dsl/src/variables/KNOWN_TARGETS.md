[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / KNOWN\_TARGETS

# Variable: KNOWN\_TARGETS

> `const` **KNOWN\_TARGETS**: readonly \[`"swift"`\]

Defined in: [packages/dsl/src/schema.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L68)

Known built-in secondary targets — warnings, not hard errors, exactly as
KNOWN_FRAMEWORKS/KNOWN_BUNDLERS are (ADR-036, #181). A target generator
shipped outside this repo must not require a schema change here.
