# ADR-063 — API-backend generation is a plugin axis, not a wrapper around one OSS codegen

- **Status:** Accepted (implementation deferred)
- **Date:** 2026-07-01
- **Tracking issue:** #251
- **Relates to:** ADR-036 (framework plugins / `loadFrameworkPlugin`), ADR-022 (plugin-first architecture), ADR-061 (`@seans-mfe/dsl` + `@seans-mfe/codegen` packaging; byte-identical characterization harness), ADR-062 (the same "return as a plugin axis" move applied to deploy), PDR-001 (generate, don't hand-write), PDR-004 (plugin-first ecosystem)

## Context

The `api` command turns an OpenAPI spec into a complete Express + ORM CRUD API via
a bespoke ~2,144-LOC generator (`src/codegen/APIGenerator/`:
`ControllerGenerator`, `DatabaseGenerator`, `RouteGenerator`, `utils`). It emits
**fully ORM-wired CRUD** — e.g. `Model.User.findById(req.params.id)`,
`.find(req.query).limit(...)`, and create/update/delete queries against **both**
Mongoose and Sequelize/SQLite — plus the models, migrations, and seed data, behind
a `DatabaseAdapter` strategy.

We asked whether this could become a thin plugin wrapper around an open-source
OpenAPI code generator. It cannot, cleanly, and the reason is instructive:

| Layer | Bespoke LOC | Covered by OpenAPI Generator (`nodejs-express-server`)? |
| --- | --- | --- |
| Routes from paths | ~250 | ✅ yes |
| Request/schema validation | ~160 | ✅ mostly |
| Controllers wired to the ORM (CRUD bodies) | ~380 | ❌ empty service stubs only |
| Mongoose + Sequelize models, migrations, seeds | ~1,044 | ❌ not generated |

The mainstream OSS tool covers our *small* end (routing + validation) and stops
exactly where our bulk is (the DB-wired CRUD layer, ~1,400 LOC). It also brings a
JVM/JAR toolchain and produces a different output *shape* (stubs you fill in, not a
turnkey CRUD API). So replacing the generator with an OSS wrapper would be a
**feature downgrade** (lose turnkey DB CRUD) or require a substantial mapping layer
to graft our DB models back onto its stubs — trading owned, tested code for an
opaque toolchain plus glue. That is a net loss, and doubly so for a reduction
effort, since it would not shrink the tree without removing capability.

## Decision

**API-backend generation becomes a plugin axis, mirroring the framework-plugin
model (ADR-036) — not a wrapper around a single OSS tool.**

1. **The existing generator becomes the built-in default plugin,
   `@seans-mfe/api-express`.** It is already cleanly modularized (a
   `DatabaseAdapter` strategy over Mongo/SQLite), so it is structurally ready to
   be promoted behind an `ApiBackendPlugin` contract.
2. **OSS tools become optional alternative plugins** (e.g.
   `@seans-mfe/api-openapi-generator`) for users who want stubs, other languages,
   or other frameworks — the cases where an OSS generator genuinely beats a
   bespoke JS one. OSS is *optionality*, not a forced replacement.
3. **Backend selection is manifest config** (`api: { backend, database }`),
   resolved by `loadApiBackendPlugin(name)` (sibling of `loadFrameworkPlugin`).
   The command stays thin and backend-agnostic.

This is the "marketplace of adaptor packs" thesis (ADR-022 / PDR-004) applied to
the API axis, and the same shape as ADR-062's deploy-target axis.

## Status / scope

**This is a direction, not built here.** It adds capability (optionality); it does
not reduce LOC, so it is out of scope for the RESTRUCTURE reduction campaign and is
tracked separately in **#251**. The implementation must keep the default `api`
output **byte-identical** (characterization harness per ADR-061) and preserve the
`--json` `CommandResult<ApiResult>` envelope and typed errors. See #251 for the
task breakdown and acceptance criteria.

## Alternatives considered

- **Wrap OpenAPI Generator and delete the bespoke generator.** Rejected — loses the
  turnkey Mongoose/Sequelize CRUD layer no OSS tool provides, and adds a JVM
  toolchain. Feature downgrade, not a cleanup.
- **Shift generated projects to runtime spec-validation** (`express-openapi-validator`)
  instead of codegen. Rejected here — it would shrink both generator and output,
  but it contradicts PDR-001 ("generate, don't hand-write") and is a separate
  product decision, not an architecture cleanup.
- **Leave `api` as a hardcoded, single-backend generator.** Rejected as the
  long-term shape — it forecloses the OSS/other-language backends that the plugin
  axis unlocks, and it is the same anti-pattern ADR-062 removed from deploy.
