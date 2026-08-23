[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / DEFAULT\_MESH\_PLUGINS

# Variable: DEFAULT\_MESH\_PLUGINS

> `const` **DEFAULT\_MESH\_PLUGINS**: `object`

Defined in: [packages/codegen/src/catalog.ts:214](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/catalog.ts#L214)

Plugin configuration defaults

## Type Declaration

### opentelemetry

> **opentelemetry**: `object`

#### opentelemetry.enabled

> **enabled**: `boolean` = `false`

#### opentelemetry.sampling

> **sampling**: `object`

#### opentelemetry.sampling.probability

> **probability**: `number` = `0.1`

### prometheus

> **prometheus**: `object` = `{}`

### responseCache

> **responseCache**: `object`

#### responseCache.ttl

> **ttl**: `number` = `300000`
