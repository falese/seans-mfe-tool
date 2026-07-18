# Meridian Station — SMT Developer-Experience Field Report

This report was written **live** while building the Meridian Station reference
app with the real SMT toolchain (CLI + MCP). Every entry records: the command
issued, what we expected, what actually happened, and a friction/delight call.
It closes with a punch list of tool issues worth filing.

Method note: part of the fleet is generated through the raw CLI and part
through the MCP server (`mcp:serve`), deliberately, so the two entry points
can be compared under identical work.

Legend: 😍 delight · 👍 fine · 😕 friction · 🐛 bug

---

## Phase 0 — Spikes (throwaway, in scratchpad)

### 0.1 Cold start: clone → usable CLI

> `npm ci && npm run build`

Expected a monorepo bootstrap dance; got a clean two-command path to a working
`bin/run.js`, and `build` finishes by regenerating the JSON schema catalog —
`git status` stayed clean afterwards, so schema generation is deterministic. 😍

### 0.2 `api` — generate a REST API from an OpenAPI spec (sqlite)

> `bin/run.js api spike-harbormaster --spec ./specs/harbormaster-draft.yaml --database sqlite --port 5101`

Scaffold is rich (Express, Sequelize models per schema, JWT middleware,
winston, request-id, /api-docs) and `npm install` runs for you. 👍
`--port 5101` correctly lands in `.env`. 👍

Then we tried to run it.

- 🐛 **The generated API does not boot.** `src/index.js` calls
  `database.connect()`; the sqlite database module exports
  `connectDatabase()/disconnectDatabase()`. `TypeError` on startup, every time,
  both sqlite and mongodb variants.
- 🐛 **Route files import handler names derived from `operationId`**
  (`list_berths` → `listBerths`) **but controllers export path-derived names**
  (`getAllBerths`). Express crashes with `Route.get() requires a callback
  function but got a [object Undefined]`. Any spec whose operationIds don't
  coincide with the path-derived convention is dead on arrival — the bundled
  petstore example appears to work only by naming coincidence.
- 🐛 **`routes/index.js` mounts every router at the empty path**
  (`router.use('', …)`) instead of `/berths`, `/dockings`. Result:
  `GET /api/berths` matched `/:berth_id` with `berth_id="berths"` and 404'd.
- 🐛 **Get-by-id handlers ignore the declared path parameter**:
  `const { berth_id } = req.params;` immediately followed by
  `db.Berth.findByPk(req.params.id)`. Any param not literally named `id`
  returns 404 for every row.
- 🐛 **List handlers pass the whole query string into the WHERE clause**
  (`where: req.query`) while also reading `limit`/`offset` from it, so
  `?limit=2&offset=1` explodes with `SQLITE_ERROR: no such column:
  Berth.limit`.
- 🐛 **`npm run db:seed` fails out of the box**: `.sequelizerc` points
  sequelize-cli at `src/database/seeders/`, but the generator writes
  `src/database/seeds/`. There are actually *three* seed mechanisms in the
  scaffold — sequelize-cli (broken path), `src/database/seed.js` (an empty
  stub), and `src/database/seeds/index.js` (a real bulkCreate runner with
  data derived from the spec's `example:` values). Only the third one works,
  and nothing calls it.
- 😕 Seed data derivation multiplies numeric examples per row
  (`occupied_flag: 0.8, 0.9, 1.1…` on an `integer` field; `docking_id:
  3618.9`) and string-suffixes keys (`"b1 3"`). It boots demos, but the rows
  violate the spec's own types — GraphQL later rejects them (see 0.3).
- 😕 Cosmetic: TS build artifacts (`jest-config.d.ts`, `.d.ts.map`) ship in
  the generated JS project; Sequelize serializes `createdAt`/`updatedAt` in
  camelCase into an otherwise snake_case payload.

With four small hand-patches the API ran beautifully: bare snake_case arrays,
filtering, pagination — exactly the "legacy port authority" personality the
spec described. The bugs above are all template-level and fixed in this PR
(see punch list).

### 0.3 `remote:init` + `remote:generate` — React MFE with a BFF `data:` section

> `remote:init spike-bff-mfe --framework react --port 5111 --skip-install`
> …edit manifest (capability + `data:` with one OpenAPI source)…
> `remote:generate`

The two-step manifest-first flow is genuinely pleasant: 27 files, and the
generated `.meshrc.yaml` is *annotated* — it explains the mock-switch, the
response-cache condition, and cites the ADRs it implements. Reading generated
config that teaches you the architecture is a rare treat. 😍

- 🐛/😕 `npm install` fails on a fresh machine: the generated package.json
  depends on `@seans-mfe-tool/runtime@^0.1.0` (in devDependencies), which is
  not published (known deferral, ADR-064 / #252). The docker path stages
  `dist/runtime` into node_modules, but a host-side consumer hits a hard E404
  with no hint of the workaround.
- 👍 Workaround (same as the example Dockerfiles): install without the dep,
  then `cp -r <repo>/dist/runtime node_modules/@seans-mfe-tool/runtime`.

**The headline result:** `npx mesh build` + `ts-node server.ts` against the
live spike API worked first try. The generated schema shows the whole pitch
in one diff — upstream `berth_id`, `berth_class` (snake_case) surface as
`berthId`, `berthClass` in GraphQL via the always-on `namingConvention`
transform. A live query returned real rows from the generated API, filters
passed through, and `x-bff-mode: mock` served fixtures without touching the
upstream. Mesh resolved the upstream base URL from the spec's `servers:`
entry, which means compose service names Just Work with **zero** extra
config. 😍

Bonus: GraphQL's type layer immediately caught the generator's own bad seed
data (`Int cannot represent non-integer value: 0.8`) — an accidental but
compelling demo of why you put a typed BFF in front of teams you don't
control.

### 0.4 `remote:init --framework angular` + `remote:generate`

- 🐛 **A freshly generated Angular MFE does not compile.**
  `tsconfig.app.json` contains a `"//": "…comment…"` key **inside
  `compilerOptions`**, and Angular's strict tsconfig parser rejects it:
  `error TS5023: Unknown compiler option '//'`. One-line template fix
  (`packages/codegen/templates/base-mfe-angular/tsconfig.app.json.ejs`);
  after that, `ng build --configuration production` produced clean Module
  Federation output in ~21s. The abc-kids Angular MFE predates this template,
  which is why the bug survived.
- 😕 Generated npm scripts invoke the bare `seans-mfe-tool` binary, which only
  exists on PATH inside the docker images. Host-side, `npm run build` dies at
  the first token. `npx`-style or a documented global-install prerequisite
  would fix it.

### 0.5 `mcp:serve` — MCP smoke test

- 😕 `bin/run.js mcp serve` (space form) prints the topic help and exits 0 —
  it looks like the server hung. Only the colon form `mcp:serve` starts it.
  Every other topic command accepts spaces.
- 👍 Handshake + `tools/list` clean: 10 tools (`mfe:api`, `mfe:remote:init`,
  `mfe:remote:generate`, `mfe:bff:*`, `mfe:deploy`, `mfe:manifest.schema`).
- 😕 **No way to target a directory.** The server spawns each child CLI with
  the server's own cwd and tools accept no `cwd`-like argument. An MCP client
  that starts one server instance can only ever scaffold into one directory.
  Workable for scripted use (start the server per target dir); a real
  limitation for a long-lived agent connection.

### Phase 0 verdict

The architecture held: manifest-driven generation, the BFF pipeline, and the
runtime staging pattern all did what the docs promised, and the critical
unknown (Mesh resolving live upstreams from spec `servers:`) resolved with no
tool changes. But **no generated API could boot and no generated Angular MFE
could compile** until template bugs were fixed — strong evidence the examples
had only ever exercised the happy petstore path. Dogfooding works.

---

*(Journal continues per phase below as the build proceeds.)*

## Punch list (running)

Template/CLI bugs found so far. Items 1–6 and 8 are **fixed in this PR**
(1–6 filed as #275; 8 belongs to the template family tracked by #274, with
regression tests in `src/codegen/APIGenerator/__tests__/generated-api-regressions.test.js`):

1. ✅ API `src/index.js` calls `database.connect()`; sqlite DB module exports `connectDatabase()` — API never boots. → sqlite module now exports `connect`/`disconnect` aliases.
2. ✅ API route files import operationId-derived handler names; controllers export path-derived names — Express crash at mount. → one shared naming function, operationId preferred.
3. ✅ API `routes/index.js` mounts all routers at `''` — resource paths resolve to the wrong handlers. → mounted at the original (spec-faithful) resource segment.
4. ✅ API by-id controllers call `findByPk(req.params.id)` regardless of the declared path param name. → lookups on the declared param; `findByPk`/`findById` reserved for params literally named `id`/`_id`.
5. ✅ API list controllers pass `limit`/`offset` into the `where` clause — SQL error on any paginated request. → filters restricted to real model attributes (`rawAttributes`/`schema.paths`).
6. ✅ API `npm run db:seed` points sequelize-cli at `seeders/`; generator writes `seeds/`; two other seed stubs disconnected. → unified `seed.js` connects and runs the generated `./seeds` set; `db:seed` wired to it for both databases.
7. ⏳ Generated MFE devDependencies pin unpublished `@seans-mfe-tool/runtime` — host-side `npm install` fails with no workaround hint (known deferral, ADR-064 / #252; generated README should mention the staging workaround).
8. ✅ Angular template `tsconfig.app.json.ejs` puts a `"//"` comment key inside `compilerOptions` — every fresh Angular MFE fails to compile (TS5023). → JSONC line comment instead (Refs #274).
9. ⏳ Seed derivation from spec examples produces type-violating rows (floats in `integer` fields, suffixed strings in keys) — GraphQL rejects them at the BFF. Meridian replaces the derived seeds with hand-written fixtures; generator-side fix not attempted here.
10. ⏳ `mcp serve` space form silently shows help and exits 0; only `mcp:serve` starts the server.
11. ⏳ MCP tool calls cannot target a working directory (children inherit server cwd) — one server instance can only ever scaffold into one directory.
12. ⏳ Cosmetic: TS build artifacts (`.d.ts`, `.d.ts.map`, compiled jest config) emitted into generated JS API projects.
