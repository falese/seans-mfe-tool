[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / parseManifestFile

# Function: parseManifestFile()

> **parseManifestFile**(`manifestPath`): `Promise`\<\{ `authorization?`: `unknown`; `bundler?`: `string`; `capabilities`: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]; `category?`: `string`; `data?`: \{ `generatedFrom?`: `object`[]; `mockSwitch?`: \{ `enabled`: `boolean`; \}; `plugins?`: `Record`\<`string`, `unknown`\>[]; `serve?`: \{ `endpoint`: `string`; `playground`: `boolean`; \}; `sources`: `object`[]; `transforms?`: `Record`\<`string`, `unknown`\>[]; \}; `dependencies?`: \{ `design-system?`: `Record`\<`string`, `string`\>; `mfes?`: `Record`\<`string`, `string`\>; `runtime?`: `Record`\<`string`, `string`\>; \}; `description?`: `string`; `discovery?`: `string`; `endpoint?`: `string`; `framework?`: `string`; `language`: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"`; `name`: `string`; `owner?`: `string`; `performance?`: \{ `caching?`: \{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \}; `filterSchema?`: \{ `enabled`: `boolean`; `filters?`: `string`[]; \}; `observability?`: \{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \}; `rateLimit?`: \{ `config?`: `object`[]; `enabled`: `boolean`; \}; \}; `providesSlots?`: `object`[]; `remoteEntry?`: `string`; `tags?`: `string`[]; `transforms?`: `string`[]; `type`: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"`; `version`: `string`; \}\>

Defined in: [packages/dsl/src/parser.ts:65](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/parser.ts#L65)

Read and parse a DSL manifest from a file path

## Parameters

### manifestPath

`string`

Path to the manifest file

## Returns

`Promise`\<\{ `authorization?`: `unknown`; `bundler?`: `string`; `capabilities`: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `before?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `error?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; `main?`: `Record`\<`string`, \{ `contained?`: ...; `description?`: ...; `handler`: ...; `mandatory?`: ...; `source?`: ...; \}\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]; `category?`: `string`; `data?`: \{ `generatedFrom?`: `object`[]; `mockSwitch?`: \{ `enabled`: `boolean`; \}; `plugins?`: `Record`\<`string`, `unknown`\>[]; `serve?`: \{ `endpoint`: `string`; `playground`: `boolean`; \}; `sources`: `object`[]; `transforms?`: `Record`\<`string`, `unknown`\>[]; \}; `dependencies?`: \{ `design-system?`: `Record`\<`string`, `string`\>; `mfes?`: `Record`\<`string`, `string`\>; `runtime?`: `Record`\<`string`, `string`\>; \}; `description?`: `string`; `discovery?`: `string`; `endpoint?`: `string`; `framework?`: `string`; `language`: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"`; `name`: `string`; `owner?`: `string`; `performance?`: \{ `caching?`: \{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \}; `filterSchema?`: \{ `enabled`: `boolean`; `filters?`: `string`[]; \}; `observability?`: \{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: `object`[]; `sampling?`: \{ `probability`: `number`; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \}; `rateLimit?`: \{ `config?`: `object`[]; `enabled`: `boolean`; \}; \}; `providesSlots?`: `object`[]; `remoteEntry?`: `string`; `tags?`: `string`[]; `transforms?`: `string`[]; `type`: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"`; `version`: `string`; \}\>

Parsed DSL manifest

## Throws

Error if file not found or parsing fails
