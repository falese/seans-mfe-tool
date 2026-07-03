[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / BaseMFE

# Abstract Class: BaseMFE

Defined in: [packages/runtime/src/base-mfe.ts:316](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L316)

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

## Constructors

### Constructor

> **new BaseMFE**(`manifest`, `deps`): `BaseMFE`

Defined in: [packages/runtime/src/base-mfe.ts:334](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L334)

#### Parameters

##### manifest

###### authorization?

`unknown` = `...`

###### bundler?

`string` = `...`

###### capabilities

`Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler?`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[] = `...`

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

`"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `LanguageSchema`

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

###### remoteEntry?

`string` = `...`

###### tags?

`string`[] = `...`

###### transforms?

`string`[] = `...`

###### type

`"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `MFETypeSchema`

###### version

`string` = `...`

##### deps

`BaseMFEDependencies` = `{}`

#### Returns

`BaseMFE`

## Properties

### deps

> `protected` `readonly` **deps**: `BaseMFEDependencies`

Defined in: [packages/runtime/src/base-mfe.ts:321](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L321)

DI dependencies

***

### manifest

> `protected` `readonly` **manifest**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:318](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L318)

DSL manifest for this MFE

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

### state

> `protected` **state**: [`MFEState`](../type-aliases/MFEState.md) = `'uninitialized'`

Defined in: [packages/runtime/src/base-mfe.ts:324](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L324)

Current lifecycle state

***

### stateHistory

> `protected` **stateHistory**: `object`[] = `[]`

Defined in: [packages/runtime/src/base-mfe.ts:327](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L327)

State transition history (for debugging)

#### from

> **from**: [`MFEState`](../type-aliases/MFEState.md)

#### timestamp

> **timestamp**: `Date`

#### to

> **to**: [`MFEState`](../type-aliases/MFEState.md)

## Methods

### assertState()

> `protected` **assertState**(...`expectedStates`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:367](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L367)

Assert that current state matches expected state

#### Parameters

##### expectedStates

...[`MFEState`](../type-aliases/MFEState.md)[]

#### Returns

`void`

#### Throws

Error if state doesn't match

***

### attachControlPlane()

> **attachControlPlane**(`wsClient`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:348](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L348)

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

Defined in: [packages/runtime/src/base-mfe.ts:799](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L799)

AuthorizeAccess capability: Check authorization

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`boolean`\>

***

### describe()

> **describe**(`context`): `Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:813](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L813)

Describe capability: Return MFE metadata

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

***

### doAuthorizeAccess()

> `abstract` `protected` **doAuthorizeAccess**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/base-mfe.ts:891](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L891)

Implement authorization logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`boolean`\>

***

### doDescribe()

> `abstract` `protected` **doDescribe**(`context`): `Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:901](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L901)

Implement describe logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`DescribeResult`](../interfaces/DescribeResult.md)\>

***

### doEmit()

> `abstract` `protected` **doEmit**(`context`): `Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:983](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L983)

Implement telemetry emission logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

***

### doHealth()

> `abstract` `protected` **doHealth**(`context`): `Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:896](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L896)

Implement health check logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

***

### doLoad()

> `abstract` `protected` **doLoad**(`context`): `Promise`\<[`LoadResult`](../interfaces/LoadResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:876](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L876)

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

Defined in: [packages/runtime/src/base-mfe.ts:927](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L927)

Execute a GraphQL query against this MFE's BFF endpoint.

Default implementation dispatches `context.inputs.document` + `context.inputs.variables`
to the BFF URL resolved in priority order: context.inputs.bffUrl →
deps.bffUrl → BFF_URL env var → manifest.endpoint + manifest.data.serve.endpoint →
manifest.data.serve.endpoint → '/graphql'. See the numbered comment in the body
for the authoritative order.

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

Defined in: [packages/runtime/src/base-mfe.ts:886](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L886)

Implement refresh logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

***

### doRender()

> `abstract` `protected` **doRender**(`context`): `Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:881](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L881)

Implement render logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

***

### doSchema()

> `abstract` `protected` **doSchema**(`context`): `Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:906](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L906)

Implement schema retrieval logic for this MFE

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

***

### doUpdateControlPlaneState()

> `abstract` `protected` **doUpdateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:1000](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L1000)

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

Defined in: [packages/runtime/src/base-mfe.ts:834](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L834)

Emit capability: Emit telemetry/events

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`EmitResult`](../interfaces/EmitResult.md)\>

***

### executeLifecycle()

> `protected` **executeLifecycle**(`capability`, `phase`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:425](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L425)

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

> **getState**(): [`MFEState`](../type-aliases/MFEState.md)

Defined in: [packages/runtime/src/base-mfe.ts:359](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L359)

Get current state

#### Returns

[`MFEState`](../type-aliases/MFEState.md)

***

### health()

> **health**(`context`): `Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:806](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L806)

Health capability: Check MFE health status

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`HealthResult`](../interfaces/HealthResult.md)\>

***

### invokeCustomHandler()

> `protected` **invokeCustomHandler**(`name`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:587](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L587)

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

Defined in: [packages/runtime/src/base-mfe.ts:541](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L541)

Invoke a handler by name (platform.* or custom.*)

REQ-058: Platform handlers resolved from standard library
REQ-057: Custom handlers resolved from developer class

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

Defined in: [packages/runtime/src/base-mfe.ts:575](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L575)

Invoke a platform handler from the standard library — a flat, statically
built map (PLATFORM_HANDLER_LIBRARY), so resolution is a single lookup.

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

Defined in: [packages/runtime/src/base-mfe.ts:778](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L778)

Load capability: Initialize and prepare MFE for use

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`LoadResult`](../interfaces/LoadResult.md)\>

***

### query()

> **query**(`context`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:827](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L827)

Query capability: Execute data query

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\>

***

### refresh()

> **refresh**(`context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:792](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L792)

Refresh capability: Refresh MFE data/state

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

***

### render()

> **render**(`context`): `Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:785](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L785)

Render capability: Render MFE UI into target container

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`RenderResult`](../interfaces/RenderResult.md)\>

***

### schema()

> **schema**(`context`): `Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:820](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L820)

Schema capability: Return GraphQL/JSON schema

#### Parameters

##### context

[`Context`](../interfaces/Context.md)

#### Returns

`Promise`\<[`SchemaResult`](../interfaces/SchemaResult.md)\>

***

### transitionState()

> `protected` **transitionState**(`newState`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:385](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L385)

Transition to a new state

#### Parameters

##### newState

[`MFEState`](../type-aliases/MFEState.md)

#### Returns

`void`

#### Throws

Error if transition is invalid

***

### updateControlPlaneState()

> **updateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](../interfaces/ControlPlaneStateResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:859](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L859)

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
