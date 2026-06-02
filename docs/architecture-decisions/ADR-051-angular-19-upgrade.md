---
id: 0051
title: Angular 19 Upgrade — Resolve XSS CVEs in Generated MFEs
status: Implemented
date: 2026-05-30
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [angular, security, codegen, dependencies, vulnerability]
summary: Upgrade Angular from ^17.0.0 to ^19.2.16 in all generated Angular MFE templates and runtime shared-dependency declarations to resolve five HIGH severity XSS CVEs fixed in Angular 18/19. TypeScript constraint is bumped from ~5.2.0 to ~5.7.0 to satisfy Angular 19's peer requirement (>=5.5 <5.9).
rationale-summary: Angular 17 carries 5 HIGH XSS CVEs (GHSA-58c5-g7wp-6w37, GHSA-v4hv-rgfq-gp49, GHSA-g93w-mfhg-p222, GHSA-prjf-86w9-mfqv, GHSA-jrmj-c5cx-3cw6). Generated MFEs are covered by the policy set in ADR-048 (Dependency Update and Vulnerability Response Policy): HIGH severity vulnerabilities in production packages require remediation within 30 days. Angular 19.2.16 is the earliest release that resolves all five CVEs.
long-form: true
---

# ADR-051: Angular 19 Upgrade — Resolve XSS CVEs in Generated MFEs

## Context

The Angular MFE generator (`src/codegen/templates/base-mfe-angular/`) and the runtime
Module Federation shared-scope declarations (`src/runtime/angular-remote-mfe.ts`) both
pinned Angular at `^17.0.0`. Five HIGH severity XSS vulnerabilities affect packages in
that range:

| Advisory | Package(s) | CVE Class | Fixed in |
|---|---|---|---|
| GHSA-58c5-g7wp-6w37 | `@angular/common` | XSRF token leak | 19.2.16+ |
| GHSA-v4hv-rgfq-gp49 | `@angular/common` | SVG XSS via sanitizer bypass | 19.2.16+ |
| GHSA-g93w-mfhg-p222 | `@angular/common` | Trusted-types bypass | 19.2.16+ |
| GHSA-prjf-86w9-mfqv | `@angular/common` | i18n message XSS | 19.2.16+ |
| GHSA-jrmj-c5cx-3cw6 | `@angular/core`, `@angular/compiler` | SVG XSS in template compiler | 18.2.15+ |

Additionally, `@angular-builders/custom-webpack` and `@angular-architects/module-federation`
use a major-version numbering convention that tracks Angular's major (17.x packages
declared `@angular/compiler-cli: ^17`). The Angular 19-compatible releases are:

- `@angular-builders/custom-webpack@19.0.1` (peer: `@angular/compiler-cli: ^19.0.0`)
- `@angular-architects/module-federation@19.0.3` (no peer dep, Angular-version-agnostic API)

The Angular 19 build toolchain requires TypeScript `>=5.5 <5.9`. The existing generated
`typescript: ~5.2.0` constraint is outside this range and would cause `npm install` to
fail for peer resolution under strict mode.

### Why generated code is covered by the policy

Generated MFEs use Angular packages as _production_ dependencies (not dev-only). An end
user who runs `remote:generate` and deploys the output ships the vulnerable packages to
production. The tool is responsible for the generated dependency manifests.

## Decision

1. **`DEPENDENCY_VERSIONS` in `unified-generator.ts`** — bump all `angular.*` entries
   to `^19.2.16` and all `angularBuild.*` entries:
   - `cli`, `buildAngular`: `^19.2.16`
   - `customWebpack`: `^19.0.1`
   - `moduleFederation`: `^19.0.3`
   - `typescript` (new field): `~5.7.0` — stable 5.x within the Angular 19 range

2. **`package.json.ejs` template** — replace hardcoded `"typescript": "~5.2.0"` with
   `dependencyVersions.angularBuild.typescript`. Add an `overrides` block to enforce the
   minimum-safe `@angular/common` version transitively and pin `tar >= 7.5.11` to
   resolve GHSA-34x7-hfp2-rc4v / GHSA-8qq5-rm4j-mr97 in the Angular build toolchain.

3. **`webpack.config.js.ejs` template** — update Module Federation `requiredVersion`
   strings for `@angular/core`, `@angular/common`, and `@angular/platform-browser` from
   `'^17.0.0'` to `'^19.2.16'`.

4. **`src/runtime/angular-remote-mfe.ts`** — update `getSharedDependencies()` to declare
   `requiredVersion: '^19.2.16'` for the same three Angular packages.

5. **`src/dsl/parser.ts`** — update the default Angular dependency scaffolding for new
   manifests from `^17.0.0` to `^19.2.16`.

6. **`jest.config.js.ejs` and `setup.jest.ts.ejs` templates** — add these two missing
   Angular MFE test templates so that a fresh `remote:generate` produces a working
   `npm test` configuration without manual file creation.

No changes to the `angular.json.ejs` template or the `@angular-builders/custom-webpack:browser`
builder configuration — the builder API is stable across Angular 17/18/19 for the
custom-webpack variant.

## Consequences

### Positive

- All five Angular HIGH XSS CVEs are resolved in generated MFEs.
- `node-tar` HIGH vulnerabilities (GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, etc.) in
  the Angular build toolchain are resolved via the `tar: ^7.5.11` override.
- Generated `package.json` is a single source of truth for all version constraints
  (no more hardcoded `~5.2.0` in the template).
- Angular 19 includes improved SSR, Signals API stabilization, and zoneless preview.

### Negative / Trade-offs

- `~5.7.0` TypeScript is a minor constraint bump; projects using `~5.2.x` outside the
  generated context are unaffected.
- The `@angular-builders/custom-webpack` package did not release a `^19.2.x` matching
  version — the last stable Angular-19-compatible release is `19.0.1`. Using `^19.0.1`
  is correct because semver `^19.0.1` allows `>=19.0.1 <20.0.0`, which covers all future
  Angular 19.x-compatible builds.
- Two dev-only vulnerabilities remain without a non-breaking fix available:
  - `serialize-javascript` (no fix available upstream)
  - `fast-uri` (via `@graphql-mesh/runtime` — requires breaking graphql-mesh upgrade,
    tracked separately per ADR-048)

### Invariants unchanged

- `zone.js: ~0.14.0` — unchanged, compatible with Angular 19.
- `rxjs: ^7.8.0` — unchanged.
- Module Federation container API (`withModuleFederationPlugin`, `library: { type: 'var' }`,
  `scriptType: 'text/javascript'`) — unchanged; stable across Angular 17/18/19.
- `@angular-builders/custom-webpack:browser` builder — unchanged; still the correct
  builder for the `@angular-architects/module-federation` custom-webpack variant.

## References

- [GHSA-58c5-g7wp-6w37](https://github.com/advisories/GHSA-58c5-g7wp-6w37) — XSRF token leak
- [GHSA-v4hv-rgfq-gp49](https://github.com/advisories/GHSA-v4hv-rgfq-gp49) — SVG XSS
- [GHSA-g93w-mfhg-p222](https://github.com/advisories/GHSA-g93w-mfhg-p222) — Trusted-types bypass
- [GHSA-prjf-86w9-mfqv](https://github.com/advisories/GHSA-prjf-86w9-mfqv) — i18n XSS
- [GHSA-jrmj-c5cx-3cw6](https://github.com/advisories/GHSA-jrmj-c5cx-3cw6) — SVG XSS (compiler)
- ADR-036: Framework plugin system — `@angular-builders/custom-webpack` is the Angular
  framework plugin's build toolchain
- ADR-048: Dependency Update and Vulnerability Response Policy — HIGH severity requires
  remediation within 30 days of disclosure
