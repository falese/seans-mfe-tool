# API Generator Architecture

**Status:** Informative reference for the OpenAPI-driven REST API generator. Closes
documentation gap **G04**.

**Authoritative sources:**

| Concept | Source |
| --- | --- |
| Command | `src/commands/api.ts` (`Api extends BaseCommand`, `:714`) |
| Database generator | `src/codegen/APIGenerator/DatabaseGenerator/` |
| Controller generator | `src/codegen/APIGenerator/ControllerGenerator/` |
| Route generator | `src/codegen/APIGenerator/RouteGenerator/` |
| Templates | `src/codegen/templates/api/`, `src/codegen/templates/docker/{Dockerfile.production.api,dockerfile.nodeAPI}` |

> This generator is distinct from the MFE codegen pipeline
> ([Code Generation Architecture](./architecture-codegen.md)): it consumes an **OpenAPI
> spec** (not a DSL manifest) and emits a standalone Express REST service.

---

## 1. What it does

`seans-mfe-tool api` takes an OpenAPI (Swagger) spec and a target database and scaffolds a
runnable Express API — routes, controllers, models, middleware, utilities, and database
wiring.

```
OpenAPI spec ──▶ loadOASSpec() ──▶ SwaggerParser.dereference()
 (path or URL)    (api.ts:46)            (api.ts:563)
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                 DatabaseGenerator   ControllerGenerator    generateRoutes
                  .generate()          .generate()          (RouteGenerator)
                  (api.ts:596)         (api.ts:597)          (api.ts:598)
                          └───────────────────┼───────────────────┘
                                              ▼
                              processTemplates() + generateDatabaseInit()
                              (package.json, config, src/database)
```

## 2. Inputs and validation

- **`spec`** — path or `http(s)` URL. `loadOASSpec()` (`api.ts:46–58`) parses via
  `SwaggerParser`; a fetch failure raises `NetworkError`, a parse failure `SystemError`
  (see exit codes in the [CLI Contract](./cli-contract.md)).
- **`database`** — validated against the supported set; an unsupported value throws a
  usage error listing valid options (`api.ts:41`).
- **`port`** — `validatePort()` (`api.ts:61–67`) requires an integer in `1..65535`, else
  `ValidationError` (exit 64).

## 3. Generation steps (`api.ts:560–617`)

1. Parse + **dereference** the spec so all `$ref`s are inlined (`:563`).
2. Copy the base template into the target dir, then overlay the database-specific template
   (`codegen/templates/api/<db>/`) if present (`:567–572`).
3. Ensure the standard directory layout: `routes`, `controllers`, `models`, `middleware`,
   `utils`, `database`, `config` (`:574–585`).
4. Emit hardened middleware (`ensureMiddleware`, `:69`): JWT `auth.js` (algorithm pinned to
   `HS256` to prevent alg-confusion / `alg:none` attacks, `:87`), schema `validator.js`,
   structured `error-handler.js`, and `request-id.js`.
5. Emit utilities (`ensureUtils`, `:173`) including a Winston structured logger.
6. Run the three generators **in parallel** (`Promise.all`, `:595–599`):
   `DatabaseGenerator` (models + connection), `ControllerGenerator` (handlers per
   operation), `generateRoutes` (Express routers from spec paths).
7. `processTemplates()` (`:609`) stamps `package.json`, config, and the chosen port;
   `generateDatabaseInit()` (`:617`) writes DB bootstrap.

## 4. Database paths

The generator supports a SQLite path and a MongoDB path (under
`DatabaseGenerator/generators/`), selected by the `database` flag; the matching
`codegen/templates/api/<db>/` overlay supplies driver-specific files. The controller layer
uses adapters (`ControllerGenerator/adapters/`) so handler code stays database-agnostic.

## 5. Output

A self-contained Express project (`<name>/src/`, `<name>/package.json`, `:639`) with auth,
validation, error handling, request IDs, logging, and a production Dockerfile
(`templates/docker/Dockerfile.production.api`, ADR-044 hardening). The command returns an
`ApiResult` envelope under `--json` like every other command.

## Related

- [Code Generation Architecture](./architecture-codegen.md) — the MFE codegen pipeline (separate path).
- [CLI Contract](./cli-contract.md) — result envelope and exit codes.
</content>
