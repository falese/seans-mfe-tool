[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LoadResult

# Interface: LoadResult

Defined in: [packages/runtime/src/base-mfe.ts:96](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L96)

Result from load capability

## Properties

### availableComponents?

> `optional` **availableComponents**: `string`[]

Defined in: [packages/runtime/src/base-mfe.ts:102](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L102)

***

### capabilities?

> `optional` **capabilities**: `CapabilityMetadata`[]

Defined in: [packages/runtime/src/base-mfe.ts:103](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L103)

***

### container?

> `optional` **container**: `unknown`

Defined in: [packages/runtime/src/base-mfe.ts:98](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L98)

***

### duration?

> `optional` **duration**: `number`

Defined in: [packages/runtime/src/base-mfe.ts:105](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L105)

***

### error?

> `optional` **error**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:111](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L111)

#### message

> **message**: `string`

#### phase

> **phase**: `string`

#### retryable

> **retryable**: `boolean`

#### retryCount

> **retryCount**: `number`

***

### manifest?

> `optional` **manifest**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:101](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L101)

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

### mesh?

> `optional` **mesh**: `unknown`

Defined in: [packages/runtime/src/base-mfe.ts:99](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L99)

***

### status

> **status**: `"error"` \| `"loaded"`

Defined in: [packages/runtime/src/base-mfe.ts:97](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L97)

***

### telemetry?

> `optional` **telemetry**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:106](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L106)

#### enableRender

> **enableRender**: `object`

##### enableRender.duration

> **duration**: `number`

##### enableRender.start

> **start**: `Date`

#### entry

> **entry**: `object`

##### entry.duration

> **duration**: `number`

##### entry.start

> **start**: `Date`

#### mount

> **mount**: `object`

##### mount.duration

> **duration**: `number`

##### mount.start

> **start**: `Date`

***

### timestamp

> **timestamp**: `Date`

Defined in: [packages/runtime/src/base-mfe.ts:104](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L104)

***

### worker?

> `optional` **worker**: `unknown`

Defined in: [packages/runtime/src/base-mfe.ts:100](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L100)
