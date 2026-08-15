[**seans-mfe-tool API reference**](../../../../README.md)

***

[seans-mfe-tool API reference](../../../../README.md) / [runtime/src/angular](../README.md) / AngularRemoteMFE

# Class: AngularRemoteMFE

Defined in: [packages/runtime/src/angular-remote-mfe.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L56)

AngularRemoteMFE class for Angular Module Federation remotes

Mounts standalone components via bootstrapApplication() from
@angular/platform-browser. Tracks an ApplicationRef per containerId so
re-renders destroy and re-bootstrap cleanly.

## Extends

- `BaseRemoteMFE`

## Constructors

### Constructor

> **new AngularRemoteMFE**(`manifest`, `deps`): `AngularRemoteMFE`

Defined in: [packages/runtime/src/base-mfe.ts:312](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L312)

#### Parameters

##### manifest

###### authorization?

`unknown` = `...`

###### bundler?

`string` = `...`

###### capabilities

`Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ... \| ... \| ...; `description?`: ... \| ...; `handler`: ... \| ...; `mandatory?`: ... \| ... \| ...; `source?`: ... \| ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[] = `...`

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

###### providesSlots?

`object`[] = `...`

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

`AngularRemoteMFE`

#### Inherited from

`BaseRemoteMFE.constructor`

## Properties

### availableComponents

> `protected` **availableComponents**: `string`[] = `[]`

Defined in: [packages/runtime/src/base-remote-mfe.ts:117](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L117)

#### Inherited from

`BaseRemoteMFE.availableComponents`

***

### container

> `protected` **container**: [`ModuleFederationContainer`](../../react/interfaces/ModuleFederationContainer.md) \| `null` = `null`

Defined in: [packages/runtime/src/base-remote-mfe.ts:116](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L116)

#### Inherited from

`BaseRemoteMFE.container`

***

### currentComponentId

> `protected` **currentComponentId**: `string` \| `null` = `null`

Defined in: [packages/runtime/src/base-remote-mfe.ts:124](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L124)

ID of the currently mounted component; used as actionRecord.componentId

#### Inherited from

`BaseRemoteMFE.currentComponentId`

***

### deps

> `protected` `readonly` **deps**: `BaseMFEDependencies`

Defined in: [packages/runtime/src/base-mfe.ts:299](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L299)

DI dependencies

#### Inherited from

`BaseRemoteMFE.deps`

***

### manifest

> `protected` `readonly` **manifest**: `object`

Defined in: [packages/runtime/src/base-mfe.ts:296](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L296)

DSL manifest for this MFE

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

#### Inherited from

`BaseRemoteMFE.manifest`

***

### mountedComponent

> `protected` **mountedComponent**: \{ `component`: `string`; `element`: `unknown`; `props`: `Record`\<`string`, `unknown`\>; \} \| `null` = `null`

Defined in: [packages/runtime/src/base-remote-mfe.ts:118](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L118)

#### Inherited from

`BaseRemoteMFE.mountedComponent`

***

### state

> `protected` **state**: `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"` = `MFE_LIFECYCLE_INITIAL_STATE`

Defined in: [packages/runtime/src/base-mfe.ts:302](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L302)

Current lifecycle state

#### Inherited from

`BaseRemoteMFE.state`

***

### stateHistory

> `protected` **stateHistory**: `object`[] = `[]`

Defined in: [packages/runtime/src/base-mfe.ts:305](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L305)

State transition history (for debugging)

#### from

> **from**: `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

#### timestamp

> **timestamp**: `Date`

#### to

> **to**: `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

#### Inherited from

`BaseRemoteMFE.stateHistory`

## Methods

### assertState()

> `protected` **assertState**(...`expectedStates`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:345](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L345)

Assert that current state matches expected state

#### Parameters

##### expectedStates

...(`"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`)[]

#### Returns

`void`

#### Throws

Error if state doesn't match

#### Inherited from

`BaseRemoteMFE.assertState`

***

### attachControlPlane()

> **attachControlPlane**(`wsClient`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:326](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L326)

Attach a daemon control-plane socket after construction (ADR-057).

Generated MFEs are built without deps; when a host composes one
(LayoutManager, ADR-055) it injects a per-slot virtual channel here so the
platform capability `updateControlPlaneState` rides the host's single
physical socket. `deps` is readonly, but `wsClient` is a mutable member of
it. Idempotent: re-attaching replaces the channel.

#### Parameters

##### wsClient

[`DaemonWebSocketClient`](../../interfaces/DaemonWebSocketClient.md)

#### Returns

`void`

#### Inherited from

`BaseRemoteMFE.attachControlPlane`

***

### authorizeAccess()

> **authorizeAccess**(`context`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/base-mfe.ts:783](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L783)

AuthorizeAccess capability: Check authorization

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

`BaseRemoteMFE.authorizeAccess`

***

### describe()

> **describe**(`context`): `Promise`\<[`DescribeResult`](../../interfaces/DescribeResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:797](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L797)

Describe capability: Return MFE metadata

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`DescribeResult`](../../interfaces/DescribeResult.md)\>

#### Inherited from

`BaseRemoteMFE.describe`

***

### doAuthorizeAccess()

> `protected` **doAuthorizeAccess**(`_context`): `Promise`\<`boolean`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:526](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L526)

Implement authorization logic for this MFE

#### Parameters

##### \_context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

`BaseRemoteMFE.doAuthorizeAccess`

***

### doDescribe()

> `protected` **doDescribe**(`_context`): `Promise`\<[`DescribeResult`](../../interfaces/DescribeResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:550](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L550)

Implement describe logic for this MFE

#### Parameters

##### \_context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`DescribeResult`](../../interfaces/DescribeResult.md)\>

#### Inherited from

`BaseRemoteMFE.doDescribe`

***

### doEmit()

> `protected` **doEmit**(`context`): `Promise`\<[`EmitResult`](../../interfaces/EmitResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:567](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L567)

Implement telemetry emission logic for this MFE

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`EmitResult`](../../interfaces/EmitResult.md)\>

#### Inherited from

`BaseRemoteMFE.doEmit`

***

### doHealth()

> `protected` **doHealth**(`_context`): `Promise`\<[`HealthResult`](../../interfaces/HealthResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:531](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L531)

Implement health check logic for this MFE

#### Parameters

##### \_context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`HealthResult`](../../interfaces/HealthResult.md)\>

#### Inherited from

`BaseRemoteMFE.doHealth`

***

### doLoad()

> `protected` **doLoad**(`context`): `Promise`\<[`LoadResult`](../../interfaces/LoadResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:184](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L184)

Implement load logic for Module Federation remote

REQ-RUNTIME-001: Atomic operation with three phases:
1. Entry: Fetch remote entry + container
2. Mount: Initialize container, wire shared deps
3. Enable-render: Prepare MFE state for render phase

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`LoadResult`](../../interfaces/LoadResult.md)\>

#### Inherited from

`BaseRemoteMFE.doLoad`

***

### doQuery()

> `protected` **doQuery**(`context`): `Promise`\<[`QueryResult`](../../interfaces/QueryResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:915](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L915)

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

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`QueryResult`](../../interfaces/QueryResult.md)\>

#### Inherited from

`BaseRemoteMFE.doQuery`

***

### doRefresh()

> `protected` **doRefresh**(`_context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:522](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L522)

Implement refresh logic for this MFE

#### Parameters

##### \_context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Inherited from

`BaseRemoteMFE.doRefresh`

***

### doRender()

> `protected` **doRender**(`context`): `Promise`\<[`RenderResult`](../../interfaces/RenderResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:313](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L313)

Implement render logic for Module Federation remote

REQ-RUNTIME-004: Component-aware rendering with:
- Component selection from available components
- Props validation and passing
- Error boundary integration
- DOM mounting delegated to the framework-specific mountComponent()

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`RenderResult`](../../interfaces/RenderResult.md)\>

#### Inherited from

`BaseRemoteMFE.doRender`

***

### doSchema()

> `protected` **doSchema**(`_context`): `Promise`\<[`SchemaResult`](../../interfaces/SchemaResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:560](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L560)

Implement schema retrieval logic for this MFE

#### Parameters

##### \_context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`SchemaResult`](../../interfaces/SchemaResult.md)\>

#### Inherited from

`BaseRemoteMFE.doSchema`

***

### doUpdateControlPlaneState()

> `protected` **doUpdateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](../../interfaces/ControlPlaneStateResult.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:597](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L597)

Push domain state to the daemon control plane for registry re-evaluation.

Module Federation MFEs run in the browser, so this sends a GraphQL mutation
over the existing WebSocket connection to the daemon:

  mutation SendAction($input: ActionInput!) {
    sendAction(input: $input) { correlationId acknowledged }
  }

The daemon forwards to Registry handleMessage → rules engine re-evaluation.
The registry may resolve a new MFE + capability, which arrives via the
Subscription.messages channel the Renderer is already subscribed to.

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`ControlPlaneStateResult`](../../interfaces/ControlPlaneStateResult.md)\>

#### Inherited from

`BaseRemoteMFE.doUpdateControlPlaneState`

***

### emit()

> **emit**(`context`): `Promise`\<[`EmitResult`](../../interfaces/EmitResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:818](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L818)

Emit capability: Emit telemetry/events

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`EmitResult`](../../interfaces/EmitResult.md)\>

#### Inherited from

`BaseRemoteMFE.emit`

***

### emitTelemetry()

> `protected` **emitTelemetry**(`name`, `capability`, `phase`, `status`, `extra?`): `void`

Defined in: [packages/runtime/src/base-remote-mfe.ts:158](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L158)

Emit a telemetry event with the standard shape shared by every checkpoint
in doLoad()/doRender(): `metadata.mfe` is always set, extra metadata is
merged in, and `duration` is set at the top level only when provided.
No-ops when no telemetry service is injected.

#### Parameters

##### name

`string`

##### capability

`string`

##### phase

`string`

##### status

`"error"` | `"success"` | `"failure"` | `"start"` | `"end"`

##### extra?

###### duration?

`number`

###### metadata?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Inherited from

`BaseRemoteMFE.emitTelemetry`

***

### executeLifecycle()

> `protected` **executeLifecycle**(`capability`, `phase`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:401](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L401)

Execute lifecycle hooks for a capability phase

#### Parameters

##### capability

`string`

Capability name (load, render, etc.)

##### phase

Lifecycle phase (before, main, after, error)

`"error"` | `"before"` | `"main"` | `"after"`

##### context

[`Context`](../../interfaces/Context.md)

Execution context

#### Returns

`Promise`\<`void`\>

#### Inherited from

`BaseRemoteMFE.executeLifecycle`

***

### extractAvailableComponents()

> `protected` **extractAvailableComponents**(): `string`[]

Defined in: [packages/runtime/src/base-remote-mfe.ts:456](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L456)

Extract available components from manifest.

Primary:  render.components array when explicitly declared.
Fallback: all non-platform capability names (domain capabilities).
          This allows MFEs to work without a render capability block
          while still exposing their domain features as mountable components.

#### Returns

`string`[]

#### Inherited from

`BaseRemoteMFE.extractAvailableComponents`

***

### extractCapabilities()

> `protected` **extractCapabilities**(): `CapabilityMetadata`[]

Defined in: [packages/runtime/src/base-remote-mfe.ts:489](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L489)

Extract capability metadata from manifest (REQ-RUNTIME-003)

#### Returns

`CapabilityMetadata`[]

#### Inherited from

`BaseRemoteMFE.extractCapabilities`

***

### fetchContainer()

> `protected` **fetchContainer**(`remoteEntry`): `Promise`\<[`ModuleFederationContainer`](../../react/interfaces/ModuleFederationContainer.md)\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:431](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L431)

Fetch Module Federation container from remote entry.

Stubbed for now — a real implementation loads remoteEntry.js, initializes
the federation shared scope, and returns the container interface. The
webpack/rspack federation runtimes are structurally compatible here.

#### Parameters

##### remoteEntry

`string`

#### Returns

`Promise`\<[`ModuleFederationContainer`](../../react/interfaces/ModuleFederationContainer.md)\>

#### Inherited from

`BaseRemoteMFE.fetchContainer`

***

### getSharedDependencies()

> `protected` **getSharedDependencies**(): `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/angular-remote-mfe.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L68)

Get shared dependencies for Module Federation (Angular singletons).

Angular requires singleton + strictVersion across host + remotes — two
@angular/core instances cause "Two copies of Angular" runtime errors.
zone.js loads eagerly because Angular bootstrap is zone-dependent and
must be available synchronously.

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

`BaseRemoteMFE.getSharedDependencies`

***

### getState()

> **getState**(): `"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

Defined in: [packages/runtime/src/base-mfe.ts:337](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L337)

Get current state

#### Returns

`"error"` \| `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"destroyed"`

#### Inherited from

`BaseRemoteMFE.getState`

***

### health()

> **health**(`context`): `Promise`\<[`HealthResult`](../../interfaces/HealthResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:790](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L790)

Health capability: Check MFE health status

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`HealthResult`](../../interfaces/HealthResult.md)\>

#### Inherited from

`BaseRemoteMFE.health`

***

### invokeCustomHandler()

> `protected` **invokeCustomHandler**(`name`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:568](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L568)

Invoke a custom handler from developer implementation

#### Parameters

##### name

`string`

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Throws

Error if custom handler not found

#### Inherited from

`BaseRemoteMFE.invokeCustomHandler`

***

### invokeHandler()

> `protected` **invokeHandler**(`handlerName`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:519](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L519)

Invoke a handler by name (platform.* or custom.*)

REQ-058: Platform handlers resolved from standard library
REQ-057: Custom handlers resolved from developer class

#### Parameters

##### handlerName

`string`

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Inherited from

`BaseRemoteMFE.invokeHandler`

***

### invokePlatformHandler()

> `protected` **invokePlatformHandler**(`name`, `context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:553](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L553)

Invoke a platform handler from the standard library — a flat, statically
built map (PLATFORM_HANDLER_LIBRARY), so resolution is a single lookup.

#### Parameters

##### name

`string`

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Throws

Error if platform handler not found

#### Inherited from

`BaseRemoteMFE.invokePlatformHandler`

***

### load()

> **load**(`context`): `Promise`\<[`LoadResult`](../../interfaces/LoadResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:762](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L762)

Load capability: Initialize and prepare MFE for use

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`LoadResult`](../../interfaces/LoadResult.md)\>

#### Inherited from

`BaseRemoteMFE.load`

***

### loadDomainComponent()

> `protected` **loadDomainComponent**(`_name`): `Promise`\<`unknown`\>

Defined in: [packages/runtime/src/base-remote-mfe.ts:512](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-remote-mfe.ts#L512)

Override in subclass to load the named domain component.
Called by doRender() instead of going through the Module Federation container API.

#### Parameters

##### \_name

`string`

#### Returns

`Promise`\<`unknown`\>

#### Inherited from

`BaseRemoteMFE.loadDomainComponent`

***

### mountComponent()

> `protected` **mountComponent**(`Component`, `props`, `containerId`): `Promise`\<`unknown`\>

Defined in: [packages/runtime/src/angular-remote-mfe.ts:97](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L97)

Mount an Angular standalone component to the DOM via bootstrapApplication().

Angular's standalone bootstrap is selector-driven: the platform looks up
the component's selector in the DOM and replaces it. We inject the
selector tag into the containerId element, then bootstrap.

Re-renders destroy the prior ApplicationRef before re-bootstrapping —
Angular doesn't expose a simple "update inputs on existing app" idiom
for standalone bootstrap. Props are applied to the bootstrapped instance
after the initial component is created.

#### Parameters

##### Component

`unknown`

##### props

`Record`\<`string`, `unknown`\>

##### containerId

`string`

#### Returns

`Promise`\<`unknown`\>

#### Overrides

`BaseRemoteMFE.mountComponent`

***

### query()

> **query**(`context`): `Promise`\<[`QueryResult`](../../interfaces/QueryResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:811](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L811)

Query capability: Execute data query

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`QueryResult`](../../interfaces/QueryResult.md)\>

#### Inherited from

`BaseRemoteMFE.query`

***

### refresh()

> **refresh**(`context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-mfe.ts:776](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L776)

Refresh capability: Refresh MFE data/state

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<`void`\>

#### Inherited from

`BaseRemoteMFE.refresh`

***

### render()

> **render**(`context`): `Promise`\<[`RenderResult`](../../interfaces/RenderResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:769](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L769)

Render capability: Render MFE UI into target container

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`RenderResult`](../../interfaces/RenderResult.md)\>

#### Inherited from

`BaseRemoteMFE.render`

***

### schema()

> **schema**(`context`): `Promise`\<[`SchemaResult`](../../interfaces/SchemaResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:804](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L804)

Schema capability: Return GraphQL/JSON schema

#### Parameters

##### context

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`SchemaResult`](../../interfaces/SchemaResult.md)\>

#### Inherited from

`BaseRemoteMFE.schema`

***

### transitionState()

> `protected` **transitionState**(`newState`): `void`

Defined in: [packages/runtime/src/base-mfe.ts:362](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L362)

Transition to a new state

#### Parameters

##### newState

`"error"` | `"uninitialized"` | `"loading"` | `"ready"` | `"rendering"` | `"destroyed"`

#### Returns

`void`

#### Throws

Error if transition is invalid

#### Inherited from

`BaseRemoteMFE.transitionState`

***

### unmount()

> **unmount**(`containerId`): `void`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:214](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L214)

Unmount a previously bootstrapped Angular application for the given container
and release the ApplicationRef. Call from the shell's lifecycle cleanup.

#### Parameters

##### containerId

`string`

#### Returns

`void`

#### Overrides

`BaseRemoteMFE.unmount`

***

### updateControlPlaneState()

> **updateControlPlaneState**(`context`): `Promise`\<[`ControlPlaneStateResult`](../../interfaces/ControlPlaneStateResult.md)\>

Defined in: [packages/runtime/src/base-mfe.ts:843](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L843)

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

[`Context`](../../interfaces/Context.md)

#### Returns

`Promise`\<[`ControlPlaneStateResult`](../../interfaces/ControlPlaneStateResult.md)\>

#### Inherited from

`BaseRemoteMFE.updateControlPlaneState`
