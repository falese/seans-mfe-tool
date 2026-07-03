[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / DescribeResult

# Interface: DescribeResult

Defined in: [packages/runtime/src/base-mfe.ts:134](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L134)

Result from describe capability

## Properties

### capabilities

> **capabilities**: `string`[]

Defined in: [packages/runtime/src/base-mfe.ts:138](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L138)

***

### manifest

> **manifest**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:139](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L139)

#### authorization?

> `optional` **authorization**: `unknown`

#### bundler?

> `optional` **bundler**: `string`

#### capabilities

> **capabilities**: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]

#### category?

> `optional` **category**: `string`

#### data?

> `optional` **data**: `object`

##### data.generatedFrom?

> `optional` **generatedFrom**: `object`[]

##### data.mockSwitch?

> `optional` **mockSwitch**: `object`

##### data.mockSwitch.enabled

> **enabled**: `boolean`

##### data.plugins?

> `optional` **plugins**: `Record`\<`string`, `unknown`\>[]

##### data.serve?

> `optional` **serve**: `object`

##### data.serve.endpoint

> **endpoint**: `string`

##### data.serve.playground

> **playground**: `boolean`

##### data.sources

> **sources**: `object`[]

##### data.transforms?

> `optional` **transforms**: `Record`\<`string`, `unknown`\>[]

#### dependencies?

> `optional` **dependencies**: `object`

##### dependencies.design-system?

> `optional` **design-system**: `Record`\<`string`, `string`\>

##### dependencies.mfes?

> `optional` **mfes**: `Record`\<`string`, `string`\>

##### dependencies.runtime?

> `optional` **runtime**: `Record`\<`string`, `string`\>

#### description?

> `optional` **description**: `string`

#### discovery?

> `optional` **discovery**: `string`

#### endpoint?

> `optional` **endpoint**: `string`

#### framework?

> `optional` **framework**: `string`

#### language

> **language**: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `LanguageSchema`

#### name

> **name**: `string`

#### owner?

> `optional` **owner**: `string`

#### performance?

> `optional` **performance**: `object`

##### performance.caching?

> `optional` **caching**: `object`

##### performance.caching.enabled

> **enabled**: `boolean`

##### performance.caching.strategies?

> `optional` **strategies**: `object`[]

##### performance.caching.ttl

> **ttl**: `number`

##### performance.filterSchema?

> `optional` **filterSchema**: `object`

##### performance.filterSchema.enabled

> **enabled**: `boolean`

##### performance.filterSchema.filters?

> `optional` **filters**: `string`[]

##### performance.observability?

> `optional` **observability**: `object`

##### performance.observability.opentelemetry?

> `optional` **opentelemetry**: `object`

##### performance.observability.opentelemetry.enabled

> **enabled**: `boolean`

##### performance.observability.opentelemetry.exporters?

> `optional` **exporters**: `object`[]

##### performance.observability.opentelemetry.sampling?

> `optional` **sampling**: `object`

##### performance.observability.opentelemetry.sampling.probability

> **probability**: `number`

##### performance.observability.opentelemetry.serviceName?

> `optional` **serviceName**: `string`

##### performance.observability.prometheus?

> `optional` **prometheus**: `object`

##### performance.observability.prometheus.enabled

> **enabled**: `boolean`

##### performance.observability.prometheus.endpoint

> **endpoint**: `string`

##### performance.observability.prometheus.port

> **port**: `number`

##### performance.rateLimit?

> `optional` **rateLimit**: `object`

##### performance.rateLimit.config?

> `optional` **config**: `object`[]

##### performance.rateLimit.enabled

> **enabled**: `boolean`

#### remoteEntry?

> `optional` **remoteEntry**: `string`

#### tags?

> `optional` **tags**: `string`[]

#### transforms?

> `optional` **transforms**: `string`[]

#### type

> **type**: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `MFETypeSchema`

#### version

> **version**: `string`

***

### name

> **name**: `string`

Defined in: [packages/runtime/src/base-mfe.ts:135](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L135)

***

### type

> **type**: `string`

Defined in: [packages/runtime/src/base-mfe.ts:137](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L137)

***

### version

> **version**: `string`

Defined in: [packages/runtime/src/base-mfe.ts:136](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L136)
