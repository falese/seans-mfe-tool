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

### 3. Offline lane — a static mirror

`npm pack` tarballs plus synthesized packuments, baked into the CLI image, which
generated MFE Dockerfiles already mount via `COPY --from=cli-builder`. npm's
install protocol is two GETs — a packument at `/@falese%2fname` and a tarball at
`/@falese/name/-/name-x.y.z.tgz` — so a static file server satisfies it and no
registry daemon is required. ADR-033 builds the tool for an agent working in a
sandbox with no live npm registry; this keeps that true.

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
