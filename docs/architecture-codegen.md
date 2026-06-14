# Code Generation Architecture

**Status:** Informative reference for the codegen subsystem. Normative rules live in the
ADRs cited inline. Closes documentation gap **G01**.

**Authoritative sources:**

| Concept | Source |
| --- | --- |
| Generator entry point | `src/codegen/UnifiedGenerator/unified-generator.ts` |
| Manifest schema (codegen input) | `src/dsl/schema.ts` (see [DSL Architecture](./architecture-dsl.md)) |
| Template variants | `src/codegen/templates/{base-mfe,base-mfe-angular,features,docker,api,kubernetes}/` |
| Framework/bundler resolution | `src/framework/loader.ts`, `packages/contracts/src/framework-plugin.ts` |
| Governing decisions | ADR-009 (language→template), ADR-034 (pluggable bundler/framework), ADR-036 (framework plugins), ADR-040 (handler sources), ADR-043 (manifest-driven pipeline) |

---

## 1. What codegen does

The DSL manifest (`mfe-manifest.yaml`) is the single source of truth. Codegen reads it and
emits a runnable MFE: feature stubs, the platform `BaseMFE` subclass, the remote entry,
the BFF artifacts, and build/config files. **You generate; you don't hand-write the
platform layer** (PDR-001). Re-running codegen is safe by design (see §4).

```
mfe-manifest.yaml ──▶ validateManifestConfiguration() ──▶ extractManifestVars()
                                                               │
                                       ┌───────────────────────┴───────────────┐
                                       ▼                                        ▼
                              loadFrameworkPlugin()                    aggregate capabilities
                              (variant: react-rspack |                 + lifecycle hooks
                               angular-webpack)                        + handler sources
                                       │                                        │
                                       └───────────────┬────────────────────────┘
                                                       ▼
                                            generateAllFiles()
                                                       │
                  ┌───────────────┬────────────────────┼───────────────┬───────────────┐
                  ▼               ▼                     ▼               ▼               ▼
            feature stubs   remote entry          platform/base-mfe  platform/bff   build/config
            (overwrite:     (overwrite: true)     (overwrite: true)  (.meshrc,      (rspack/webpack,
             false)                                                   server.ts)     Dockerfile)
                                                       │
                                                       ▼
                                            writeGeneratedFiles()
                                            (honors ownership markers)
```

## 2. The pipeline, step by step

All of the following are in `unified-generator.ts`:

1. **Validate** — `validateManifestConfiguration(manifest)` (`generateAllFiles`,
   `:681`) throws before any file is written if plugin/transform config is malformed
   (ADR-027). Bad input never produces a half-generated project.
2. **Extract template vars** — `extractManifestVars()` (`:420`) flattens the manifest into
   the variable bag every EJS template consumes (remotes, BFF endpoint, plugin/transform
   config, dependency versions).
3. **Resolve the framework variant** — `framework` + `bundler` manifest fields select the
   plugin via `loadFrameworkPlugin()`. The variant id (`react-rspack` | `angular-webpack`,
   `:497`) picks the template directory and per-file extensions. **Omitting both fields ⇒
   React + rspack** for back-compat with every existing MFE (`:776–778`).
4. **Aggregate the contract** — `generateAllFiles()` (`:673`) walks
   `manifest.capabilities`, separating the 9 platform capabilities (`load`, `render`,
   `refresh`, `authorizeAccess`, `health`, `describe`, `schema`, `query`, `emit`,
   `:686–696`) from domain capabilities, and collects lifecycle hooks across the
   `before → main → after → error` phases (`:740–765`), deduplicating by name.
5. **Route handler sources (ADR-040)** — hooks that declare a `source` are parsed by
   `parseHandlerSource()` and pushed to `handlerSources` (`:752–756`) so they are wired
   through the generated `handler-registry.ts` instead of emitted as empty stubs.
6. **Render** — `renderTemplate()` (`:546–551`) runs each EJS template with the variable
   bag.
7. **Write** — `writeGeneratedFiles()` (`:594`) writes to disk, honoring ownership markers
   (§4).

## 3. Template variants and the framework boundary

Adding a framework is a **new template variant + plugin**, never a new lifecycle (ADR-034,
ADR-036). Core owns the abstract shape (`BaseFrameworkPlugin`); the plugin owns the *how*
(bundler, templates, build commands). The generator only knows the variant id and asks the
plugin to resolve specifics. See the
[Framework Plugin Cookbook](./platform-design-review/framework-plugin-cookbook.md) for
authoring recipes.

Template directories (`src/codegen/templates/`):

| Dir | Purpose |
| --- | --- |
| `base-mfe/` | React/rspack platform + remote templates |
| `base-mfe-angular/` | Angular/webpack platform + remote templates |
| `features/` | Per-capability feature stubs (`.tsx` / `.component.ts`) |
| `docker/` | Production Dockerfiles (ADR-044 hardening) |
| `api/` | REST API scaffolds (see [API Generator](./architecture-api-generator.md)) |
| `kubernetes/` | Deployment manifests |

The BFF artifacts (`.meshrc.yaml`, `server.ts`, `bff.ts`) come from
`packages/bff-plugin/templates/` (`:793` resolves `bffTemplateDir`); see
[BFF Architecture](./architecture-bff.md).

## 4. Regeneration safety — the ownership-marker contract

Every generated file carries an `overwrite` flag (`GeneratedFile.overwrite`, `:14–16`).
`writeGeneratedFiles()` enforces it (`:602–613`):

- **`overwrite: false` ⇒ developer-owned.** Feature stubs are written once and then never
  touched again — not even with `--force`. User implementations survive every re-run.
- **`overwrite: true` ⇒ generated.** Platform base class, remote entry, and configs are
  re-stamped on regeneration (skipped if unchanged unless `--force`).

`capabilityImplemented()` (`:569`) adds a second guard: a capability's feature stub is only
scaffolded when its file does not already export an implementation, so generating a new
capability never clobbers an existing one. This is what makes "edit the manifest, re-run
codegen" a safe, idempotent loop.

> **Generated vs developer-owned layout** (G21): files under `src/features/**` are
> developer-owned (`overwrite:false`); `src/platform/**`, the remote entry, and build
> configs are generated (`overwrite:true`). Never edit generated files by hand — change the
> manifest and regenerate.

## Related

- [DSL Architecture](./architecture-dsl.md) — the input contract.
- [BFF Architecture](./architecture-bff.md) — BFF artifacts emitted here.
- [Framework Plugin Cookbook](./platform-design-review/framework-plugin-cookbook.md)
- [Architecture: current state](./architecture-current-state.md)
</content>
