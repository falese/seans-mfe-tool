[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / resolveNeededMeshPluginsAndTransforms

# Function: resolveNeededMeshPluginsAndTransforms()

> **resolveNeededMeshPluginsAndTransforms**(`manifest`): `object`

Defined in: [packages/codegen/src/dependencies.ts:113](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/dependencies.ts#L113)

Which optional Mesh plugins/transforms a manifest's `data:`/`performance:`
config implies (ADR-027). Feeds `extractManifestVars`, which decides what
`package.json.ejs` and the BFF templates render.

## Parameters

### manifest

#### authorization?

`unknown` = `...`

#### bundler?

`string` = `...`

#### capabilities

`Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[] = `...`

#### category?

`string` = `...`

#### data?

\{ `generatedFrom?`: `object`[]; `mockSwitch?`: \{ `enabled`: `boolean`; \}; `plugins?`: `Record`\<`string`, `unknown`\>[]; `serve?`: \{ `endpoint`: `string`; `playground`: `boolean`; \}; `sources`: `object`[]; `transforms?`: `Record`\<`string`, `unknown`\>[]; \} = `...`

#### data.generatedFrom?

`object`[] = `...`

#### data.mockSwitch?

\{ `enabled`: `boolean`; \} = `...`

#### data.mockSwitch.enabled

`boolean` = `...`

#### data.plugins?

`Record`\<`string`, `unknown`\>[] = `...`

#### data.serve?

\{ `endpoint`: `string`; `playground`: `boolean`; \} = `...`

#### data.serve.endpoint

`string` = `...`

#### data.serve.playground

`boolean` = `...`

#### data.sources

`object`[] = `...`

#### data.transforms?

`Record`\<`string`, `unknown`\>[] = `...`

#### dependencies?

\{ `design-system?`: `Record`\<`string`, `string`\>; `mfes?`: `Record`\<`string`, `string`\>; `runtime?`: `Record`\<`string`, `string`\>; \} = `...`

#### dependencies.design-system?

`Record`\<`string`, `string`\> = `...`

#### dependencies.mfes?

`Record`\<`string`, `string`\> = `...`

#### dependencies.runtime?

`Record`\<`string`, `string`\> = `...`

#### description?

`string` = `...`

#### discovery?

`string` = `...`

#### endpoint?

`string` = `...`

#### framework?

`string` = `...`

#### language

`"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `LanguageSchema`

#### name

`string` = `...`

#### owner?

`string` = `...`

#### performance?

\{ `caching?`: \{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \}; `filterSchema?`: \{ `enabled`: `boolean`; `filters?`: `string`[]; \}; `observability?`: \{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \}; `rateLimit?`: \{ `config?`: `object`[]; `enabled`: `boolean`; \}; \} = `...`

#### performance.caching?

\{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \} = `...`

#### performance.caching.enabled

`boolean` = `...`

#### performance.caching.strategies?

`object`[] = `...`

#### performance.caching.ttl

`number` = `...`

#### performance.filterSchema?

\{ `enabled`: `boolean`; `filters?`: `string`[]; \} = `...`

#### performance.filterSchema.enabled

`boolean` = `...`

#### performance.filterSchema.filters?

`string`[] = `...`

#### performance.observability?

\{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \} = `...`

#### performance.observability.opentelemetry?

\{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \} = `...`

#### performance.observability.opentelemetry.enabled

`boolean` = `...`

#### performance.observability.opentelemetry.exporters?

`object`[] = `...`

#### performance.observability.opentelemetry.sampling?

\{ `probability`: `number`; \} = `...`

#### performance.observability.opentelemetry.sampling.probability

`number` = `...`

#### performance.observability.opentelemetry.serviceName?

`string` = `...`

#### performance.observability.prometheus?

\{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \} = `...`

#### performance.observability.prometheus.enabled

`boolean` = `...`

#### performance.observability.prometheus.endpoint

`string` = `...`

#### performance.observability.prometheus.port

`number` = `...`

#### performance.rateLimit?

\{ `config?`: `object`[]; `enabled`: `boolean`; \} = `...`

#### performance.rateLimit.config?

`object`[] = `...`

#### performance.rateLimit.enabled

`boolean` = `...`

#### providesSlots?

`object`[] = `...`

#### remoteEntry?

`string` = `...`

#### tags?

`string`[] = `...`

#### transforms?

`string`[] = `...`

#### type

`"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `MFETypeSchema`

#### version

`string` = `...`

## Returns

`object`

### neededPlugins

> **neededPlugins**: `string`[]

### neededTransforms

> **neededTransforms**: `string`[]
