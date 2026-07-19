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

## Phase 2 — Control plane, shell, console

### 2.1 Vendoring the control plane

Zero patches needed: the registry honors `PORT`, the daemon honors
`DAEMON_PORT`/`REGISTRY_HOST`/`REGISTRY_PORT`. Copy, set env (4500/4504),
done. 😍

### 2.2 The shell (hand-written — no generator exists)

Copied from abc-kids and adapted in ~15 line-level edits. Notes:

- 😕 abc-kids' shell package.json still points `@seans-mfe-tool/runtime` at
  `file:../../../src/runtime` — a directory that no longer exists after the
  `packages/runtime` promotion (#240). It only works in docker, where the
  Dockerfile rewrites the dep to the staged `dist/runtime`. Meridian points
  at `file:../../../dist/runtime` directly (build the repo first).
- 😍 The Meridian shell declares **zero** static remotes
  (`remotes: {}`) — abc-kids still hardcodes three. Every MFE arrives via
  control-plane module-federation payloads; the shell is finally 100%
  generic, and it works.
- 😕 A `/shell:init` generator (issue #144) would have made this whole
  section unnecessary.

### 2.3 The console (`remote:init` + manifest + `remote:generate`)

- 😍 The keyed slot pattern `berth.{id}` went from one manifest line to a
  generated `slots.tsx` entry with the pattern intact, and
  `slotContract.register(provideSlot, 'berth.b1', el)` matched it at
  runtime with no extra code. The grammar (ADR-069) does what it says.
- 😍 `capabilityImplemented()` honored our StationConsole implementation on
  regen — feature code written once stays written.
- 🐛 `npx tsc --noEmit` on a freshly generated MFE fails: the generated
  `bootstrap.ts` passes a partial `Context` to `updateControlPlaneState`
  (missing `requestId`/`timestamp`) and `remote.tsx` imports with a `.tsx`
  extension without `allowImportingTsExtensions`. The bundle builds anyway
  (swc doesn't type-check) and jest passes (isolated modules) — so the
  generated project ships latent type errors that only bite when someone
  adds a real typecheck step. Punch list.

### 2.4 The loop, end to end

Registry + daemon up locally, console registered via
`scripts/register-station.sh`, `scripts/console.sh` fires `meridian.root`:

```text
DAE-220 ACTION_RECEIVED    | actionId=meridian-root-…
DAE-250 RESOLUTION_RECEIVED| mfe=meridian-console capability=StationConsole
DAE-253 EXPERIENCE_RELAYED | mfe=meridian-console clientSide=true
```

Verified in a real browser (Playwright + the shell at :5000): console menu
with all five domains, six keyed berth slots, and the main/status regions
— composed entirely by the control plane into an empty shell. Total shell
knowledge of Meridian domains: zero lines. 😍

## Phase 3 — docking-control: the vertical slice that earned its keep

The hardest slice first: an Angular MFE with a two-source BFF (Harbormaster +
StellarLedger), composers-free envelope normalization, and the keyed berth
strip. This phase found and fixed **one codegen defect and three runtime
defects** — the single most productive dogfooding session of the build.

### 3.1 The BFF pipeline earns the "hero" title

- 😍 Source-level `hoistField` transforms flow from the manifest straight
  into `.meshrc.yaml`: the ledger's `{result, meta}` envelopes are unwrapped
  AT THE GRAPH — `charges: [Charge]` and `valuations: [Valuation]` appear as
  clean root fields beside the raw `listCharges: ListCharges_200Response`
  originals. One schema shows the before and after of the whole pitch.
- 😍 One GraphQL query returns live berths (snake_case → camelCase) joined
  with live charges and valuations (envelope → list) from two different
  databases. The only feature-level glue is the docking-ref format helper —
  the documented `additionalResolvers` gap.
- 🐛 **The generated BFF client dialed a relative `/graphql`** — which
  resolves against the SHELL's origin the moment the MFE composes remotely.
  The user's design instinct was right: the MFE + BFF are a **single
  deployable unit** on the manifest's `endpoint` origin, so codegen now
  bakes `manifest.endpoint + data.serve.endpoint` into the connector, and
  `mfe.query()` (the platform capability) picks it up with zero extra
  wiring. Manifest in, capability out. Filed + fixed as #278.

### 3.2 The keyed-slot fan-out: three runtime bugs in one afternoon

The console fires six `meridian.berth.<id>` actions; the registry resolves
six `BerthTile` experiences of the same Angular MFE into six keyed slots.
Nothing in the platform had ever mounted N instances of one remote at once:

- 🐛 **Mount race:** concurrent renders through the shared MFE singleton hit
  the ADR-042 lifecycle gate — `Invalid state: expected ready, got
  rendering`; one tile survived, one slot showed the fallback. The ADR-066
  per-address queues can't help (each keyed slot IS its own address), so the
  module-federation adaptor now serializes mounts per remote scope.
- 🐛 **Selector collapse:** `bootstrapApplication` binds to the FIRST
  matching selector in the document — all six tiles bootstrapped onto slot
  one's element, last-writer-wins props (a tile labeled b6 showing b1's
  data). Replaced with `createApplication` +
  `ApplicationRef.bootstrap(Component, hostElement)`.
- 🐛 **Frozen change detection:** manual bootstrap runs outside any NgZone,
  so fetch continuations never triggered CD — six perfectly mounted tiles
  rendering their initial state forever. Bootstrap and prop application now
  run inside the app's own `zone.run`.
- Props are now applied via `ComponentRef.setInput` (fires `ngOnChanges`)
  instead of post-CD field assignment that `ngOnInit` never saw.

All filed + fixed as #277, with regression tests. Feature-side lesson worth
keeping: an input-driven component should load in `ngOnChanges` with a
stale-response guard — the `ngOnInit` default fetch WILL race the
registry-injected prop.

### 3.3 The payoff

`meridian.open.docking` fires **two** registry rules from one click —
DockingBoard into `meridian-console/main`, TrafficLog into
`meridian-console/status` — while six independent control-plane round trips
fill the berth strip. Verified in the browser: 6/6 tiles with correct
per-berth data (b4/b6 free, no phantom dues), the two-source join showing
₢ 8,500.00 DISPUTED on b1. Zero shell knowledge of any of it. 😍

## Phase 4 — the remaining domains, and the CLI-vs-MCP comparison

### 4.1 CLI lane (life-support, cargo-ops)

By the third and fourth Angular MFEs the recipe is muscle memory:
`remote:init` → manifest → `remote:generate` → implement features → build.
Each MFE took roughly a quarter of the time docking-control did — the
platform's leverage is real once the sharp edges are off.

- 😍 `hoistField` scaled to every envelope in the fleet: StationOS's
  `{Data, Pagination}` unwraps exactly like the ledger's `{result, meta}`.
  One gotcha worth documenting: pathConfig uses **source-level** names
  (`[GetTelemetry, Data]`, PascalCase intact) because namingConvention is a
  root-level transform that runs after source transforms.
- 😍 The cargo manifest — the flagship view — renders the split document
  with the DCK-004027/2 valuation gap shown as *"valuation pending —
  finance"*. The gap in the data became a feature of the demo.

### 4.2 MCP lane (crew-services, concourse)

Scaffolded entirely through `mcp:serve` tool calls
(`scripts/mcp-call.mjs`, a ~70-line stdio client):

- 😍 The tool-call envelope is genuinely good: a structured JSON result
  (name, port, targetDir, generatedFiles) with the human-readable CLI
  narration separated into a `[stderr]` content block. An agent gets
  machine-readable state AND the guidance text without parsing prose.
- 😕 The cwd limitation (punch list #11) shapes the whole integration: one
  server per target directory, spawned per call. Workable for scripted
  drives; awkward for a long-lived agent connection, which would have to
  restart its server to work on a second MFE.
- 👍 Verdict: same generator, same outputs, byte-for-byte — the difference
  is purely ergonomic. CLI wins for humans (colors, next-steps text); MCP
  wins for agents (typed results, no prose parsing) once cwd targeting
  lands.

## Phase 5 — fleet orchestration

- 😍 `remote:generate` emits per-MFE Dockerfiles for BFF MFEs — the SSOT
  extends all the way to the container recipe. Meridian keeps hand-tuned
  Dockerfiles (cloned from the battle-tested abc-kids set) because the
  generated template still needs the #268–#273 fix family; once those land,
  `--force` regeneration should own these files too (#274's endgame).
- 👍 `scripts/generate.mjs` is the anti-`generate-games.mjs`: a ~70-line
  driver that only shells out to the real CLI, plus `--check` as the CI
  invariant (regenerate → `git status` must stay clean). It holds.
- 👍 Six-test Playwright smoke suite drives the exact demo path (compose
  console → open all five domains → assert live cross-source data) — all
  green against the running stack. `CHROMIUM_PATH` env override supports
  sandboxes with a preinstalled browser.
- 😕 Docker image builds are authored from the proven abc-kids patterns but
  could not be executed in this environment (no docker daemon) — the
  compose topology is validated by structure and by the identical local
  stack (`scripts/dev-up.sh`), and the runbook flags image builds as the
  one step verified only by pattern.

## Closing verdict

**The platform delivered its pitch.** Manifest in — capability out: three
hostile API dialects became one typed graph per MFE with zero hand-written
normalization code beyond six tiny id-format helpers; a shell with zero
static remotes composed six MFEs across two frameworks, including a keyed
six-way fan-out of a single Angular remote; and the whole fleet was produced
by the real CLI (a third of it through MCP), with `generate.mjs --check`
holding the regen invariant.

**And the dogfooding paid its rent.** Eleven fixed defects shipped alongside
the example — six in the API generator (#275), the mongodb boot hang, the
SEED_DATA connection teardown, the BFF endpoint derivation (#278), and the
multi-instance composition trio in the runtime (#277) — every one found by
building the thing the platform says it's for. The punch list below carries
what remains.

The single highest-leverage next fixes, by this build's experience:
1. Publish the runtime (ADR-064/#252) — the `dist/runtime` staging pattern
   caused every one of this build's environment-specific detours.
2. `--force`-clean regeneration incl. the Dockerfile template (#274 with the
   #268–273 family) — until then, generated-then-hand-tuned files drift.
3. MCP cwd targeting (punch list #11) — one server per directory is the only
   thing keeping the MCP path from being the best agent interface here.

## Punch list (running)

Template/CLI bugs found while building the station. Final score: **18 of 22
fixed in this PR** (✅), one resolved as by-design (10), and three deliberately
left open: 7 and 22 are facets of the unpublished-runtime decision gated on
ADR-064/#252, and 16 needs the pagination design in #251 (the adjacent
config-ownership question is parked in #274). API-generator fixes filed as
#275 with regression
tests in `src/codegen/APIGenerator/__tests__/generated-api-regressions.test.js`;
runtime trio as #277; BFF endpoint as #278; MCP cwd as #279:

1. ✅ API `src/index.js` calls `database.connect()`; sqlite DB module exports `connectDatabase()` — API never boots. → sqlite module now exports `connect`/`disconnect` aliases.
2. ✅ API route files import operationId-derived handler names; controllers export path-derived names — Express crash at mount. → one shared naming function, operationId preferred.
3. ✅ API `routes/index.js` mounts all routers at `''` — resource paths resolve to the wrong handlers. → mounted at the original (spec-faithful) resource segment.
4. ✅ API by-id controllers call `findByPk(req.params.id)` regardless of the declared path param name. → lookups on the declared param; `findByPk`/`findById` reserved for params literally named `id`/`_id`.
5. ✅ API list controllers pass `limit`/`offset` into the `where` clause — SQL error on any paginated request. → filters restricted to real model attributes (`rawAttributes`/`schema.paths`).
6. ✅ API `npm run db:seed` points sequelize-cli at `seeders/`; generator writes `seeds/`; two other seed stubs disconnected. → unified `seed.js` connects and runs the generated `./seeds` set; `db:seed` wired to it for both databases.
7. ⏳ Generated MFE devDependencies pin unpublished `@seans-mfe-tool/runtime` — host-side `npm install` fails with no workaround hint (known deferral, ADR-064 / #252; generated README should mention the staging workaround).
8. ✅ Angular template `tsconfig.app.json.ejs` puts a `"//"` comment key inside `compilerOptions` — every fresh Angular MFE fails to compile (TS5023). → JSONC line comment instead (Refs #274).
9. ✅ Seed derivation from spec examples produced type-violating rows (floats in `integer` fields, suffixed strings in keys) — GraphQL rejected them at the BFF. → `SeedGenerator.generateVariation` is now type-aware: integer fields vary by whole steps, numbers keep 2-decimal floats, strings suffix only beyond the base row.
10. ✅ *(by design)* `mcp serve` space form shows topic help and exits 0; only `mcp:serve` starts the server. Colon topics are the locked oclif convention for this CLI (CLAUDE.md resolved decisions) — the space form showing topic help IS oclif's standard behavior, same as `git remote` printing usage. Not a bug; noted here so nobody re-trips on it.
11. ✅ MCP tool calls cannot target a working directory. → every tool now accepts a reserved `cwd` argument (validated, stripped from argv, applied to the child spawn); `scripts/mcp-call.mjs` runs one server for the whole fleet (#279).
12. ✅ Cosmetic: TS build artifacts (`.d.ts`, `.d.ts.map`, compiled jest config) emitted into generated JS API projects. → the `api` command's template copy now filters `*.d.ts` / `*.d.ts.map` / `*.js.map` out of the scaffold.
13. ✅ mongodb variant hangs on boot with any valid `MONGODB_URI` (post-connect wait for an already-fired `'connected'` event); connect() also not idempotent. → wait removed, readyState guard added (Refs #275).
14. ✅ `SEED_DATA=true` disconnects the server's own DB connection (in-process path ran standalone seed.js). → index.js template now runs `./database/seeds` directly (Refs #275).
15. ✅ Docs gap: the schema↔model mapping rules (every components.schemas entry becomes a model; controller model = path's first segment singularized) were only discoverable from generator source. → documented as the "Naming contract" section in `docs/architecture-api-generator.md`, with the Meridian specs cited as working examples.
16. ⏳ Generated query validator rejects unknown keys, so generated APIs can't honor pagination conventions other than limit/offset (cursor, Page/PageSize are accepted but ignored).
17. ✅ Freshly generated MFEs were not tsc-clean: generated `bootstrap.ts` passed a partial Context to `updateControlPlaneState`; `remote.tsx` used `.tsx` import extensions without `allowImportingTsExtensions`, and its `handles` export leaked an unnameable inferred type (TS2742). Builds (swc) and tests (isolated ts-jest) masked all three. → React bootstrap template now passes a full Context (matching the Angular twin, which already did — see the template-drift note below), remote imports are extensionless, `handles.imperative` carries an explicit `ImperativeMountHandle` annotation (now re-exported from the runtime), and codegen regression tests pin all three template fixes. Verified by hand: `tsc --noEmit` is 0-error in the regenerated console, crew-services, and concourse.
18. ✅ abc-kids shell package.json still referenced `file:../../../src/runtime`, removed by the packages/runtime promotion (#240) — host-side installs of the abc-kids shell were broken; only the docker path (which rewrites the dep) worked. → dep repointed to `file:../../../dist/runtime`.
19. ✅ Generated BFF client dials relative `/graphql` — breaks under cross-origin composition. → connector now bakes `manifest.endpoint + data.serve.endpoint` (single deployable unit); `mfe.query()` inherits it (#278).
20. ✅ Keyed-slot fan-out (N instances of one remote): mount race on the ADR-042 gate, Angular `bootstrapApplication` selector collapse, out-of-zone change detection, and post-CD prop assignment — all four fixed in packages/runtime (#277).
21. ✅ `remote:generate --force` was a no-op wearing a threatening name: generated-owned files already re-stamp on every run, developer-owned files are never overwritten by ANY flag — but the CLI printed "Use --force to overwrite" anyway. Hint now tells the truth ("Yours to edit — regeneration never overwrites these"), the flag is documented as a deprecated no-op, and the Dockerfile template absorbed the proven runtime-staging pattern so committed Dockerfiles ARE template output (regen invariant now wired into CI).
22. ⏳ `file:`-linked runtime symlink breaks Angular builds (resolution escapes the project: `Can't resolve '@angular/platform-browser' in dist/runtime`); works only as a real directory copy — plus a stale `.angular` cache kept the failure alive after the fix. More weight behind publishing the runtime (ADR-064/#252).

### Meta-finding: the React and Angular templates drift

Fixing item 17 surfaced a pattern worth naming: the Angular `bootstrap.ts.ejs`
already passed a complete Context to `updateControlPlaneState` — only the React
twin was broken. The two template trees (`base-mfe/` and `base-mfe-angular/`)
encode the same lifecycle contract twice and are edited independently, so every
fix has to be remembered in both places, and item 8 (Angular tsconfig) vs item
17 (React bootstrap) show drift in both directions. There's no structural
guard: no shared partials for the framework-independent parts, and no test that
diffs the two lanes' behavior against the contract. The item-17 regression
tests pin the specific React-template mistakes (partial Context, `.tsx`
extensions, unannotated handles) so those can't silently return, but they are
content assertions, not a cross-framework contract check. A structural fix
(shared template fragments, or a per-framework `tsc --noEmit` gate on a freshly
generated MFE in CI, per ADR-034's template-variant rule) is a design question
worth its own issue, not a punch-list item.
