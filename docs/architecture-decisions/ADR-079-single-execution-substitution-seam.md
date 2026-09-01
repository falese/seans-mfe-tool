---
id: 0079
title: There is one seam for substituting handler execution, and it sits inside the lifecycle contract
status: Implemented
date: 2026-07-26
deciders: [sean]
area: Runtime / lifecycle / dependency injection
enforcement: code
tags: [runtime, lifecycle, hooks, dependency-injection]
relates-to: [2, 40, 41, 28]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/runtime/src/base-mfe.ts
  - packages/runtime/src/mfe-dependencies.ts
verified-by:
  - packages/runtime/src/__tests__/lifecycle-executor.test.ts
  - packages/runtime/src/__tests__/base-mfe.coverage.test.ts
summary: >-
  `BaseMFE` had two dependency-injection seams for substituting lifecycle execution.
  `deps.customHandlers` sits inside `executeHook` and therefore inside ADR-002's guarantees;
  `deps.lifecycleExecutor` sat around the whole phase loop and skipped all of them. The second is
  deleted. Substituting execution means providing a handler, not replacing the engine.
rationale-summary: >-
  The two seams were not complementary — the outer one could only be used by re-implementing
  containment, mandatory ordering, handler arrays and telemetry, correctly, outside the class that
  owns them. Nothing ever used it, its declared type disagreed with what it was actually passed
  for months without detection, and its per-entry call shape forecloses the parallel execution
  (ADR-028) it would most plausibly serve.
long-form: true
---

# ADR-079: One seam for substituting handler execution

## Context

`BaseMFEDependencies` carried two ways to intervene in lifecycle execution.

**`deps.customHandlers`** is consulted inside `invokeHandler`, which is called by `executeHook`:

```ts
const injected = this.deps?.customHandlers?.[handlerName];
```

Every generated MFE already uses it — both template trees emit
`super(manifest, { customHandlers: handlerRegistry })` — and ADR-040's manifest-declared handler
sources depend on it.

**`deps.lifecycleExecutor`** wrapped the entire phase loop instead:

```ts
if (this.deps?.lifecycleExecutor) {
  for (const hookEntry of hooks) {
    await this.deps.lifecycleExecutor.execute(hookEntry, context, phase);
  }
  return;
}
```

Three things were wrong with it, and they compound.

**It bypassed ADR-002 entirely.** `executeHook` — which this branch never reaches — is where
handler arrays run sequentially (REQ-045), `contained: true` wraps invocation so failures do not
propagate, `main`-phase failures propagate while other phases continue, and every failure emits
telemetry regardless of flags. A substitute executor received a raw `{ hookName: config }` record
and had to re-implement all of it, correctly, or silently violate guarantees the platform
advertises.

**Its declared type was wrong, undetected.** The signature said
`execute(hook: LifecycleHook, …)` while the call passed a `LifecycleHookEntry` — a
`Record<string, LifecycleHook>`. The branch was untypechecked under the repo's then-`strict: false`,
and its two tests asserted `expect.any(Object)` and used `any`, which both shapes satisfy. It was
found only by enabling `strict` (ADR-077).

**Its shape forecloses its own best use case.** A phase-level executor is the natural home for
opt-in parallel handler execution (ADR-028, Proposed). But `execute` is called once per entry,
sequentially, awaited — so an executor can never see a phase whole and can never parallelise it.

Nothing outside tests ever supplied one. It is not re-exported from
`packages/runtime/src/index.ts`, so no consumer can even name the type.

## Decision

### 1. `lifecycleExecutor` is deleted

The interface, the optional dependency, and the branch. Lifecycle orchestration is not a
substitutable concern: `executeLifecycle` → `executeHookEntry` → `executeHook` is the ADR-002
contract, and it stays in `BaseMFE`.

### 2. `customHandlers` is the seam

Substituting execution means providing the handler that runs, not replacing the engine that runs
it. Because the substitution happens at the innermost call, every ADR-002 guarantee still applies
to it — containment, mandatory ordering, array semantics, telemetry — with no cooperation required
from the substitute.

### 3. A phase-level seam, if one is ever needed, arrives with the feature that needs it

ADR-028 would need to see a phase whole. That is a different shape from either of these, and
should be designed against the requirement rather than kept in reserve against a guess.

## Boundaries

This does not change `platformHandlers`, `manifestParser`, `stateValidator`, `telemetry`,
`errorHandler`, or `wsClient`. They inject *collaborators*; `lifecycleExecutor` replaced *control
flow*, which is the distinction being drawn.

It does not rule out parallel execution. It removes an extension point that could not have
delivered it.

No generated output changes. No template referenced `lifecycleExecutor`, and
`npm run check:mfe-drift:check` reports the same 21 MFEs with no generator-owned drift before and
after.

## Consequences

**Better.** One documented answer to "how do I substitute execution", and it is the one already
wired into every generated MFE. The lifecycle contract can no longer be bypassed by configuration.

**Better.** ~15 lines and an untested branch removed from the class that most needs to stay
legible. The two tests that covered it now assert something real: that hook entries run in
declared order through the surviving seam, and that `contained: true` still contains a failure
when execution is substituted — which the deleted branch would have skipped.

**Worse.** A future need for phase-level orchestration has to add a seam rather than use one.
Accepted: the seam that existed could not have served that need in its current shape, and
designing it against a real requirement will produce a better one.

**Neutral.** `packages/runtime` is not yet published (ADR-064, #252), so removing an exported
interface has no external blast radius today. Doing it before publication is deliberate.

## References

- ADR-002 — lifecycle hook execution model; the guarantees the deleted seam sat outside of.
- ADR-040 — manifest-declared handler sources, which depend on the `customHandlers` seam.
- ADR-041 — `BaseMFE` as an abstract base, the class this decision keeps coherent.
- ADR-028 — parallel handler execution; Proposed, and the use case a future phase-level seam
  would serve.
- ADR-077 — the two-headed giant's re-derived implementation plan, whose strict-mode pass
  surfaced the type mismatch.
- ADR-064 — runtime as a published package; not yet done, which is why this is cheap now.
