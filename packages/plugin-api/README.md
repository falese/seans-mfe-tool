# `@seans-mfe/plugin-api`

Generates a REST API backend — Express plus MongoDB or SQLite — from an OpenAPI
specification.

## Why this is a plugin

ADR-063: API-backend generation is a **plugin axis**, not part of the platform
core. The platform's job is domain-capability MFEs; turning a spec into a REST
backend is a different product that happens to be useful next to one. Keeping it
here means the core stays about the thing it claims to be about, and this can
evolve — or be replaced by a different generator — without touching it.

## Use

```bash
seans-mfe-tool api my-service --spec ./openapi.yaml --database sqlite
seans-mfe-tool api my-service --spec ./openapi.yaml --dry-run --json
```

`--dry-run` reports what it would create without writing; under `--json` the
result is one `CommandResult<ApiResult>` line on stdout, like every other
command (ADR-018).

## Layout

| Path | What |
|---|---|
| `src/commands/api.ts` | The oclif command — flags, validation, orchestration |
| `src/APIGenerator/` | The generators: controllers, routes, database layer |
| `templates/api/` | Static scaffold, split `base/` + `sqlite/` + `mongodb/` |
| `src/types.ts` | `ApiResult`, re-exported by the CLI's `src/oclif/results.ts` |

Templates live at the package root rather than under `src/`, so `tsc` never
compiles them — they used to sit under `src/codegen/templates` and accumulate
`.d.ts` and `.map` byproducts that then shipped into generated projects.
