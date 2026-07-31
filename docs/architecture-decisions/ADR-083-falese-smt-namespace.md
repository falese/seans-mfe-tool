---
id: 0083
title: Platform packages consolidate on the @falese/smt-* namespace
status: Accepted
impl:
  stage: phased
  refs: ["#252"]
date: 2026-07-31
deciders: [sean]
area: Packages / namespace / distribution
enforcement: convention
tags: [packages, namespace, publishing, github-packages]
relates-to: [36, 64]
supersedes: [21]
superseded-by: []
implements-pdr: [2, 4]
implemented-by: []
verified-by: []
long-form: true
summary: >-
  Every package this tool ships publishes under @falese/smt-* — platform packages as
  smt-<name>, official oclif plugins as smt-plugin-<name> — replacing the two-namespace
  split of ADR-021, which GitHub Packages makes impossible to keep.
rationale-summary: >-
  GitHub Packages pins an npm scope to the repository owner, so @seans-mfe/* cannot be
  published from falese/seans-mfe-tool at all; the separation ADR-021 wanted is then
  enforced by the registry rather than by a naming convention.
---

## Context

GitHub Packages resolves an npm scope to the repository owner: only `@falese/*`
can be published from `falese/seans-mfe-tool`. ADR-021's two-namespace split —
`@seans-mfe/*` for platform packages, `@falese/*` for plugins — cannot survive
that constraint. Its own Consequences section anticipated the bill: *"Renaming
packages if the tool is rebranded requires a major migration."*

The split also rests on a premise that never materialized. ADR-021 names
`@falese/plugin-daemon` and `@falese/plugin-coder` as the third-party occupants of
that namespace. **Neither exists** — they appear nowhere in this repository
outside prose. The one real `@falese/*` package, `@falese/bff-plugin`, is
first-party: it lives in `packages/bff-plugin` and is a declared entry in the
CLI's own `oclif.plugins` array. The boundary has therefore never separated
anything, and the mixed-scope problem it was written to prevent has not occurred.

Distribution is the forcing function, not aesthetics: ADR-084 makes these
packages installable dependencies rather than staged folders, and nothing can be
published until the scope question is settled.

## Decision

### 1. One scope, one prefix

Every package this tool ships publishes under `@falese/smt-*` — `smt` for Sean's
MFE Tool. npm package names are lowercase, so `@falese/SMT` is not a legal name.

### 2. Platform packages vs official plugins

Platform packages take `smt-<name>`; official oclif plugins take
`smt-plugin-<name>`.

| Now | Published as |
|---|---|
| `@seans-mfe-tool/runtime` | `@falese/smt-runtime` |
| `@seans-mfe/contracts` | `@falese/smt-contracts` |
| `@seans-mfe/framework-react` | `@falese/smt-framework-react` |
| `@seans-mfe/framework-angular` | `@falese/smt-framework-angular` |
| `@seans-mfe/codegen`, `dsl`, `oclif-base` | `@falese/smt-codegen`, `smt-dsl`, `smt-oclif-base` |
| `@falese/bff-plugin` | `@falese/smt-plugin-bff` |

`@seans-mfe-tool/runtime` → `@falese/smt-runtime` also completes the rename
ADR-064 already called for.

### 3. Third parties are excluded structurally, not by convention

GitHub Packages pins a scope to its owning account, so no one else can publish
into `@falese/*` under any circumstance. Community plugins and capability
adaptors publish from their own repositories under their own scopes. This is what
ADR-021 wanted; it is now a property of the registry instead of a rule people
have to remember.

## Boundaries

Does not rename the `seans-mfe-tool` CLI binary, its oclif topic names, or its
Docker image tags — none of that is required to publish packages, and renaming it
would touch the oclif config, every Dockerfile tag and every doc for no gain
here.

Does not change any package's public API; this is an identity change only.

The `smt-` / `smt-plugin-` distinction is **descriptive, not a trust boundary**.
Everything in the scope is first-party by construction, so the prefix aids
legibility rather than gating anything. Do not build tooling that treats it as a
security or ownership signal.

## Consequences

The separation ADR-021 wanted is preserved and strengthened rather than traded
away: it moves from a convention humans maintain to a property the registry
enforces. The `smt-` prefix keeps the tool's identity legible inside a personal
scope that also holds unrelated work.

The cost is the migration itself — roughly 185 files across `packages/`, `src/`,
`scripts/` and the templates, plus the `examples/**` fleet — and the standing
requirement that every future package remember the prefix, which nothing
enforces. That is a real weakening versus a dedicated scope, accepted because the
alternative is not publishing at all.

## References

- ADR-021 — the two-namespace split this replaces; superseded.
- ADR-064 — the runtime's future as a published package, which named the
  `@seans-mfe/runtime` rename this completes.
- ADR-084 — platform packages delivered by registry, which is what makes
  publishing necessary in the first place.
- ADR-036 — framework plugins as separately published packages, which is why the
  framework packages stay separate rather than merging into one.
- #252 — tracks the publishing work.
