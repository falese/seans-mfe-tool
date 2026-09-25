[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / BaseMFE

# Abstract Class: BaseMFE

Defined in: [packages/runtime/src/base-mfe.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L84)

Base class for all MFE implementations

Platform Responsibilities:
- Lifecycle orchestration (before → main → after/error hooks)
- State management and validation
- Telemetry emission on hook failures
- Error containment (contained flag)
- Handler invocation (platform.* and custom.*)

Developer Responsibilities:
- Implement abstract doCapability() methods
- Implement custom lifecycle handlers referenced in DSL

## Extended by

- [`BaseRemoteMFE`](../base-remote-mfe/classes/BaseRemoteMFE.md)

## Constructors

### Constructor

> **new BaseMFE**(`manifest`, `deps`): `BaseMFE`

Defined in: [packages/runtime/src/base-mfe.ts:102](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L102)

#### Parameters

##### manifest

###### authorization?

`unknown` = `...`

###### bundler?

`string` = `...`

###### capabilities

`Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[] = `...`

###### category?

`string` = `...`

###### data?

\{ `generatedFrom?`: `object`[]; `mockSwitch?`: \{ `enabled`: `boolean`; \}; `plugins?`: `Record`\<`string`, `unknown`\>[]; `serve?`: \{ `endpoint`: `string`; `playground`: `boolean`; \}; `sources`: `object`[]; `transforms?`: `Record`\<`string`, `unknown`\>[]; \} = `...`

###### data.generatedFrom?

`object`[] = `...`

###### data.mockSwitch?

\{ `enabled`: `boolean`; \} = `...`

###### data.mockSwitch.enabled

`boolean` = `...`

###### data.plugins?

`Record`\<`string`, `unknown`\>[] = `...`

###### data.serve?

\{ `endpoint`: `string`; `playground`: `boolean`; \} = `...`

###### data.serve.endpoint

`string` = `...`

###### data.serve.playground

`boolean` = `...`

###### data.sources

`object`[] = `...`

###### data.transforms?

`Record`\<`string`, `unknown`\>[] = `...`

###### dependencies?

\{ `design-system?`: `Record`\<`string`, `string`\>; `mfes?`: `Record`\<`string`, `string`\>; `runtime?`: `Record`\<`string`, `string`\>; \} = `...`

###### dependencies.design-system?

`Record`\<`string`, `string`\> = `...`

###### dependencies.mfes?

`Record`\<`string`, `string`\> = `...`

###### dependencies.runtime?

`Record`\<`string`, `string`\> = `...`

###### description?

`string` = `...`

###### discovery?

`string` = `...`

###### endpoint?

`string` = `...`

###### framework?

`string` = `...`

###### language

`"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `...`

###### name

`string` = `...`

###### owner?

`string` = `...`

###### performance?

\{ `caching?`: \{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \}; `filterSchema?`: \{ `enabled`: `boolean`; `filters?`: `string`[]; \}; `observability?`: \{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \}; `rateLimit?`: \{ `config?`: `object`[]; `enabled`: `boolean`; \}; \} = `...`

###### performance.caching?

\{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \} = `...`

###### performance.caching.enabled

`boolean` = `...`

###### performance.caching.strategies?

`object`[] = `...`

###### performance.caching.ttl

`number` = `...`

###### performance.filterSchema?

\{ `enabled`: `boolean`; `filters?`: `string`[]; \} = `...`

###### performance.filterSchema.enabled

`boolean` = `...`

###### performance.filterSchema.filters?

`string`[] = `...`

###### performance.observability?

\{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \} = `...`

###### performance.observability.opentelemetry?

\{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \} = `...`

###### performance.observability.opentelemetry.enabled

`boolean` = `...`

###### performance.observability.opentelemetry.exporters?

`object`[] = `...`

###### performance.observability.opentelemetry.sampling?

\{ `probability`: `number`; \} = `...`

###### performance.observability.opentelemetry.sampling.probability

`number` = `...`

###### performance.observability.opentelemetry.serviceName?

`string` = `...`

###### performance.observability.prometheus?

\{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \} = `...`

###### performance.observability.prometheus.enabled

`boolean` = `...`

###### performance.observability.prometheus.endpoint

`string` = `...`

###### performance.observability.prometheus.port

`number` = `...`

###### performance.rateLimit?

\{ `config?`: `object`[]; `enabled`: `boolean`; \} = `...`

###### performance.rateLimit.config?

`object`[] = `...`

###### performance.rateLimit.enabled

`boolean` = `...`

###### providesSlots?

`object`[] = `...`

###### remoteEntry?

`string` = `...`

###### tags?

`string`[] = `...`

###### targets?

\{\[`key`: `string`\]: `Record`\<`string`, `unknown`\>; `rust?`: \{ `capabilities?`: `string`[]; `crateName?`: `string`; `edition`: `"2021"` \| `"2024"`; `wasm`: `boolean`; \}; `swift?`: \{ `bundleId?`: `string`; `capabilities?`: `string`[]; `deploymentTarget`: `string`; `moduleName?`: `string`; `swiftToolsVersion`: `string`; \}; `web?`: \{ `bundler?`: `string`; `framework?`: `string`; \}; \} = `...`

###### targets.rust?

\{ `capabilities?`: `string`[]; `crateName?`: `string`; `edition`: `"2021"` \| `"2024"`; `wasm`: `boolean`; \} = `...`

###### targets.rust.capabilities?

`string`[] = `...`

###### targets.rust.crateName?

`string` = `...`

###### targets.rust.edition

`"2021"` \| `"2024"` = `...`

###### targets.rust.wasm

`boolean` = `...`

###### targets.swift?

\{ `bundleId?`: `string`; `capabilities?`: `string`[]; `deploymentTarget`: `string`; `moduleName?`: `string`; `swiftToolsVersion`: `string`; \} = `...`

###### targets.swift.bundleId?

`string` = `...`

###### targets.swift.capabilities?

`string`[] = `...`

###### targets.swift.deploymentTarget

`string` = `...`

###### targets.swift.moduleName?

`string` = `...`

###### targets.swift.swiftToolsVersion

`string` = `...`

###### targets.web?

\{ `bundler?`: `string`; `framework?`: `string`; \} = `...`

###### targets.web.bundler?

`string` = `...`

###### targets.web.framework?

`string` = `...`

###### transforms?

`string`[] = `...`

###### type

`"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `...`

###### version

`string` = `...`

##### deps

`BaseMFEDependencies` = `{}`

#### Returns

`BaseMFE`

## Properties

### deps

> `protected` `readonly` **deps**: `BaseMFEDependencies`

Defined in: [packages/runtime/src/base-mfe.ts:89](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L89)

DI dependencies

***

### manifest

> `protected` `readonly` **manifest**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L86)

DSL manifest for this MFE

#### authorization?

> `optional` **authorization**: `unknown`

#### bundler?

> `optional` **bundler**: `string`

#### capabilities

> **capabilities**: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `errorHandling?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `onTimeout?`: ... \| ... \| ... \| ...; `source?`: ... \| ...; `timeout?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]

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

### state

> `protected` **state**: `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"` = `MFE_LIFECYCLE_INITIAL_STATE`

Defined in: [packages/runtime/src/base-mfe.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L92)

Current lifecycle state

***

### stateHistory

> `protected` **stateHistory**: `object`[] = `[]`

Defined in: [packages/runtime/src/base-mfe.ts:95](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L95)

State transition history (for debugging)

#### from

> **from**: `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

#### timestamp

> **timestamp**: `Date`

#### to

> **to**: `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

## Methods

### assertState()

> `protected` **assertState**(...`expectedStates`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:135](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L135)

Assert that current state matches expected state

#### Parameters

##### expectedStates

...(`"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`)[]

#### Returns

`void`

#### Throws

Error if state doesn't match

***

### attachControlPlane()

> **attachControlPlane**(`wsClient`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:116](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L116)

Attach a daemon control-plane socket after construction (ADR-057).

Generated MFEs are built without deps; when a host composes one
(LayoutManager, ADR-055) it injects a per-slot virtual channel here so the
platform capability `updateControlPlaneState` rides the host's single
physical socket. `deps` is readonly, but `wsClient` is a mutable member of
it. Idempotent: re-attaching replaces the channel.

#### Parameters

##### wsClient

[`DaemonWebSocketClient`](../interfaces/DaemonWebSocketClient.md)

#### Returns

`void`

***

### authorizeAccess()

> **authorizeAccess**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/base-mfe.ts:641](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L641)

AuthorizeAccess capability: Check authorization

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`boolean`\>

***

### describe()

> **describe**(`context`): `Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:655](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L655)

Describe capability: Return MFE metadata

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

***

### doAuthorizeAccess()

> `abstract` `protected` **doAuthorizeAccess**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/base-mfe.ts:733](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L733)

Implement authorization logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`boolean`\>

***

### doDescribe()

> `abstract` `protected` **doDescribe**(`context`): `Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:743](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L743)

Implement describe logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

***

### doEmit()

> `abstract` `protected` **doEmit**(`context`): `Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:837](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L837)

Implement telemetry emission logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

***

### doHealth()

> `abstract` `protected` **doHealth**(`context`): `Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:738](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L738)

Implement health check logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

***

### doLoad()

> `abstract` `protected` **doLoad**(`context`): `Promise`\<[`LoadResult`](../interfaces/LoadResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:718](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L718)

Implement load logic for this MFE
Type-specific: Module Federation for 'remote', GraphQL Mesh for 'bff', etc.

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`LoadResult`](../interfaces/LoadResult.md)\>

***

### doQuery()

> `protected` **doQuery**(`context`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:773](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L773)

Execute a GraphQL query against this MFE's BFF endpoint.

Default implementation dispatches `context.inputs.document` + `context.inputs.variables`
to the BFF URL resolved in priority order: context.inputs.bffUrl →
deps.bffUrl → BFF_URL env var → manifest.endpoint + manifest.data.serve.endpoint →
manifest.data.serve.endpoint → '/graphql'. See the numbered comment in the body
for the authoritative order.

An MFE with no `data:` section (and no explicit bffUrl override) has no BFF —
it returns `{ data: null }` rather than dialing a non-existent endpoint, so
the query capability is uniform across every MFE and both frameworks (ADR-070).

Override in concrete subclasses for typed, operation-specific queries:

  protected async doQuery(context: Context): Promise<QueryResult> {
    const { document, variables } = context.inputs as QueryInput;
    const data = await bffQuery(document, variables, {
      ...(context.jwt ? { Authorization: `Bearer ${context.jwt}` } : {}),
    });
    return { data };
  }

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\>

***

### doRefresh()

> `abstract` `protected` **doRefresh**(`context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:728](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L728)

Implement refresh logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

***

### doRender()

> `abstract` `protected` **doRender**(`context`): `Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:723](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L723)

Implement render logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

***

### doSchema()

> `abstract` `protected` **doSchema**(`context`): `Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:748](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L748)

Implement schema retrieval logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

***

### doUpdateControlPlaneState()

> `abstract` `protected` **doUpdateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:854](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L854)

Push meaningful domain state to the daemon/registry control plane.

Called when this MFE has produced state that should influence registry
resolution — not telemetry, but semantic state the rules engine acts on.

context.inputs:
  stateKey: string            — e.g. "analysis.complete", "form.submitted"
  stateData: Record<…>        — domain data the registry rules engine reads
  correlationId?: string      — link to the originating render/action

Implementations send this via the daemon's sendAction → handleMessage path.
A WebSocket MFE sends a GraphQL mutation; a server-side MFE calls the
daemon's REST or WS endpoint directly.

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>

***

### emit()

> **emit**(`context`): `Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:676](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L676)

Emit capability: Emit telemetry/events

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

***

### executeLifecycle()

> `protected` **executeLifecycle**(`capability`, `phase`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:191](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L191)

Execute lifecycle hooks for a capability phase

#### Parameters

##### capability

`string`

Capability name (load, render, etc.)

##### phase

Lifecycle phase (before, main, after, error)

`"error"` | `"before"` | `"main"` | `"after"`

##### context

[`Context`](../interfaces/Context.md)

Execution context

#### Returns

`Promise`\<`void`\>

***

### getState()

> **getState**(): `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

Defined in: [packages/runtime/src/base-mfe.ts:127](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L127)

Get current state

#### Returns

`"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

***

### health()

> **health**(`context`): `Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:648](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L648)

Health capability: Check MFE health status

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

***

### invokeCustomHandler()

> `protected` **invokeCustomHandler**(`name`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:425](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L425)

Invoke a custom handler from developer implementation

#### Parameters

##### name

`string`

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Throws

Error if custom handler not found

***

### invokeHandler()

> `protected` **invokeHandler**(`handlerName`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:367](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L367)

Invoke a handler by name (platform.* or custom.*)

REQ-058: Platform handlers resolved from standard library
REQ-057: Custom handlers resolved from developer class

WHY (ADR-079): this is THE seam. `deps.customHandlers` is consulted here,
inside the hook loop, which means a substituted handler still runs under
every guarantee ADR-002 makes — containment, main-phase propagation,
telemetry on failure. BaseMFE once had a second seam,
`deps.lifecycleExecutor`, wrapped around the whole phase loop; anything
injected there skipped all of it silently. It was deleted rather than
documented. Substituting execution means providing a handler, not
replacing the engine — so a new injection point that can bypass
`executeHook` does not belong in this class.

#### Parameters

##### handlerName

`string`

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

***

### invokePlatformHandler()

> `protected` **invokePlatformHandler**(`name`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:410](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L410)

Invoke a platform handler from the standard library — a flat, statically
built map (PLATFORM_HANDLER_LIBRARY), so resolution is a single lookup.

WHY (ADR-076, superseding ADR-025): platform handlers are plain exported
async functions of shape (context) => Promise<unknown>, resolved by their
literal export name. The earlier design gave each one a class implementing
a PlatformHandler interface, registered into a PlatformHandlerRegistry —
ceremony that bought nothing, because ADR-002's before/main/after/error
model already decides when a handler runs. Adding a handler is now
exporting a function from ./handlers; nothing registers it anywhere.

#### Parameters

##### name

`string`

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Throws

Error if platform handler not found

***

### load()

> **load**(`context`): `Promise`\<[`LoadResult`](../interfaces/LoadResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:620](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L620)

Load capability: Initialize and prepare MFE for use

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`LoadResult`](../interfaces/LoadResult.md)\>

***

### query()

> **query**(`context`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:669](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L669)

Query capability: Execute data query

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\>

***

### refresh()

> **refresh**(`context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:634](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L634)

Refresh capability: Refresh MFE data/state

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

***

### render()

> **render**(`context`): `Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:627](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L627)

Render capability: Render MFE UI into target container

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

***

### schema()

> **schema**(`context`): `Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:662](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L662)

Schema capability: Return GraphQL/JSON schema

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

***

### transitionState()

> `protected` **transitionState**(`newState`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:152](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L152)

Transition to a new state

#### Parameters

##### newState

`"error"` | `"uninitialized"` | `"loading"` | `"ready"` | `"rendering"` | `"destroyed"`

#### Returns

`void`

#### Throws

Error if transition is invalid

***

### updateControlPlaneState()

> **updateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:701](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L701)

UpdateControlPlaneState capability: Push domain state to the daemon so the
Registry can re-evaluate what should be shown.

This is distinct from emit() (telemetry/observers). Use this when internal
MFE state has changed in a way that should drive registry resolution:

  - Analysis complete → registry may transition to a DataVisualization MFE
  - Form submitted    → registry may resolve a Confirmation MFE
  - Wizard step done  → registry may resolve the next step's MFE
  - Error escalation  → registry may route to an EscalationHandler MFE

context.inputs must carry:
  stateKey: string             — semantic name ("analysis.complete", "form.submitted")
  stateData: Record<…>         — domain context the registry rules engine evaluates
  correlationId?: string       — links this update to the originating render/action

The daemon routes this through sendAction → Registry handleMessage.
The registry re-evaluates rules and may resolve a new MFE + capability.
Available from 'ready' or 'rendering' — an MFE can push state mid-render.

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>
