# ADR-065: Generated API Reference with Drift Gate; DSL Manifest JSON Schema from the Zod Source of Truth

**Status:** Accepted (impl phased, #264)
**Date:** 2026-07-03
**Refs:** ADR-064 (runtime as a published package), #252, #254, #264

## Context

The project documents its *decisions* well — `docs/spec.md`, the ADR/PDR
registers, the framework-plugin authoring guide — and its CLI surface is
machine-generated (`schemas/<topic>/<cmd>.json`, drift-gated in the build).
What has never existed is reference documentation for the **programmatic**
surfaces:

- the `@seans-mfe/contracts` wire protocol (Message envelopes, ActionRecord,
  RenderedExperience, SessionContext, the presentation handles);
- the runtime engine API (`BaseMFE` lifecycle, `BaseRemoteMFE`,
  `LayoutManager`, adaptors, transport, `DaemonChannel`);
- the DSL manifest shape (defined in zod, readable only as source).

Three recent changes make generation viable where it previously was not:
the runtime purged `any` from its core files (#262), the contracts/runtime
type boundary is machine-enforced (boundary test, #262), and the source
carries substantial JSDoc a generator can harvest. Two upcoming changes make
it necessary: publishing `@seans-mfe/contracts` (#252, MERGE-PLAN Phase 1)
and the runtime's move to a semver package (ADR-064) put third parties on
these APIs.

A constraint shaped the rollout plan: this ADR and its config landed from an
environment without npm registry access, so the initial generation must
happen in CI, and new devDependencies cannot be added yet (the lockfile
cannot be regenerated offline, and an out-of-sync lockfile breaks `npm ci`).

## Decision

1. **API reference is generated, never hand-written.** TypeDoc with
   `typedoc-plugin-markdown` renders `@seans-mfe/contracts` and the runtime
   (`index` + `angular` subpath) to **markdown checked into `docs/api/`** —
   diffable in PRs, consistent with the repo's markdown docs culture, and
   drift-gated exactly like `schemas/` (`build:docs:check` fails when
   `docs/api/` is stale).
2. **The DSL manifest gets a JSON Schema generated from the zod source of
   truth.** zod v4's native `z.toJSONSchema` emits
   `schemas/dsl/manifest.schema.json` via `scripts/generate-dsl-schema.ts`
   (`build:schema:dsl`). One schema definition; the JSON Schema is a build
   artifact for editors and external validators, never hand-edited.
3. **CI owns generation; the gate arms itself.** The `api-docs` workflow
   installs the doc toolchain pinned `--no-save` (see constraint above),
   generates docs + schema, uploads them as an artifact, and enforces the
   drift diff **only when `docs/api/` already exists in the tree** — so the
   workflow cannot fail before the first output has been reviewed and
   seeded, and becomes a real gate immediately after.

## Phasing

| Phase | What | Where |
| --- | --- | --- |
| 1 (this change) | ADR, `typedoc.json`, `tsconfig.typedoc.json`, `scripts/generate-dsl-schema.ts`, npm scripts, `api-docs.yml` workflow | #263 |
| 2 | Run the workflow, review output, commit the seeded `docs/api/` + `schemas/dsl/manifest.schema.json`; promote `typedoc`/`typedoc-plugin-markdown` to `devDependencies` with a lockfile update (requires registry access) | #264 |
| 3 | API Extractor `.api.md` public-API reports per package — turns the "no public API change" invariant asserted manually in #263 into a CI check. Deferred until per-package builds exist (ADR-064 / #252) | #252 |
| 4 | `oclif readme` command reference once README `<!-- commands -->` markers are added | #264 |

## Alternatives considered

- **Hand-written API markdown** — rots immediately; the S1–S10 refactor
  would have invalidated it wholesale. Rejected.
- **TypeDoc HTML output** — not diffable, needs hosting; markdown-in-repo
  matches how this project reads its own docs. Rejected for now (HTML can be
  layered on later from the same config).
- **API Extractor first** — its `.api.md` reports are the highest-value
  artifact for the "no public API change" discipline, but it wants per-package
  `.d.ts` builds that don't exist until ADR-064/#252 land. Sequenced as
  phase 3, not rejected.
- **`zod-to-json-schema` dependency** — unnecessary; zod v4 ships
  `z.toJSONSchema` natively.

## Consequences

- `docs/api/` and `schemas/dsl/manifest.schema.json` become generated,
  never-hand-edited artifacts (same contract as `schemas/`); PRs that change
  public types show the reference diff alongside the code diff.
- Until phase 2 completes, the doc tools are workflow-installed
  (`--no-save`, pinned) rather than lockfile-managed — an explicit, tracked
  inconsistency (#264), not a pattern to copy.
- Verification gates gain one step once seeded: `npm run build:docs:check`
  joins the pre-push list for changes to `packages/contracts/src/**` or
  `packages/runtime/src/**`.
