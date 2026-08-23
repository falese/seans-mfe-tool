[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / addCapability

# Function: addCapability()

> **addCapability**(`manifest`, `name`, `config`): `object`

Defined in: [packages/dsl/src/parser.ts:343](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/parser.ts#L343)

Add a capability to a manifest

## Parameters

### manifest

Manifest to modify

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

### name

`string`

Capability name

### config

Capability configuration

#### description?

`string`

#### type

`"platform"` \| `"domain"`

## Returns

`object`

Modified manifest (new object)

### authorization?

> `optional` **authorization**: `unknown`

### bundler?

> `optional` **bundler**: `string`

### capabilities

> **capabilities**: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]

### category?

> `optional` **category**: `string`

### data?

> `optional` **data**: `object`

#### data.generatedFrom?

> `optional` **generatedFrom**: `object`[]

#### data.mockSwitch?

> `optional` **mockSwitch**: `object`

#### data.mockSwitch.enabled

> **enabled**: `boolean`

#### data.plugins?

> `optional` **plugins**: `Record`\<`string`, `unknown`\>[]

#### data.serve?

> `optional` **serve**: `object`

#### data.serve.endpoint

> **endpoint**: `string`

#### data.serve.playground

> **playground**: `boolean`

#### data.sources

> **sources**: `object`[]

#### data.transforms?

> `optional` **transforms**: `Record`\<`string`, `unknown`\>[]

### dependencies?

> `optional` **dependencies**: `object`

#### dependencies.design-system?

> `optional` **design-system**: `Record`\<`string`, `string`\>

#### dependencies.mfes?

> `optional` **mfes**: `Record`\<`string`, `string`\>

#### dependencies.runtime?

> `optional` **runtime**: `Record`\<`string`, `string`\>

### description?

> `optional` **description**: `string`

### discovery?

> `optional` **discovery**: `string`

### endpoint?

> `optional` **endpoint**: `string`

### framework?

> `optional` **framework**: `string`

### language

> **language**: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `LanguageSchema`

### name

> **name**: `string`

### owner?

> `optional` **owner**: `string`

### performance?

> `optional` **performance**: `object`

#### performance.caching?

> `optional` **caching**: `object`

#### performance.caching.enabled

> **enabled**: `boolean`

#### performance.caching.strategies?

> `optional` **strategies**: `object`[]

#### performance.caching.ttl

> **ttl**: `number`

#### performance.filterSchema?

> `optional` **filterSchema**: `object`

#### performance.filterSchema.enabled

> **enabled**: `boolean`

#### performance.filterSchema.filters?

> `optional` **filters**: `string`[]

#### performance.observability?

> `optional` **observability**: `object`

#### performance.observability.opentelemetry?

> `optional` **opentelemetry**: `object`

#### performance.observability.opentelemetry.enabled

> **enabled**: `boolean`

#### performance.observability.opentelemetry.exporters?

> `optional` **exporters**: `object`[]

#### performance.observability.opentelemetry.sampling?

> `optional` **sampling**: `object`

#### performance.observability.opentelemetry.sampling.probability

> **probability**: `number`

#### performance.observability.opentelemetry.serviceName?

> `optional` **serviceName**: `string`

#### performance.observability.prometheus?

> `optional` **prometheus**: `object`

#### performance.observability.prometheus.enabled

> **enabled**: `boolean`

#### performance.observability.prometheus.endpoint

> **endpoint**: `string`

#### performance.observability.prometheus.port

> **port**: `number`

#### performance.rateLimit?

> `optional` **rateLimit**: `object`

#### performance.rateLimit.config?

> `optional` **config**: `object`[]

#### performance.rateLimit.enabled

> **enabled**: `boolean`

### providesSlots?

> `optional` **providesSlots**: `object`[]

### remoteEntry?

> `optional` **remoteEntry**: `string`

### tags?

> `optional` **tags**: `string`[]

### transforms?

> `optional` **transforms**: `string`[]

### type

> **type**: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `MFETypeSchema`

### version

> **version**: `string`
