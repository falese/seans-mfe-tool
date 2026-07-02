# ADR-064 — The runtime's future is a semver-published package, not a staged `dist/runtime` folder

- **Status:** Accepted (implementation deferred — gated on the publish decision)
- **Date:** 2026-07-01
- **Tracking issue:** #252
- **Relates to:** ADR-061 (`@seans-mfe/dsl` + `@seans-mfe/codegen` as packages), ADR-021 (package namespace strategy), ADR-045 (package-manager + runtime pinning), ADR-056 (`boundary.test` neutral-runtime invariant), ADR-036 (framework plugins), the RESTRUCTURE-PLAN §1.3.1 ("promote the runtime to a real package")

## Context

`@seans-mfe-tool/runtime` — the `BaseMFE` / `RemoteMFE` lifecycle classes every
generated MFE consumes — is already a workspace package. But it is **distributed
by staging, not by publishing:**

- it compiles to `dist/runtime`;
- `scripts/copy-runtime-files.js` makes that folder self-contained — it writes a
  `package.json` and **bundles `@seans-mfe/contracts`** into
  `dist/runtime/node_modules` (`bundledDependencies`) so a `file:` install needs
  no registry;
- the CLI Docker image bakes `dist/runtime`, and generated MFEs consume it via a
  `file:`/workspace link plus a hardcoded `COPY … dist/runtime …` in their
  Dockerfiles;
- the path and identity (`dist/runtime`, `@seans-mfe-tool/runtime`) are hardcoded
  across ~18 example MFEs, both framework plugins, the BFF Dockerfile template,
  and the CLI/MFE Dockerfiles.

**All of this machinery exists only because the package is not published.** The
RESTRUCTURE-PLAN framed §1.3.1 as "promote the runtime to a real package" — but
the package-ization already happened (own `package.json`, workspace member,
consumed as a dependency). What actually remains is two distinct things, and they
are not the same:

1. a **cosmetic** concern — the source lives at `src/runtime`, which reads like
   CLI code (addressed separately by the byte-stable move to `packages/runtime`);
2. a **substantive** concern — the *distribution model* is a compiled folder baked
   into an image, not a versioned dependency. This ADR is about (2).

Moving the folder relocates the smell; it does not remove it. Removing it means
changing how the runtime is *distributed*.

## Decision

**The target state is `@seans-mfe/runtime` as a semver-versioned, published
package** — on public npm, or a private registry / Verdaccio — consumed by
generated MFEs as an ordinary dependency (`"@seans-mfe/runtime": "^x.y.z"`)
resolved by `npm install`.

Reaching it **deletes** machinery rather than relocating it: `copy-runtime-files.js`,
`remove-dist-shims.js`, the `bundledDependencies` shim, the `dist/runtime` Docker
`COPY`s, and every hardcoded `dist/runtime` path go away, because a published
dependency needs no staging. Contracts becomes a normal transitive semver dep
instead of a bundled folder.

## Status / scope

**This is a direction, not built here, and it is explicitly gated.** The
RESTRUCTURE-PLAN guardrail reserves publishing for a human ("DO NOT npm-publish
any package"), so the substantive move cannot land inside the reduction campaign.
It is tracked in **#252** with scope + acceptance criteria (a freshly generated
MFE builds and runs — React and Angular — with the runtime resolved purely by
`npm install`; `boundary.test` still green; the CLI image no longer bakes
`dist/runtime`).

Until the publish decision is made, the runtime keeps its byte-stable
`packages/runtime` layout and the existing `dist/runtime` staging.

## Alternatives considered

- **"Full move + modernize staging"** — move `src/runtime` → `packages/runtime`
  *and* repoint the ~18 generated configs + plugins + Dockerfiles from
  `dist/runtime` to `packages/runtime/dist`. Rejected: it keeps the exact same
  `file:`/image-baking mechanism at a new address — lateral churn that spends the
  campaign's biggest Docker/E2E risk for zero architectural gain, and adds more
  hardcoded paths for the eventual publish move to unwind.
- **Move source only, keep `dist/runtime` byte-stable** — the layout half of
  §1.3.1, done as its own verified change. Accepted as the *precursor* to this
  ADR (fixes the address; leaves distribution for #252).
- **Leave the runtime at `src/runtime`.** Rejected only on legibility grounds —
  it reads like CLI code; the platform packages should be visibly under
  `packages/`.
