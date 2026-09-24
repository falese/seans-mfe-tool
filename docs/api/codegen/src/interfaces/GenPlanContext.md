[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / GenPlanContext

# Interface: GenPlanContext

Defined in: [packages/codegen/src/variants/types.ts:28](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L28)

What a spec's `when` and `vars` receive.

## Properties

### domainCapabilities

> **domainCapabilities**: `string`[]

Defined in: [packages/codegen/src/variants/types.ts:34](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L34)

Domain capability names, in manifest order.

***

### handlerSources

> **handlerSources**: [`RenderHandlerSource`](RenderHandlerSource.md)[]

Defined in: [packages/codegen/src/variants/types.ts:36](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L36)

Manifest-declared handler imports (ADR-040).

***

### hasBff

> **hasBff**: `boolean`

Defined in: [packages/codegen/src/variants/types.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L38)

True when the manifest declares a `data:` section.

***

### manifest

> **manifest**: `object`

Defined in: [packages/codegen/src/variants/types.ts:29](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L29)

#### authorization?

> `optional` **authorization**: `unknown`

#### bundler?

> `optional` **bundler**: `string`

#### capabilities

> **capabilities**: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]

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

> **language**: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"`

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

#### targets?

> `optional` **targets**: `object`

##### Index Signature

\[`key`: `string`\]: `Record`\<`string`, `unknown`\>

##### targets.rust?

> `optional` **rust**: `object`

##### targets.rust.capabilities?

> `optional` **capabilities**: `string`[]

##### targets.rust.crateName?

> `optional` **crateName**: `string`

##### targets.rust.edition

> **edition**: `"2021"` \| `"2024"`

##### targets.rust.wasm

> **wasm**: `boolean`

##### targets.swift?

> `optional` **swift**: `object`

##### targets.swift.bundleId?

> `optional` **bundleId**: `string`

##### targets.swift.capabilities?

> `optional` **capabilities**: `string`[]

##### targets.swift.deploymentTarget

> **deploymentTarget**: `string`

##### targets.swift.moduleName?

> `optional` **moduleName**: `string`

##### targets.swift.swiftToolsVersion

> **swiftToolsVersion**: `string`

##### targets.web?

> `optional` **web**: `object`

##### targets.web.bundler?

> `optional` **bundler**: `string`

##### targets.web.framework?

> `optional` **framework**: `string`

#### transforms?

> `optional` **transforms**: `string`[]

#### type

> **type**: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"`

#### version

> **version**: `string`

***

### variant

> **variant**: [`CodegenVariant`](CodegenVariant.md)

Defined in: [packages/codegen/src/variants/types.ts:32](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L32)

***

### vars

> **vars**: `Record`\<`string`, `unknown`\>

Defined in: [packages/codegen/src/variants/types.ts:31](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/types.ts#L31)

The shared render model (template vars).
