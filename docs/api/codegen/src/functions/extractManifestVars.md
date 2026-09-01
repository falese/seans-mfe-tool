[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / extractManifestVars

# Function: extractManifestVars()

> **extractManifestVars**(`manifest`, `variant`): `object`

Defined in: [packages/codegen/src/render-model.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L82)

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

### variant

[`FrameworkVariant`](../interfaces/FrameworkVariant.md) = `...`

## Returns

`object`

### angularExtraDependencyLines

> **angularExtraDependencyLines**: `string`

### bffEndpoint

> **bffEndpoint**: `string`

### bundler

> **bundler**: `"rspack"` \| `"webpack"`

### capabilities

> **capabilities**: [`RenderCapability`](../interfaces/RenderCapability.md)[]

### className

> **className**: `string`

### clientDependencyLines

> **clientDependencyLines**: `string`

### dependencyVersions

> **dependencyVersions**: `object` = `DEPENDENCY_VERSIONS`

#### dependencyVersions.angular

> **angular**: `object`

#### dependencyVersions.angular.common

> **common**: `string` = `'^19.2.16'`

#### dependencyVersions.angular.compiler

> **compiler**: `string` = `'^19.2.16'`

#### dependencyVersions.angular.compilerCli

> **compilerCli**: `string` = `'^19.2.16'`

#### dependencyVersions.angular.core

> **core**: `string` = `'^19.2.16'`

#### dependencyVersions.angular.forms

> **forms**: `string` = `'^19.2.16'`

#### dependencyVersions.angular.platformBrowser

> **platformBrowser**: `string` = `'^19.2.16'`

#### dependencyVersions.angular.rxjs

> **rxjs**: `string` = `'^7.8.0'`

#### dependencyVersions.angular.zoneJs

> **zoneJs**: `string` = `'~0.15.0'`

#### dependencyVersions.angularBuild

> **angularBuild**: `object`

#### dependencyVersions.angularBuild.buildAngular

> **buildAngular**: `string` = `'^19.2.16'`

#### dependencyVersions.angularBuild.cli

> **cli**: `string` = `'^19.2.16'`

#### dependencyVersions.angularBuild.customWebpack

> **customWebpack**: `string` = `'^19.0.1'`

#### dependencyVersions.angularBuild.moduleFederation

> **moduleFederation**: `string` = `'^19.0.3'`

#### dependencyVersions.angularBuild.typescript

> **typescript**: `string` = `'~5.7.0'`

#### dependencyVersions.buildTools

> **buildTools**: `object`

#### dependencyVersions.buildTools.concurrently

> **concurrently**: `string` = `'^8.2.0'`

#### dependencyVersions.buildTools.eslint

> **eslint**: `string` = `'^8.55.0'`

#### dependencyVersions.buildTools.jest

> **jest**: `string` = `'^29.7.0'`

#### dependencyVersions.buildTools.jestEnvJsdom

> **jestEnvJsdom**: `string` = `'^29.7.0'`

#### dependencyVersions.buildTools.rspackCli

> **rspackCli**: `string` = `'^1.7.0'`

#### dependencyVersions.buildTools.rspackCore

> **rspackCore**: `string` = `'^1.7.0'`

#### dependencyVersions.buildTools.serve

> **serve**: `string` = `'^14.2.1'`

#### dependencyVersions.buildTools.supertest

> **supertest**: `string` = `'^6.3.3'`

#### dependencyVersions.buildTools.tsJest

> **tsJest**: `string` = `'^29.2.0'`

#### dependencyVersions.buildTools.tsNode

> **tsNode**: `string` = `'^10.9.1'`

#### dependencyVersions.buildTools.typescript

> **typescript**: `string` = `'^5.3.3'`

#### dependencyVersions.buildTools.typesJest

> **typesJest**: `string` = `'^29.5.0'`

#### dependencyVersions.core

> **core**: `object`

#### dependencyVersions.core.cors

> **cors**: `string` = `'^2.8.5'`

#### dependencyVersions.core.express

> **express**: `string` = `'^4.18.2'`

#### dependencyVersions.core.graphql

> **graphql**: `string` = `'^16.8.1'`

#### dependencyVersions.core.helmet

> **helmet**: `string` = `'^8.1.0'`

#### dependencyVersions.core.tslib

> **tslib**: `string` = `'^2.6.0'`

#### dependencyVersions.graphqlMesh

> **graphqlMesh**: `object`

#### dependencyVersions.graphqlMesh.cli

> **cli**: `string` = `'^0.100.21'`

#### dependencyVersions.graphqlMesh.openapi

> **openapi**: `string` = `'^0.109.26'`

#### dependencyVersions.graphqlMesh.serveRuntime

> **serveRuntime**: `string` = `'^1.2.4'`

#### dependencyVersions.graphqlTools

> **graphqlTools**: `object`

#### dependencyVersions.graphqlTools.delegate

> **delegate**: `string` = `'^10.2.4'`

#### dependencyVersions.graphqlTools.utils

> **utils**: `string` = `'^9.2.1'`

#### dependencyVersions.graphqlTools.wrap

> **wrap**: `string` = `'^10.0.5'`

#### dependencyVersions.meshPlugins

> **meshPlugins**: `object`

#### dependencyVersions.meshPlugins.opentelemetry

> **opentelemetry**: `string` = `'^1.3.67'`

#### dependencyVersions.meshPlugins.prometheus

> **prometheus**: `string` = `'^2.1.8'`

#### dependencyVersions.meshPlugins.responseCache

> **responseCache**: `string` = `'^0.104.20'`

#### dependencyVersions.meshTransforms

> **meshTransforms**: `object`

#### dependencyVersions.meshTransforms.cache

> **cache**: `string` = `'^0.105.37'`

#### dependencyVersions.meshTransforms.filterSchema

> **filterSchema**: `string` = `'^0.104.37'`

#### dependencyVersions.meshTransforms.namingConvention

> **namingConvention**: `string` = `'^0.105.19'`

#### dependencyVersions.meshTransforms.rateLimit

> **rateLimit**: `string` = `'^0.105.38'`

#### dependencyVersions.meshTransforms.resolversComposition

> **resolversComposition**: `string` = `'^0.104.36'`

#### dependencyVersions.mui

> **mui**: `object`

#### dependencyVersions.mui.emotionReact

> **emotionReact**: `string` = `'^11.11.1'`

#### dependencyVersions.mui.emotionStyled

> **emotionStyled**: `string` = `'^11.11.0'`

#### dependencyVersions.mui.material

> **material**: `string` = `'^5.14.0'`

#### dependencyVersions.mui.system

> **system**: `string` = `'^5.14.0'`

#### dependencyVersions.overrides

> **overrides**: `object`

#### dependencyVersions.overrides.fastUri

> **fastUri**: `string` = `'^3.1.2'`

#### dependencyVersions.overrides.serializeJavascript

> **serializeJavascript**: `string` = `'^7.0.5'`

#### dependencyVersions.overrides.tar

> **tar**: `string` = `'^7.5.11'`

#### dependencyVersions.overrides.uuid

> **uuid**: `string` = `'^11.1.1'`

#### dependencyVersions.overrides.webpackDevServer

> **webpackDevServer**: `string` = `'^5.2.4'`

#### dependencyVersions.react

> **react**: `object`

#### dependencyVersions.react.react

> **react**: `string` = `'~18.2.0'`

#### dependencyVersions.react.reactDom

> **reactDom**: `string` = `'~18.2.0'`

#### dependencyVersions.runtime

> **runtime**: `object`

#### dependencyVersions.runtime.package

> **package**: `string` = `'^0.1.0'`

#### dependencyVersions.testingLibrary

> **testingLibrary**: `object`

#### dependencyVersions.testingLibrary.jestDom

> **jestDom**: `string` = `'^6.4.0'`

#### dependencyVersions.testingLibrary.react

> **react**: `string` = `'^14.0.0'`

#### dependencyVersions.testingLibrary.userEvent

> **userEvent**: `string` = `'^14.5.0'`

#### dependencyVersions.types

> **types**: `object`

#### dependencyVersions.types.cors

> **cors**: `string` = `'^2.8.17'`

#### dependencyVersions.types.express

> **express**: `string` = `'^4.17.21'`

#### dependencyVersions.types.node

> **node**: `string` = `'^20.10.0'`

#### dependencyVersions.types.react

> **react**: `string` = `'^18.0.28'`

#### dependencyVersions.types.reactDom

> **reactDom**: `string` = `'^18.0.11'`

#### dependencyVersions.webpackTools

> **webpackTools**: `object`

#### dependencyVersions.webpackTools.jestPresetAngular

> **jestPresetAngular**: `string` = `'^14.0.0'`

#### dependencyVersions.webpackTools.typesJest

> **typesJest**: `string` = `'^29.5.0'`

### description

> **description**: `string` \| `undefined` = `manifest.description`

### framework

> **framework**: `"react"` \| `"angular"`

### handlerSources

> **handlerSources**: [`RenderHandlerSource`](../interfaces/RenderHandlerSource.md)[]

### hasBff

> **hasBff**: `boolean` = `!!manifest.data`

### inputTypeName

> **inputTypeName**: `string`

### lifecycleHooks

> **lifecycleHooks**: [`RenderLifecycleHook`](../interfaces/RenderLifecycleHook.md)[]

### manifest

> **manifest**: `object`

#### manifest.authorization?

> `optional` **authorization**: `unknown`

#### manifest.bundler?

> `optional` **bundler**: `string`

#### manifest.capabilities

> **capabilities**: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]

#### manifest.category?

> `optional` **category**: `string`

#### manifest.data?

> `optional` **data**: `object`

#### manifest.data.generatedFrom?

> `optional` **generatedFrom**: `object`[]

#### manifest.data.mockSwitch?

> `optional` **mockSwitch**: `object`

#### manifest.data.mockSwitch.enabled

> **enabled**: `boolean`

#### manifest.data.plugins?

> `optional` **plugins**: `Record`\<`string`, `unknown`\>[]

#### manifest.data.serve?

> `optional` **serve**: `object`

#### manifest.data.serve.endpoint

> **endpoint**: `string`

#### manifest.data.serve.playground

> **playground**: `boolean`

#### manifest.data.sources

> **sources**: `object`[]

#### manifest.data.transforms?

> `optional` **transforms**: `Record`\<`string`, `unknown`\>[]

#### manifest.dependencies?

> `optional` **dependencies**: `object`

#### manifest.dependencies.design-system?

> `optional` **design-system**: `Record`\<`string`, `string`\>

#### manifest.dependencies.mfes?

> `optional` **mfes**: `Record`\<`string`, `string`\>

#### manifest.dependencies.runtime?

> `optional` **runtime**: `Record`\<`string`, `string`\>

#### manifest.description?

> `optional` **description**: `string`

#### manifest.discovery?

> `optional` **discovery**: `string`

#### manifest.endpoint?

> `optional` **endpoint**: `string`

#### manifest.framework?

> `optional` **framework**: `string`

#### manifest.language

> **language**: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"` = `LanguageSchema`

#### manifest.name

> **name**: `string`

#### manifest.owner?

> `optional` **owner**: `string`

#### manifest.performance?

> `optional` **performance**: `object`

#### manifest.performance.caching?

> `optional` **caching**: `object`

#### manifest.performance.caching.enabled

> **enabled**: `boolean`

#### manifest.performance.caching.strategies?

> `optional` **strategies**: `object`[]

#### manifest.performance.caching.ttl

> **ttl**: `number`

#### manifest.performance.filterSchema?

> `optional` **filterSchema**: `object`

#### manifest.performance.filterSchema.enabled

> **enabled**: `boolean`

#### manifest.performance.filterSchema.filters?

> `optional` **filters**: `string`[]

#### manifest.performance.observability?

> `optional` **observability**: `object`

#### manifest.performance.observability.opentelemetry?

> `optional` **opentelemetry**: `object`

#### manifest.performance.observability.opentelemetry.enabled

> **enabled**: `boolean`

#### manifest.performance.observability.opentelemetry.exporters?

> `optional` **exporters**: `object`[]

#### manifest.performance.observability.opentelemetry.sampling?

> `optional` **sampling**: `object`

#### manifest.performance.observability.opentelemetry.sampling.probability

> **probability**: `number`

#### manifest.performance.observability.opentelemetry.serviceName?

> `optional` **serviceName**: `string`

#### manifest.performance.observability.prometheus?

> `optional` **prometheus**: `object`

#### manifest.performance.observability.prometheus.enabled

> **enabled**: `boolean`

#### manifest.performance.observability.prometheus.endpoint

> **endpoint**: `string`

#### manifest.performance.observability.prometheus.port

> **port**: `number`

#### manifest.performance.rateLimit?

> `optional` **rateLimit**: `object`

#### manifest.performance.rateLimit.config?

> `optional` **config**: `object`[]

#### manifest.performance.rateLimit.enabled

> **enabled**: `boolean`

#### manifest.providesSlots?

> `optional` **providesSlots**: `object`[]

#### manifest.remoteEntry?

> `optional` **remoteEntry**: `string`

#### manifest.tags?

> `optional` **tags**: `string`[]

#### manifest.transforms?

> `optional` **transforms**: `string`[]

#### manifest.type

> **type**: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"` = `MFETypeSchema`

#### manifest.version

> **version**: `string`

### meshPlugins

> **meshPlugins**: `object`

#### meshPlugins.opentelemetry

> **opentelemetry**: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \} \| `null`

#### meshPlugins.prometheus

> **prometheus**: \{ `enabled?`: `boolean`; `endpoint?`: `string`; `port?`: `number`; \} \| `null`

#### meshPlugins.responseCache

> **responseCache**: \{ `ttl`: `number`; \} \| `null`

### meshTransforms

> **meshTransforms**: `object`

#### meshTransforms.customTransforms

> **customTransforms**: `string`[]

#### meshTransforms.filterSchema

> **filterSchema**: \{ `enabled`: `boolean`; `filters?`: `string`[]; \} \| `null`

#### meshTransforms.mockSwitch

> **mockSwitch**: `boolean` = `mockSwitchEnabled`

#### meshTransforms.namingConvention

> **namingConvention**: `object` = `DEFAULT_MESH_TRANSFORMS.namingConvention`

#### meshTransforms.namingConvention.fieldNames

> **fieldNames**: `string` = `'camelCase'`

#### meshTransforms.namingConvention.typeNames

> **typeNames**: `string` = `'pascalCase'`

#### meshTransforms.rateLimit

> **rateLimit**: \{ `config?`: `object`[]; `enabled`: `boolean`; \} \| `null`

### muiVersion

> **muiVersion**: `string`

### name

> **name**: `string` = `manifest.name`

### neededPlugins

> **neededPlugins**: `string`[]

### neededTransforms

> **neededTransforms**: `string`[]

### outputTypeName

> **outputTypeName**: `string`

### platformCapabilityNames

> **platformCapabilityNames**: (`"describe"` \| `"load"` \| `"render"` \| `"refresh"` \| `"emit"` \| `"query"` \| `"schema"` \| `"authorizeAccess"` \| `"health"` \| `"updateControlPlaneState"`)[]

### port

> **port**: `number`

### remotes

> **remotes**: `Record`\<`string`, `unknown`\>

### rspackSharedEntries

> **rspackSharedEntries**: `string`

### templateVariant

> **templateVariant**: `"react-rspack"` \| `"angular-webpack"` = `variant.templateVariant`

### version

> **version**: `string` = `manifest.version`
