[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / LoadResult

# Interface: LoadResult

Defined in: packages/runtime/src/capability-results.ts:27

Result from load capability

## Properties

### availableComponents?

> `optional` **availableComponents**: `string`[]

Defined in: packages/runtime/src/capability-results.ts:33

***

### capabilities?

> `optional` **capabilities**: `CapabilityMetadata`[]

Defined in: packages/runtime/src/capability-results.ts:34

***

### container?

> `optional` **container**: `unknown`

Defined in: packages/runtime/src/capability-results.ts:29

***

### duration?

> `optional` **duration**: `number`

Defined in: packages/runtime/src/capability-results.ts:36

***

### error?

> `optional` **error**: `object`

Defined in: packages/runtime/src/capability-results.ts:42

#### message

> **message**: `string`

#### phase

> **phase**: `"error"` \| `"before"` \| `"after"` \| `"entry"` \| `"mount"` \| `"enable-render"`

Which step failed. The subphase names are the atomic main operation
(ADR-026); `before` / `after` / `error` are the lifecycle phases around
it. A closed set, because the field exists to be branched on.

#### retryable

> **retryable**: `boolean`

#### retryCount

> **retryCount**: `number`

***

### manifest?

> `optional` **manifest**: `object`

Defined in: packages/runtime/src/capability-results.ts:32

#### authorization?

> `optional` **authorization**: `unknown`

#### bundler?

> `optional` **bundler**: `string`

#### capabilities

> **capabilities**: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]

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

#### providesSlots?

> `optional` **providesSlots**: `object`[]

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

Defined in: packages/runtime/src/capability-results.ts:30

***

### status

> **status**: `"error"` \| `"loaded"`

Defined in: packages/runtime/src/capability-results.ts:28

***

### telemetry?

> `optional` **telemetry**: `object`

Defined in: packages/runtime/src/capability-results.ts:37

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

Defined in: packages/runtime/src/capability-results.ts:35

***

### worker?

> `optional` **worker**: `unknown`

Defined in: packages/runtime/src/capability-results.ts:31
