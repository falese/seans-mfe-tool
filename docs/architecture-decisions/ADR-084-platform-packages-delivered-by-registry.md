---
id: 0084
title: Platform packages are delivered by registry — GitHub Packages hosted, static mirror offline
status: Accepted
impl:
  stage: phased
  refs: ["#252"]
date: 2026-07-31
deciders: [sean]
area: Runtime / packaging / distribution
enforcement: code
tags: [packaging, distribution, github-packages, offline, codegen]
relates-to: [33, 36, 56, 64, 67, 82, 83]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by: []
verified-by:
  - packages/codegen/src/__tests__/lockfile-lane-independence.test.ts
  - packages/codegen/src/__tests__/validate.test.ts
  - scripts/__tests__/published-package-resolution.test.ts
long-form: true
summary: >-
  The four MFE-facing platform packages become published artifacts resolved by npm install —
  from GitHub Packages when hosted, from a static mirror baked into the CLI image when
  offline — so generated MFEs declare plain semver dependencies that nothing rewrites.
rationale-summary: >-
  framework-react is currently impossible for a generated MFE to install, which is the real
  reason codegen duplicates its components into templates; publishing the packages removes
  the duplication rather than managing it.
---

## Context

Generated MFEs receive platform code two ways, and neither is a dependency.

`@seans-mfe/framework-react` declares `"@seans-mfe/contracts": "file:../contracts"`
— a relative path resolvable only inside this repository — and nothing stages it.
A generated MFE therefore **cannot install it at all**.

`@seans-mfe-tool/runtime` is delivered by staging: `scripts/copy-runtime-files.js`
synthesizes a `package.json` and bundles contracts via `bundledDependencies`, and
each MFE's Dockerfile rewrites its own manifest twice per build —
`npm pkg set devDependencies[…]='file:/seans-mfe-tool/dist/runtime'` before
install, `npm pkg delete` before the production stage. Inside the monorepo the
same dependency resolves by workspace symlink instead. Two resolution paths for
one package, neither of them `npm install`.

The cost is not theoretical. Because framework-react is undeliverable, codegen
duplicates its components into templates:
`packages/codegen/templates/base-mfe/slots.tsx.ejs` and
`packages/framework-react/src/runtime/DeclaredSlot.tsx` hold character-identical
component bodies, differing only in `contract` (a prop) versus `slotContract` (a
module const), down to the same ref-narrowing comment verbatim in both. They are
kept in step by a comment that no test or gate enforces, and they have already
drifted once — commit `55dabe7` re-aligned them by hand. ADR-067 justified the
copy as *"generated MFEs already depend on the runtime package, so this adds no
dependency"*, which restates the packaging gap as though it were a design goal.

The end state of that gap is a published entry point,
`@seans-mfe/framework-react/runtime`, with zero consumers anywhere in the
repository, whose `useMfe` signature has drifted from its own ADR-056 spec
without anyone noticing, because nothing exercises it.

## Decision

### 1. The MFE-facing packages are published artifacts

`smt-contracts`, `smt-runtime`, `smt-framework-react` and `smt-framework-angular`
are installed by `npm install`, not staged into a folder or baked into an image
as source.

### 2. Hosted lane — GitHub Packages

Published to `npm.pkg.github.com` on tag, never to npmjs.com. Consumers select it
with `@falese:registry` in `.npmrc` plus a `NODE_AUTH_TOKEN`.

**A generated MFE ships that `.npmrc`, and it is the committed default.** This was
described here and not emitted: for the first weeks of this decision every
generated MFE declared `@falese/*` dependencies with nothing to resolve them, so
`npm install` in a fresh scaffold went to npmjs.org and 404'd. The fresh-scaffold
gate is what surfaced it; the demo did not, because it ran inside the CLI image
where the packages were already installed.

The file carries the registry and never a token — it is committed, and a token in
a committed file is a leak. Auth resolves from `~/.npmrc` or `NODE_AUTH_TOKEN`,
which is ordinary npm practice.

Hosted is the committed default because the alternative is worse *as an artifact*:
the offline lane's URL is `http://127.0.0.1:4873`, and a localhost address baked
into every MFE repository is not merely inconvenient, it is false for anyone who
clones it. An auth requirement is at least true.

The file is developer-owned (`overwrite: false`). Which registry an organisation
resolves from is an operator decision — a proxy, an internal mirror, Artifactory —
and regeneration must not overwrite that choice.

### 3. Offline lane — a static mirror

`npm pack` tarballs plus synthesized packuments, baked into the CLI image, which
generated MFE Dockerfiles already mount via `COPY --from=cli-builder`. npm's
install protocol is two GETs — a packument at `/@falese%2fname` and a tarball at
`/@falese/name/-/name-x.y.z.tgz` — so a static file server satisfies it and no
registry daemon is required. ADR-033 builds the tool for an agent working in a
sandbox with no live npm registry; this keeps that true — and that promise is
precisely why the hosted lane cannot be the *only* lane: a token is the one thing
an agent in a sandbox cannot obtain for itself.

**The offline lane is selected by environment, never by a second `.npmrc`.**

    npm_config_@falese:registry=http://127.0.0.1:4873 npm ci

npm resolves configuration CLI flag > environment > project `.npmrc` >
`~/.npmrc` > global. Now that a generated MFE ships a project `.npmrc`, an
override written to the user or global file **loses to it silently** — the
install would go to GitHub Packages and fail on a missing token, with nothing
pointing at the cause. The environment variable is the only override that
outranks the committed file, so it is the one this decision specifies.

`check:template-typecheck` installs its probes through this lane, so the gate
exercises it rather than asserting it works.

### 3a. Existing MFEs need the `.npmrc` added by hand

`PLATFORM_MIGRATIONS` (ADR-082) cannot carry this one, and the reason is worth
stating rather than filing an entry that never fires: the registry detects by
*usage*, scanning developer-owned files under `src/` with source extensions.
`.npmrc` is a root file and its defect is an **absence**, so there is nothing to
match on. An entry here would look like coverage and provide none.

The 21 MFEs in `examples/**` were given the file directly in the same change.
Anyone with an MFE outside this repository adds it once; the ADR-084 §5 lockfile
rule already fails loudly if the lane is pinned the old way, so the failure mode
is visible rather than silent.

The lasting fix is a `mfe:validate` rule reporting an MFE that declares
`@falese/*` dependencies with no `.npmrc` to resolve them — a warning, not an
error, on the ADR-082 pattern for developer-owned files. Not built here.

### 4. A generated manifest declares plain semver, permanently

`"@falese/smt-framework-react": "^0.1.0"`. Nothing rewrites a `package.json` at
build time. The `npm pkg set` / `npm pkg delete` pair is deleted.

### 5. Lockfiles are lane-independent

`resolved` is stripped from `@falese/smt-*` entries; `integrity` is retained.
`mfe:validate` fails when a lockfile carries `resolved` URLs for those packages,
so the invariant is gated rather than documented.

## Boundaries

**Item 5 exists because item 4 alone is insufficient, and this was measured
rather than assumed.** With the npm cache cleared, `npm ci` fetches tarballs from
the lockfile's `resolved` URL and **ignores** the `.npmrc` scoped registry: a lock
produced in one lane fails in the other, observed as `E403` against GitHub
Packages while the local mirror was up and serving the same package. Stripping
`resolved` restores the `.npmrc` fallback, and integrity still holds — a tampered
tarball served under the original hash was rejected with `EINTEGRITY` after two
retries and installed nothing. Public dependencies keep their
`registry.npmjs.org` `resolved` URLs untouched.

The offline mirror is **read-only**: it serves installs and does not accept
publishes. It is a delivery mechanism, not a local registry to develop against.

This decision covers package *delivery*. It does not change any package's public
API, does not rename the CLI binary, and does not by itself resolve which host-side
composition surface generated MFEs should use.

## Consequences

`slots.tsx.ejs` collapses from a duplicated component to a binding that imports
the real one, so an edit to `DeclaredSlot.tsx` finally reaches regenerated MFEs —
a property that silently did not hold before. The manifest rewriting and the
`dist/runtime` staging machinery are deleted, which is the acceptance criteria of
#252. `useControlPlaneState` and any future framework sugar become importable
without a third copy.

The costs: two lanes that must stay in step, and a **new invariant** — lockfile
normalization — that did not exist before. Item 5 is gated precisely because this
repository already carries one unenforced "keep these in sync" convention that
drifted silently; adding a second ungated one would repeat the mistake this
decision exists to correct.

Generated `package.json` is developer-owned (`overwrite: false`), so existing MFEs
will not gain the new dependency on regeneration. That requires a
`PLATFORM_MIGRATIONS` entry under ADR-082 in the same change, not a follow-up.

## References

- ADR-064 — the runtime's future as a published package; this extends it from the
  runtime to all four MFE-facing packages and fixes the topology.
- ADR-083 — the `@falese/smt-*` namespace these are published under.
- ADR-067 — the manifest-declared slot contract whose three-layer split justified
  the duplicated component; the duplication, not the split, is what changes.
- ADR-082 — platform migrations, required here because generated `package.json`
  is developer-owned.
- ADR-033 — the AI-native developer experience, whose sandboxed agent runs with
  no live npm registry; the offline lane is what keeps that true.
- ADR-056 — the presentation boundary whose framework subpaths this delivers.
- #252 — tracks the publishing work and the staging-machinery deletion.
