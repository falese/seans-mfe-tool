[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / FrameworkVariant

# Interface: FrameworkVariant

Defined in: [packages/codegen/src/unified-generator.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L86)

The resolved codegen variant a caller injects (ADR-061). The CLI derives it
from the framework plugin (loadFrameworkPlugin) so third-party frameworks
work; the generator itself never loads a plugin. When no variant is injected
the generator falls back to `deriveBuiltinVariant` — the two built-in trios,
computed purely from the manifest with no framework-loader dependency.

## Properties

### bundler

> **bundler**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:88](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L88)

***

### framework

> **framework**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L87)

***

### templateVariant

> **templateVariant**: `"react-rspack"` \| `"angular-webpack"`

Defined in: [packages/codegen/src/unified-generator.ts:89](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L89)
