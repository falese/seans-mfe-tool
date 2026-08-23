# BFF Hybrid Live + Context-Mock Trial — Results

**Date:** 2026-06-01
**Plan:** `bff-live-api-plus-context-mock-plan.prompt.md`
**Sandbox:** disposable minimal Mesh BFF (`/tmp/bff-trial`), live source = public Swagger Petstore (`https://petstore3.swagger.io/api/v3`)
**Switch contract:** request header `x-bff-mode: mock | live` (default/absent = live)
**Scope tested:** both Variant A (Guild mock plugin) and Variant B (resolver-level switch), then compared.

---

## Outcome (TL;DR)

| | Variant A — `@graphql-mesh/plugin-mock` | Variant B — `resolversComposition` |
|---|---|---|
| Per-request header switch | ❌ **Not possible** | ✅ **Works** |
| Status in v0.100.x matrix | ❌ **Broken** (config + version incompat) | ✅ **Works** with `@graphql-mesh/transform-resolvers-composition@^0.104.36` |
| Live default + mock-on-switch | ❌ | ✅ live / mock / bogus→live all correct |
| Recommendation | Reject for this use case | **Adopt** |

**Recommended path: Variant B (resolversComposition).** It directly satisfies the per-request `x-bff-mode` contract, delegates to the live upstream via `next()` with zero recursion, and works in the project's Mesh v0.100.x matrix.

---

## Variant A — Guild mock plugin (`@graphql-mesh/plugin-mock`)

**Verdict: not viable in this matrix.** Four config permutations all failed:

1. `if: "context.headers['x-bff-mode'] === 'mock'"` → `ReferenceError: context is not defined`
2. `if: "env('MOCKING_ENABLED') === 'true'"` → `ReferenceError: env is not defined`
3. `mock: ./mocks#fn` → wrong schema key (plugin expects `apply` / `faker` / `custom`)
4. `custom: ./mocks#fn` + `if: true` → `TypeError: Cannot read properties of undefined (reading 'split')` in `mockSchema`

**Architectural blocker (decisive even if the config worked):** the plugin's `if` signature is `string | boolean | (() => boolean)` — **no request argument**. The gate is evaluated once at plugin setup, so Variant A can only toggle at the *process* level (env / dual profiles), never per-request. This matches the plan's own caution (3.3/3.4) and Further Consideration #3.

**Version incompatibility:** the only published `@graphql-mesh/plugin-mock` (0.105.38) does not cleanly integrate with `@graphql-mesh/cli@0.100.x` — the mock-field resolution throws inside `mockSchema`.

---

## Variant B — resolver-level switch (`resolversComposition`)

**Verdict: works, recommended.** Validated against the live Petstore with the same query/variables across three header states:

```graphql
{ findPetsByStatus(status: available) { id status } }
```

| Header | Result | Origin |
|---|---|---|
| (none) | `[{id:4},{id:7},{id:8},{id:9},{id:900001}…]` | **live** upstream |
| `x-bff-mode: mock` | `[{id:1001},{id:1002}]` (MockDog/MockCat) | deterministic mock |
| `x-bff-mode: bogus` | `[{id:4},{id:7}…]` | **live** (fallback) |

**Config (`.meshrc.yaml`):**
```yaml
transforms:
  - resolversComposition:
      mode: bare
      compositions:
        - resolver: 'Query.findPetsByStatus'
          composer: ./composer#mockSwitch
```
**Composer (`composer.js`):**
```js
module.exports = {
  mockSwitch: (next) => (root, args, context, info) => {
    if (context?.headers?.['x-bff-mode'] === 'mock') {
      return [/* deterministic fixtures */];
    }
    return next(root, args, context, info); // live upstream
  },
};
```

`context.headers['x-bff-mode']` is populated per-request (confirmed by an isolation test: header present → mock branch fires; header absent → `undefined`, live branch). Auth headers (`Authorization`) are untouched, so mock mode does not bypass auth wiring.

### Important gotcha (recorded for the generator follow-up)
**Do NOT use `additionalResolvers` that re-delegate to the same field name** — replacing `Query.findPetsByStatus` and then calling `context.PetStore.Query.findPetsByStatus()` recurses through the merged schema → **JS heap OOM** (reproduced twice). `resolversComposition` *wraps* the existing resolver (`next` = the real one), which is recursion-free and is the correct pattern for conditional live/mock branching.

---

## Two real bugs found in the project (independent of the trial)

1. **`DEPENDENCY_VERSIONS.meshTransforms.{resolversComposition,rateLimit,filterSchema,cache} = '^1.0.0'` is wrong.** A legacy `1.0.0` *is* published (so it doesn't 404), but the package's live mainline is the `0.10x` line — latest stable `resolvers-composition@0.104.36`, `rate-limit@0.105.38`, `filter-schema@0.104.37`. `^1.0.0` pins the orphaned `1.0.0`, which predates and is incompatible with `@graphql-mesh/cli@0.100.x`. A generated BFF enabling any of these transforms installs a broken version. Verified working pin for the trial: `@graphql-mesh/transform-resolvers-composition@^0.104.36`. These four constants should be corrected to their `^0.104.x`/`^0.105.x` equivalents.
2. **The mock plugin is unusable in-matrix** — if mock support is ever scaffolded, it must be resolver/composition-based, not `@graphql-mesh/plugin-mock`.

---

## Recommendation for Phase 7 (generator hardening) — deferred per plan scope

The plan explicitly excludes immediate template changes and DSL expansion. When pursued (behind an ADR):

- Scaffold an **optional** `resolversComposition` composer stub + a `composer.js` template that reads `context.headers['x-bff-mode']`, keyed off a manifest opt-in (e.g. `data.mockSwitch: true`).
- Ensure `server.ts.ejs` context creation forwards raw request headers into the Mesh context (the trial relied on Mesh's default header exposure; the generated Express+`createBuiltMeshHTTPHandler` path should be confirmed to pass `x-bff-mode` through — `base-mfe`'s `doQuery` already forwards `context.headers`).
- Fix the `resolversComposition`/`rateLimit`/`filterSchema`/`cache` version constants before enabling any of those transforms in generated output.
- Add CI-friendly automated tests using a **local stub API** (not the public Petstore, which is non-deterministic) covering: no-header→live, `mock`→mock, unknown→live.
