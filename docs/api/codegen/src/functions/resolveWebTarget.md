[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / resolveWebTarget

# Function: resolveWebTarget()

> **resolveWebTarget**(`manifest`): `object`

Defined in: [packages/codegen/src/unified-generator.ts:115](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L115)

The web build's framework and bundler, from whichever spelling declared them.

Two spellings reach the same pair (ADR-095 §6):

    framework: react            targets:
    bundler: rspack        ≡      web: { framework: react, bundler: rspack }

`targets.web` wins where both are present and agree; where they DISAGREE the
manifest is rejected by `validateFull` rather than silently resolved here —
two sources of one fact quietly picking a winner is the defect class this
repo keeps paying for.

This is the single resolution rule (ADR-092 §4). Callers that need the name
must not re-derive it: `deriveBuiltinVariant` maps it onto one of the two
built-in trios, while the CLI's `resolveFrameworkVariant` hands it to
`loadFrameworkPlugin`, where an unrecognised name is a third-party plugin to
require (ADR-036), not a value to fall back from. A caller that
single-sources the *trio* instead of the *name* silently turns every
third-party framework into React.

## Parameters

### manifest

#### authorization?

`unknown` = `...`

#### bundler?

`string` = `...`

#### capabilities

`Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[] = `...`

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

## Returns

`object`

### bundler

> **bundler**: `string`

### framework

> **framework**: `string`
