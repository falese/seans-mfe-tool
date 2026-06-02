---
id: 0052
title: BFF Demo Mode — Per-Request Mock Switch via resolversComposition
status: Implemented
date: 2026-06-01
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [bff, graphql-mesh, mock, demo-mode, codegen, dsl]
summary: Generated BFFs gain an opt-in "demo mode" — they serve live upstream data by default but return deterministic mock fixtures when a request carries `x-bff-mode: mock` (per-request) or when `DEMO_MODE=true` is set (deployment-wide default). Implemented with a Mesh `resolversComposition` transform wrapping `Query.*`, NOT `@graphql-mesh/plugin-mock`.
rationale-summary: Production apps need a demo/sandbox mode that returns stable, presentable data without a live backend — for sales demos, offline previews, and deterministic e2e. A trial (docs/agent-plans/bff-live-api-plus-context-mock-RESULTS.md) proved the Guild mock plugin is broken in the v0.100.x matrix and architecturally cannot gate per-request, while resolversComposition wraps the live resolver cleanly and supports both per-request and env-default switching.
long-form: true
---

# ADR-052: BFF Demo Mode — Per-Request Mock Switch via resolversComposition

## Context

Generated BFFs (ADR-012, ADR-027) proxy live REST/OpenAPI upstreams through GraphQL Mesh.
Teams repeatedly need a **demo mode**: serve presentable, deterministic data without a
reachable live backend — for sales demos, offline previews, design review, and stable e2e
fixtures. The data must look real, be predictable, and switch on/off without redeploying
different artifacts.

A trial validated two approaches against the live Swagger Petstore
(`docs/agent-plans/bff-live-api-plus-context-mock-RESULTS.md`):

- **Variant A — `@graphql-mesh/plugin-mock`:** rejected. Its only published line (0.105.x)
  is broken against `@graphql-mesh/cli@0.100.x` (config-schema and `mockSchema` errors across
  four permutations), and its gate signature is `if: string | boolean | (() => boolean)` —
  **no request argument**, so it can only toggle per *process*, never per request.
- **Variant B — `resolversComposition`:** works. A composer *wraps* the live resolver; it
  inspects the request and either returns a fixture or calls `next()` (live). Per-request
  switching, live default, and graceful fallback all verified.

A footgun was also found: `additionalResolvers` that **replace** a field and then delegate
back to the same field name recurse through the merged schema → **JS heap OOM**.
`resolversComposition` (wrap, not replace) is the recursion-safe pattern.

## Decision

### 1. Capability

Generated BFFs support an opt-in demo mode that returns deterministic mock fixtures instead
of calling the live upstream, decided **per request**.

### 2. Switch contract

- Request header **`x-bff-mode: mock`** → mock; **`x-bff-mode: live`** → live (explicit override).
- No header → fall back to the **`DEMO_MODE`** env var (`true` = mock). This makes a whole
  deployment "demo mode" by default while still letting individual requests opt back to live.
- A fixture is only substituted when one exists for the resolved field; otherwise the live
  resolver runs. Mock mode never bypasses auth header wiring (`Authorization` is untouched).

### 3. Mechanism

A Mesh `resolversComposition` transform wraps `Query.*` with a single generated composer.
The composer is fixture-data-driven (keyed by `info.fieldName`), so no per-operation code is
generated:

```js
// src/platform/bff/mock-switch.js (generated)
const fixtures = require('./mocks.json');
function useMock(context) {
  const mode = context && context.headers && context.headers['x-bff-mode'];
  if (mode === 'mock') return true;
  if (mode === 'live') return false;
  return process.env.DEMO_MODE === 'true';
}
const mockSwitch = (next) => (root, args, context, info) => {
  const fx = fixtures[info.fieldName];
  return useMock(context) && fx !== undefined ? fx : next(root, args, context, info);
};
module.exports = { mockSwitch };
```

```yaml
# .meshrc.yaml (generated when mockSwitch enabled)
transforms:
  - resolversComposition:
      mode: bare
      compositions:
        - resolver: 'Query.*'
          composer: ./src/platform/bff/mock-switch#mockSwitch
```

### 4. DSL contract

Opt-in lives in the manifest `data` section:

```yaml
data:
  sources: [...]
  mockSwitch:
    enabled: true        # adds the transform, composer, and mocks.json stub
```

Fixtures live in a developer-editable `src/platform/bff/mocks.json` (generated as an empty
stub, `overwrite: false`), keyed by GraphQL field name:

```json
{ "findPetsByStatus": [{ "id": 1001, "name": "Demo Pet", "status": "available" }] }
```

### 5. Dependency

`@graphql-mesh/transform-resolvers-composition` pinned to the live 0.10x line
(`^0.104.36`) — the prior `^1.0.0` constant resolved to an orphaned, incompatible legacy
build and is corrected alongside this change.

## Consequences

**Positive**
- Demo mode without separate artifacts: one image serves live or mock by header/env.
- Deterministic fixtures → stable demos and CI e2e without a live backend.
- Composer is generic and fixture-driven; adding a mock = editing `mocks.json`, no code.
- Live path is unchanged when no fixture matches or the switch is off.

**Negative / constraints**
- Fixtures are static JSON (no per-argument logic). A custom composer can be hand-extended
  for argument-aware mocks if needed.
- `Query.*` wrapping adds a thin composition layer to every root query (negligible overhead;
  it short-circuits to `next()` when not mocking).
- Mesh-version-coupled: depends on `resolversComposition@^0.104.x` tracking the cli 0.100.x line.

**Security note**
- `DEMO_MODE` must default to off (unset) in production. Mock mode returns canned data and
  must never be the silent default for a real deployment; it is opt-in per request or per
  explicitly-configured environment.

## References
- ADR-012 (GraphQL Mesh BFF), ADR-027 (Mesh v0.100.x plugins/transforms)
- ADR-050 (dependency governance — version pinning)
- Trial: `docs/agent-plans/bff-live-api-plus-context-mock-RESULTS.md`
- `src/runtime/base-mfe.ts` `doQuery` already forwards `context.headers` (the MFE can send `x-bff-mode`)
