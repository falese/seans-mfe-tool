---
id: 0062
title: "`deploy` is a dev-convenience wrapper; production deployment returns as a plugin-resolved target axis"
status: Implemented
date: 2026-07-01
deciders: [sean]
area: Deploy / plugins / scope
enforcement: code
tags: [deploy, plugins, scope]
relates-to: [22, 34, 36, 44]
supersedes: []
superseded-by: []
implements-pdr: [4]
implemented-by:
  - src/commands/deploy.ts
  - src/codegen/templates/docker
verified-by:
  - src/commands/__tests__/deploy.test.js
  - src/commands/__tests__/deploy.extras.test.ts
long-form: true
---

## Context

`src/commands/deploy.ts` (822 LOC) was two features wearing one name:

1. **A development deploy path** — reachable and working. `deploy <name> -t <type>`
   (default `--env development`) copies the project into a temp dir, selects the
   right Dockerfile template, runs `docker build --target development` +
   `docker run`, waits for container health, and optionally streams logs. This is
   a thin, honest convenience wrapper around `docker build && docker run`.

2. **A production "deploy" path** — **unreachable and off-pattern.**
   `deployCommand` throws `BusinessError('Production deployment not yet
   implemented', 'NOT_IMPLEMENTED')` for `--env production` before any of it can
   run. Behind that wall sat ~415 LOC of `productionDeploy` /
   `dockerComposeProductionDeploy` / `kubernetesProductionDeploy` that did **not
   deploy anything** — they *generated manifests* (`docker-compose.yml`, a
   `Dockerfile`, `.env.production`, `k8s/{deployment,secrets,configmap,hpa,
   kustomization}.yaml`, and READMEs) into a `deploy/` or `k8s/` directory for
   the operator to `docker-compose up` / `kubectl apply` themselves. The code was
   exported and unit-tested, but no CLI door reached it.

Three problems with keeping (2):

- **It is unreachable.** No user can invoke it; it is a tested capability with no
  product surface.
- **It duplicates the platform's real seam.** The one genuinely platform-specific
  thing it did — emit a hardened, ADR-036 plugin-driven Dockerfile — it did by
  *calling `generateDockerfile()` from `build:docker`*. The rest (a compose file,
  k8s YAML, an env template) is generic boilerplate that operators re-own per
  environment the moment it is generated.
- **It is the wrong shape.** It hardcodes exactly two targets (docker-compose,
  Kubernetes) as inline `if` branches — the anti-pattern of the plugin model this
  platform is built on (ADR-036 for frameworks, ADR-022 plugin-first). A real
  deploy feature belongs behind a resolver, not inlined in a command.

The RESTRUCTURE-PLAN item 5 asks us to "slim the big command files … remove dead
branches." The production generators are the single largest such branch, but they
are **tested**, so removing them is a capability decision, not a mechanical
cleanup. This ADR records that decision.

## Decision

**1. Keep `deploy` as a development-convenience command only.**
The reachable dev path (`copyDockerFiles`, `developmentDeploy`,
`waitForContainer`, `verifyProjectStructure`, and `deployCommand`'s development
branch) stays, byte-for-byte in behavior. The dev-path Dockerfile templates
(`dockerfile.remote`, `dockerfile.shell`, `dockerfile.nodeAPI`, `nginx.conf`)
stay.

**2. Remove the unreachable production-manifest generators.**
Delete `productionDeploy`, `dockerComposeProductionDeploy`,
`kubernetesProductionDeploy`, and their `multiplyMemory` / `multiplyCPU` helpers
from `deploy.ts`, along with the templates only they consumed:
`src/codegen/templates/kubernetes/` (whole directory),
`src/codegen/templates/docker/{Dockerfile.production.api, Dockerfile.production.react,
docker-compose.production.yml, nginx.production.conf}`. The production-only CLI
flags (`--registry`, `--mode`, `--namespace`, `--domain`, `--tag`, `--memory`,
`--cpu`, `--replicas`, `--framework`) are removed with them.

`nginx.mfe.conf` is **retained** — it is load-bearing for the `build:docker`
hardened path (both framework plugins `COPY` it; ADR-044). Only its
production-deploy consumer goes away.

**3. `--env production` stays a typed, honest stub.**
`deployCommand` still throws `BusinessError('Production deployment not yet
implemented — planned as deploy-target plugins (ADR-062)', 'NOT_IMPLEMENTED')`.
The `--json` envelope and error contract for the reachable paths (development
deploy, development dry-run, unknown-environment `ValidationError`) are unchanged.
The only envelope change is that `--env production --dry-run` now throws the same
`NOT_IMPLEMENTED` error instead of returning a manifest plan for a feature that no
longer exists.

## Future direction — deploy as a manifest-driven, plugin-resolved target axis

When production deployment returns, it follows the framework-plugin model
(ADR-036), not inline codegen:

- **Config lives in the DSL manifest** (`@seans-mfe/dsl`), so the operator only
  sets configuration:

  ```yaml
  deploy:
    target: heroku          # resolves the plugin
    app: abc-kids-flappy    # non-secret, target-specific config
    size: standard-1x
  ```

  Secrets (e.g. `HEROKU_API_KEY`) come from the environment/CI, never the
  manifest, and are validated by the plugin (surfaced as
  `ValidationError` / `SecurityError`).

- **A `DeployTarget` plugin contract** mirrors `FrameworkPlugin`:
  `validateConfig()`, `plan()` (feeds `--dry-run` / the `--json` envelope),
  `deploy()`, and optional `status()` / `rollback()`. Targets ship as adaptor
  packs — `@seans-mfe/deploy-heroku`, `@seans-mfe/deploy-fly`,
  `@seans-mfe/deploy-cloud-run`, `@seans-mfe/deploy-k8s` — which is the
  "marketplace of domain-capability packages" thesis (PDR-004, PDR-006) applied
  to the deploy axis.

- **The command stays thin and target-agnostic:** parse manifest →
  `loadDeployPlugin(manifest.deploy.target)` → build the image by **reusing
  `build:docker`** (the existing hardened, ADR-036 Dockerfile) →
  `target.deploy(image, cfg)`. Swapping Heroku → Fly is a one-word manifest
  change plus a different plugin; core does not change.

This is not new architecture — it is the existing extension pattern (ADR-036 /
ADR-022) applied to a new axis. Removing the hardcoded generators now clears the
seam for it rather than entrenching the pattern the future model replaces.

## Consequences

- **Positive:** `deploy.ts` drops from 822 → ~330 LOC; four production-only
  template files and the `kubernetes/` template directory are removed; the
  command's public surface stops advertising an unimplemented capability; the
  future deploy model has a documented blueprint.
- **Negative / accepted:** production-manifest generation is no longer available
  even as scaffolding until the plugin model lands. This is acceptable because it
  was unreachable from the CLI, its only platform-specific value already lives in
  `build:docker`, and its replacement is specified above. The tests that covered
  the removed generators (`deploy-docker-plugin.test.ts`; the `productionDeploy` /
  `dockerComposeProductionDeploy` / `kubernetesProductionDeploy` and
  production-dry-run blocks in `deploy.test.js` / `deploy.extras.test.ts`) are
  removed with the code they characterized.
- **Contract note:** removing the production-only flags changes the generated
  `schemas/` for `deploy`; the schema is regenerated in the same change.

## Alternatives considered

- **Wire the generators up to `--env production`.** Rejected — that ships a
  single hardcoded two-target pattern as the platform's deploy story, entrenching
  the anti-pattern this ADR removes, and adds a feature (out of RESTRUCTURE
  scope).
- **Keep the generators exported-but-dead.** Rejected — maintaining tested code
  no user can reach is the "dead branch" cost the RESTRUCTURE-PLAN targets.
- **Move the generators into a package now.** Rejected — premature; there is no
  consumer, and the future model (manifest-driven plugin targets) has a different
  shape than "a library of manifest string builders."
