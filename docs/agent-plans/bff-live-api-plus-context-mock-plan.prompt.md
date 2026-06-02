## Plan: Hybrid BFF Live + Context Mock Trial

Validate a BFF setup that calls a live OpenAPI-backed API by default, but returns mocked data when an MFE-driven context switch is set. Recommended approach is to test two variants in sequence: (A) The Guild Mock plugin gate (`plugins.mock.if`) and (B) resolver-level switching using `additionalResolvers` or custom resolver logic, then compare behavior and ergonomics.

## Steps

1. Baseline generation and wiring (Phase 1)
1.1 Generate a disposable BFF project with existing CLI flow using `bff:init` and confirm Mesh config extraction path (`src/commands/bff/_shared.ts` -> `extractMeshConfig` / `writeMeshConfig`).
1.2 Configure one live OpenAPI source in `mfe-manifest.yaml` `data.sources` with `handler.openapi.source` pointing to a reachable API spec URL or local spec backed by a running test API.
1.3 Build and run once in live mode (`bff:validate`, `bff:build`, `bff:dev`) to capture baseline query results and request headers reaching the upstream API.

2. Context switch contract definition (Phase 2, depends on 1)
2.1 Define a single request-level switch contract from MFE to BFF, recommended header: `x-bff-mode: mock|live`.
2.2 Ensure MFE can send that header through existing query path (`src/runtime/base-mfe.ts` merges `context.headers` into fetch headers in `doQuery`).
2.3 Keep auth headers intact (`Authorization`) so mock mode does not bypass auth behavior unintentionally during testing.

3. Variant A: The Guild Mock plugin trial (Phase 3A, depends on 2)
3.1 Add `@graphql-mesh/plugin-mock` to BFF dependencies in the sandbox project.
3.2 In generated `.meshrc.yaml`, add `plugins: - mock:` config with explicit `mocks` entries for 1-2 target fields used by the MFE.
3.3 Gate mock activation with plugin `if` expression (supported by Mesh plugin implementation), initially env-driven (`process.env.MOCKING_ENABLED`) for stability.
3.4 Add a lightweight bridge in server context creation to map incoming `x-bff-mode` header to env-compatible toggle for local trial, or run dual process profiles: mock-on vs mock-off.
3.5 Execute identical queries in both modes; verify field-level mocked values appear only when mock mode is active and live values otherwise.

4. Variant B: Resolver-level conditional switch (Phase 3B, parallel option with 3A)
4.1 Add `additionalResolvers` (or resolver composition where applicable) so target query checks request context and branches.
4.2 If `context.headers['x-bff-mode'] === 'mock'`, return deterministic mock payload.
4.3 Else, delegate to live Mesh resolver or source.
4.4 Keep this scoped to one operation first to reduce blast radius.
4.5 Add deterministic fixtures for mock branch so assertions are stable.
4.6 Re-run same query matrix used in 3.5 to compare outputs and latency.

5. Compare and choose path (Phase 4, depends on 3A and or 3B)
5.1 Evaluate plugin approach vs resolver approach across setup complexity, per-field control, runtime toggling granularity, and fit with current generator templates.
5.2 Recommended default:
- If fast schema-wide dev mocking is needed: prefer plugin mock.
- If precise context-based switching for selected operations is needed: prefer resolver-level switch.

6. Automate verification (Phase 5, depends on chosen path)
6.1 Add integration tests in project style similar to `src/__tests__/integration/bff-workflow.test.ts`.
6.2 Case A: no switch header -> live response shape.
6.3 Case B: `x-bff-mode: mock` -> mock response shape and values.
6.4 Include one negative test: unknown mode value falls back to live.
6.5 Optional: snapshot both responses for quick regression checks.

7. Generator hardening follow-up (outcome of trial)
7.1 If trial succeeds, propose template enhancement in `packages/bff-plugin/templates/server.ts.ejs` and `packages/bff-plugin/templates/meshrc.yaml.ejs` to scaffold optional mock switch support.
7.2 Add manifest-level opt-in key under `data` or dedicated section only after ADR confirmation if this changes platform contract or governance.

## Relevant Files
- `src/commands/bff/_shared.ts` confirms DSL `data` extraction to `.meshrc.yaml`; key for where mock plugin config must be represented.
- `src/commands/bff/init.ts` generation entrypoint for BFF scaffold and dependency wiring.
- `src/commands/bff/build.ts` build path that emits `.meshrc.yaml` and runs `mesh build`.
- `packages/bff-plugin/templates/server.ts.ejs` request context creation; best place to read header switch.
- `packages/bff-plugin/templates/meshrc.yaml.ejs` plugin and transform YAML generation surface.
- `src/runtime/base-mfe.ts` `doQuery` header forwarding path from MFE context.
- `docs/mesh-dependency-matrix.md` current Mesh version policy for dependency compatibility.

## Verification
1. Run generation and validation commands on sandbox:
- `bun bin/dev.ts bff:init ...`
- `bun bin/dev.ts bff:validate`
- `bun bin/dev.ts bff:build`
- `bun bin/dev.ts bff:dev`
2. Execute the same GraphQL query twice with same operation and variables:
- Without `x-bff-mode` header.
- With `x-bff-mode: mock`.
3. Assert response origin by checking deterministic mock values and, for live mode, upstream API access logs or expected live payload signatures.
4. Run existing BFF workflow tests and add new mode-switch tests before adopting template changes.

## Decisions
- Included scope: experimental validation of hybrid live + mock behavior with context switch and plugin feasibility.
- Excluded scope: immediate production template changes and DSL contract expansion.
- Constraint: this repo is on Mesh v0.100.x policy; plugin version pin must remain compatible with that matrix.

## Further Considerations
1. Switch transport recommendation: use request header (`x-bff-mode`) over GraphQL variable because it applies cleanly across operations and can be filtered or logged at server boundary.
2. Start with operation-scoped mocks to avoid masking schema-level regressions from live APIs.
3. If context-driven plugin toggling is needed per-request (not per-process), resolver-level switching may be more predictable than global plugin gating.
