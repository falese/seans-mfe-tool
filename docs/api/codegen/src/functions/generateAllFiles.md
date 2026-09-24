[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / generateAllFiles

# Function: generateAllFiles()

> **generateAllFiles**(`manifest`, `basePath`, `options`): `Promise`\<[`GenerateAllFilesResult`](../interfaces/GenerateAllFilesResult.md)\>

Defined in: [packages/codegen/src/unified-generator.ts:216](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L216)

Generate all files (features, platform, BFF, configs) for a manifest.

Three phases, each isolated so they can be reasoned about (and reused)
independently: validate → plan (aggregate manifest into a RenderModel) →
render (turn the model into concrete GeneratedFiles). Emit is a separate
step (writeGeneratedFiles).

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

`"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `...`

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

#### targets?

\{\[`key`: `string`\]: `Record`\<`string`, `unknown`\>; `rust?`: \{ `capabilities?`: `string`[]; `crateName?`: `string`; `edition`: `"2021"` \| `"2024"`; `wasm`: `boolean`; \}; `swift?`: \{ `bundleId?`: `string`; `capabilities?`: `string`[]; `deploymentTarget`: `string`; `moduleName?`: `string`; `swiftToolsVersion`: `string`; \}; `web?`: \{ `bundler?`: `string`; `framework?`: `string`; \}; \} = `...`

#### targets.rust?

\{ `capabilities?`: `string`[]; `crateName?`: `string`; `edition`: `"2021"` \| `"2024"`; `wasm`: `boolean`; \} = `...`

#### targets.rust.capabilities?

`string`[] = `...`

#### targets.rust.crateName?

`string` = `...`

#### targets.rust.edition

`"2021"` \| `"2024"` = `...`

#### targets.rust.wasm

`boolean` = `...`

#### targets.swift?

\{ `bundleId?`: `string`; `capabilities?`: `string`[]; `deploymentTarget`: `string`; `moduleName?`: `string`; `swiftToolsVersion`: `string`; \} = `...`

#### targets.swift.bundleId?

`string` = `...`

#### targets.swift.capabilities?

`string`[] = `...`

#### targets.swift.deploymentTarget

`string` = `...`

#### targets.swift.moduleName?

`string` = `...`

#### targets.swift.swiftToolsVersion

`string` = `...`

#### targets.web?

\{ `bundler?`: `string`; `framework?`: `string`; \} = `...`

#### targets.web.bundler?

`string` = `...`

#### targets.web.framework?

`string` = `...`

#### transforms?

`string`[] = `...`

#### type

`"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `...`

#### version

`string` = `...`

### basePath

`string`

### options

#### dryRun?

`boolean`

#### force?

`boolean`

#### frameworkVariant?

[`FrameworkVariant`](../interfaces/FrameworkVariant.md)

## Returns

`Promise`\<[`GenerateAllFilesResult`](../interfaces/GenerateAllFilesResult.md)\>
