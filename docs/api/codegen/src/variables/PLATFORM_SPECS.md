[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / PLATFORM\_SPECS

# Variable: PLATFORM\_SPECS

> `const` **PLATFORM\_SPECS**: [`FileSpec`](../interfaces/FileSpec.md)[]

Defined in: [packages/codegen/src/variants/shared.ts:40](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/shared.ts#L40)

The BaseMFE lifecycle contract — the files generated code imports from.
All generator-owned: they are the platform's half of the deal, re-stamped
every run and held byte-identical by `check:mfe-drift`.
