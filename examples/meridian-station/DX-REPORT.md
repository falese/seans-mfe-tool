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

## Phase 1 — Specs, APIs, seeds

### 1.1 Three specs, three personalities

Authoring the messy specs surfaced two generator contracts you only learn by
reading generator source (they belong in the docs):

- Models are generated from **every** `components.schemas` entry, while
  controllers derive the model from the path's first segment. So each
  resource path needs a matching singular snake_case schema
  (`/manifest_lines` ↔ `manifest_line`) — and envelope wrapper shapes must
  live **inline in responses**, or they'd become junk models. 😕 (docs gap)
- The generated Joi query validator rejects unknown keys, so an API's own
  middleware can't inject translated pagination params before validation.
  Meridian's exotic pagination (cursor, Page/PageSize) is therefore
  *accepted but ignored* — which, honestly, is the most realistic thing in
  the whole example. Documented as flavor; filed as a fidelity gap. 😕

### 1.2 `api` ×3 against the real specs

All three generated cleanly — 7 models for StationOS, mongoose docs for the
ledger, routes mounted at spec-faithful paths. The Phase 0 fixes held on
specs 5× the size of the spike. 😍

Then the mongodb variant found two more mines:

- 🐛 **Any mongo API with a valid `MONGODB_URI` hangs on boot forever.**
  `connect()` awaited `mongoose.connection.once('connected')` *after*
  `mongoose.connect()` had already resolved — an event that fired before
  the listener attached. The only reason this was never noticed: with no
  reachable URI the code falls into the memory-server branch, which lacks
  the wait. The variant literally never worked against a real MongoDB.
  Fixed in template (+ idempotency guard for repeat connects).
- 🐛 **`SEED_DATA=true` tears down the server's own DB connection**: the
  in-process path ran standalone `seed.js`, whose contract is
  connect→seed→disconnect. First request after boot: `MongoNotConnectedError`.
  Fixed: the in-process path now runs `./database/seeds` directly on the
  already-open connection.

### 1.3 One dataset, three dialects

`seed/station.json` is the single source of truth; `scripts/derive-seeds.mjs`
(~180 lines, half of it the three projections) writes each API's
`*.seed.js` in that API's native convention. Reading the projection
functions side by side is the entire "why BFFs exist" argument in one file:
`docking: 4021` → `docking_id: 4021` / `dockingRef: "DCK-004021"` /
`DockingNo: 4021`. 😍 (of the didactic kind)

Verified live, all three envelope styles at once:

```text
GET :5101/api/berths?occupied_flag=1   → [ {"berth_id":"b1",...} ]   + X-Total-Count: 6
GET :5102/api/charges?dockingRef=DCK-004021
                                       → {"result":[...amountCents...],"meta":{"cursor":null,"hasMore":false}}
GET :5103/api/telemetry?ModuleId=6     → {"Data":[...{"AlertLevel":"CRITICAL"}...],"Pagination":{...}}
```

The envelope layer is one ~20-line hand-written middleware per API — the
"API team's framework layer" — plus one `app.use` line in the generated
`src/index.js`. Everything else is generator output.

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
13. ✅ mongodb variant hangs on boot with any valid `MONGODB_URI` (post-connect wait for an already-fired `'connected'` event); connect() also not idempotent. → wait removed, readyState guard added (Refs #275).
14. ✅ `SEED_DATA=true` disconnects the server's own DB connection (in-process path ran standalone seed.js). → index.js template now runs `./database/seeds` directly (Refs #275).
15. ⏳ Docs gap: the schema↔model mapping rules (every components.schemas entry becomes a model; controller model = path's first segment singularized) are only discoverable from generator source.
16. ⏳ Generated query validator rejects unknown keys, so generated APIs can't honor pagination conventions other than limit/offset (cursor, Page/PageSize are accepted but ignored).
