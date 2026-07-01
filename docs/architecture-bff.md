# BFF Layer Architecture

**Status:** Informative reference for the GraphQL-Mesh BFF subsystem. Closes documentation
gap **G03**.

**Authoritative sources:**

| Concept | Source |
| --- | --- |
| BFF plugin (config extraction, deps) | `packages/bff-plugin/src/shared.ts` |
| BFF types | `packages/bff-plugin/src/types.ts` |
| BFF templates | `packages/bff-plugin/templates/{meshrc.yaml,server.ts,bff.ts,mesh-context.js,mock-switch.js}.ejs` |
| `query()` runtime path | `src/runtime/base-mfe.ts:861–886` |
| Governing decisions | ADR-012 (Mesh BFF), ADR-027 (Mesh v0.100.x plugins/transforms), ADR-052 (demo mode) |

> **ADR numbering note (resolved 2026-07-01):** generated BFF template comments previously
> cited pre-reflow ADR numbers (`ADR-046`/`ADR-062` in `meshrc.yaml.ejs`); they now use the
> canonical ADR-012 / ADR-027 (see [`spec.md#adr-index`](./spec.md#adr-index)).

---

## 1. What the BFF is

Each MFE can declare a `data:` section in its manifest; the BFF layer turns that into a
GraphQL-Mesh server that fronts the MFE's data sources (REST/OpenAPI, etc.) with a single
GraphQL endpoint. The DSL `data:` section is the **single source of truth** — the
`.meshrc.yaml` is generated from it, never hand-written (REQ-BFF-001).

```
manifest.data ──▶ extractMeshConfig() ──▶ MeshConfig ──▶ writeMeshConfig()
   (sources,         (shared.ts:124)                        (.meshrc.yaml)
    transforms,                                                  │
    plugins,                                          addMeshDependencies()
    serve)                                            (pins @graphql-mesh/* )
                                                                 │
                                                          server.ts + bff.ts
                                                          + mesh-context.js
```

## 2. Composition flow

In `packages/bff-plugin/src/shared.ts`:

- **`extractMeshConfig(manifestPath)`** (`:124`) reads the manifest and builds a
  `MeshConfig` from `data.sources` / `data.transforms` / `data.plugins`, defaulting
  `serve` to `{ endpoint: '/graphql', playground: true }` (`:146`) when unset.
- **`writeMeshConfig(meshConfig, targetDir)`** (`:156`) serializes it to `.meshrc.yaml`
  via `yaml.dump` (`:158`).
- **`addMeshDependencies(targetDir)`** (`:167`) pins the Mesh runtime stack into the
  generated `package.json` — `@graphql-mesh/serve-runtime`, `@graphql-tools/{delegate,
  utils,wrap}`, `@graphql-mesh/plugin-response-cache`, `graphql` (`:184–189`). Versions are
  pinned per ADR-050 dependency governance.

The `meshrc.yaml.ejs` template injects an envelop context plugin
(`./src/platform/bff/mesh-context.js`) that puts `jwt`, `requestId`, `userId`, and request
headers into every GraphQL execution context (ADR-027).

## 3. Performance & observability plugins (ADR-027)

Plugins are emitted into `.meshrc.yaml` only when the manifest enables them:
`responseCache` (with `ttl`), `prometheus`, and `opentelemetry`. The template guards each
with a conditional so a minimal BFF stays minimal.

## 4. Demo mode (ADR-052)

When `data.mockSwitch` is configured, requests carrying an `x-bff-mode` header switch
between live and mock resolution **per request**, via `resolversComposition`. The response
cache is bypassed when `x-bff-mode` is present (`meshrc.yaml.ejs`) so a mock/live override
is never served stale data from a prior request. This makes demos and tests deterministic
without redeploying.

## 5. How MFEs call the BFF — `query()` URL resolution

The platform `query()` capability dispatches `context.inputs.document` + `variables` to the
resolved BFF URL. The resolution order is defined in `base-mfe.ts:879–886` and is, highest
priority first:

1. `context.inputs.bffUrl` — caller override (e.g. a shell passing the remote's absolute URL)
2. `deps.bffUrl` — constructor injection
3. `BFF_URL` environment variable — runtime configuration
4. `manifest.endpoint` + `manifest.data.serve.endpoint` — composed self-describing URL
5. `manifest.data.serve.endpoint` alone — relative path
6. `'/graphql'` — fallback

This order is authoritative (Contract Alignment finding CA-4). For operator troubleshooting
of the resolution ladder, see the
[Runtime Operational Runbook](./platform-design-review/runtime-operational-runbook.md).

## Related

- [DSL Architecture](./architecture-dsl.md) — the `data:` section schema.
- [Code Generation Architecture](./architecture-codegen.md) — where BFF artifacts are emitted.
- [Runtime Operational Runbook](./platform-design-review/runtime-operational-runbook.md) — `query()` diagnostics.
</content>
