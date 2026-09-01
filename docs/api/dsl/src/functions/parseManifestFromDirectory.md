[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / parseManifestFromDirectory

# Function: parseManifestFromDirectory()

> **parseManifestFromDirectory**(`directory`): `Promise`\<\{ `manifest`: \{ `authorization?`: `unknown`; `bundler?`: `string`; `capabilities`: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<..., ...\>[]; `before?`: `Record`\<..., ...\>[]; `error?`: `Record`\<..., ...\>[]; `main?`: `Record`\<..., ...\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]; `category?`: `string`; `data?`: \{ `generatedFrom?`: `object`[]; `mockSwitch?`: \{ `enabled`: `boolean`; \}; `plugins?`: `Record`\<`string`, `unknown`\>[]; `serve?`: \{ `endpoint`: `string`; `playground`: `boolean`; \}; `sources`: `object`[]; `transforms?`: `Record`\<`string`, `unknown`\>[]; \}; `dependencies?`: \{ `design-system?`: `Record`\<`string`, `string`\>; `mfes?`: `Record`\<`string`, `string`\>; `runtime?`: `Record`\<`string`, `string`\>; \}; `description?`: `string`; `discovery?`: `string`; `endpoint?`: `string`; `framework?`: `string`; `language`: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"`; `name`: `string`; `owner?`: `string`; `performance?`: \{ `caching?`: \{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \}; `filterSchema?`: \{ `enabled`: `boolean`; `filters?`: `string`[]; \}; `observability?`: \{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: ...[]; `sampling?`: \{ `probability`: ...; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \}; `rateLimit?`: \{ `config?`: `object`[]; `enabled`: `boolean`; \}; \}; `providesSlots?`: `object`[]; `remoteEntry?`: `string`; `tags?`: `string`[]; `transforms?`: `string`[]; `type`: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"`; `version`: `string`; \}; `manifestPath`: `string`; \}\>

Defined in: [packages/dsl/src/parser.ts:125](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/parser.ts#L125)

Parse manifest from a directory (auto-detects filename)

## Parameters

### directory

`string`

Directory containing the manifest

## Returns

`Promise`\<\{ `manifest`: \{ `authorization?`: `unknown`; `bundler?`: `string`; `capabilities`: `Record`\<`string`, \{ `authorization?`: `string`; `description?`: `string`; `handler?`: `string`; `inputs?`: `object`[]; `lifecycle?`: \{ `after?`: `Record`\<..., ...\>[]; `before?`: `Record`\<..., ...\>[]; `error?`: `Record`\<..., ...\>[]; `main?`: `Record`\<..., ...\>[]; \}; `outputs?`: `object`[]; `type`: `"platform"` \| `"domain"`; \}\>[]; `category?`: `string`; `data?`: \{ `generatedFrom?`: `object`[]; `mockSwitch?`: \{ `enabled`: `boolean`; \}; `plugins?`: `Record`\<`string`, `unknown`\>[]; `serve?`: \{ `endpoint`: `string`; `playground`: `boolean`; \}; `sources`: `object`[]; `transforms?`: `Record`\<`string`, `unknown`\>[]; \}; `dependencies?`: \{ `design-system?`: `Record`\<`string`, `string`\>; `mfes?`: `Record`\<`string`, `string`\>; `runtime?`: `Record`\<`string`, `string`\>; \}; `description?`: `string`; `discovery?`: `string`; `endpoint?`: `string`; `framework?`: `string`; `language`: `"javascript"` \| `"typescript"` \| `"python"` \| `"go"` \| `"rust"` \| `"java"`; `name`: `string`; `owner?`: `string`; `performance?`: \{ `caching?`: \{ `enabled`: `boolean`; `strategies?`: `object`[]; `ttl`: `number`; \}; `filterSchema?`: \{ `enabled`: `boolean`; `filters?`: `string`[]; \}; `observability?`: \{ `opentelemetry?`: \{ `enabled`: `boolean`; `exporters?`: ...[]; `sampling?`: \{ `probability`: ...; \}; `serviceName?`: `string`; \}; `prometheus?`: \{ `enabled`: `boolean`; `endpoint`: `string`; `port`: `number`; \}; \}; `rateLimit?`: \{ `config?`: `object`[]; `enabled`: `boolean`; \}; \}; `providesSlots?`: `object`[]; `remoteEntry?`: `string`; `tags?`: `string`[]; `transforms?`: `string`[]; `type`: `"tool"` \| `"agent"` \| `"feature"` \| `"service"` \| `"remote"` \| `"shell"` \| `"bff"`; `version`: `string`; \}; `manifestPath`: `string`; \}\>

Parsed DSL manifest and its path

## Throws

Error if no manifest found or parsing fails
