[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MESH\_PLUGINS

# Variable: MESH\_PLUGINS

> `const` **MESH\_PLUGINS**: readonly \[`"responseCache"`, `"prometheus"`, `"opentelemetry"`, `"newrelic"`, `"statsd"`, `"datadog"`, `"liveQuery"`, `"deferStream"`, `"meshHttp"`, `"httpDetails"`, `"operationFieldPermissions"`, `"jwtAuth"`, `"hmac"`, `"useMaskedErrors"`, `"usePersistedOperations"`\]

Defined in: [packages/contracts/src/mesh-catalog.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/mesh-catalog.ts#L38)

Mesh plugins — `@graphql-mesh/plugin-*`, configured under the manifest's
`performance` / `data.plugins` sections and rendered into `.meshrc.yaml`
under `plugins:`.
