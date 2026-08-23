[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / FrameworkVariant

# Interface: FrameworkVariant

Defined in: [packages/codegen/src/unified-generator.ts:65](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L65)

The resolved codegen variant a caller injects (ADR-061). The CLI derives it
from the framework plugin (loadFrameworkPlugin) so third-party frameworks
work; the generator itself never loads a plugin. When no variant is injected
the generator falls back to `deriveBuiltinVariant` — the two built-in trios,
computed purely from the manifest with no framework-loader dependency.

## Properties

### bundler

> **bundler**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:67](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L67)

***

### framework

> **framework**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:66](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L66)

***

### templateVariant

> **templateVariant**: `"react-rspack"` \| `"angular-webpack"`

Defined in: [packages/codegen/src/unified-generator.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L68)
