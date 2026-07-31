# The Base-Class System: Architecture and a Live Demo

A companion to [`docs/runtime-class-hierarchy.md`](../runtime-class-hierarchy.md)
(which was stale — corrected in this same change — and stays the quick-reference
doc) and the [core-ideas demo runbook](./core-ideas-demo-runbook.md) (which covers
codegen/manifest workflows; this one is scoped to the runtime base class an
app developer's generated MFE actually extends). Every command and every line
of output below was actually run in a scratch directory while writing this
doc — nothing here is a prediction.

## Why a base class at all — the architecture, not just the API

The platform's founding decision (PDR-001, "generate MFEs from a manifest;
don't hand-write them") only covers the *scaffold*. The base class is the
other half of that decision: it's what makes the scaffold's promise — "every
MFE speaks the same 10-capability contract" — true by construction rather
than by convention. An MFE author cannot forget to implement `health()` or
get the state machine wrong, because the only thing they write is a class
that `extends` something which already has those things.

The system is built around one governing idea, stated as ADR-056's "polyglot
VM model": **an MFE is a sealed, framework-opaque unit.** A host never reaches
inside an MFE to know it's built with React, and an MFE never assumes
anything about the host's framework either. Only two things cross that
boundary: a neutral capability contract (`load`, `render`, `query`, ...) and
a presentation handle. Everything else — how loading actually happens, how a
component actually mounts — is sealed on the MFE's side of the line. The
class hierarchy is that boundary, expressed as inheritance:

```
BaseMFE          — the contract: 10 capabilities, a 6-state machine, a
                    lifecycle-hook engine, dependency injection. Framework-
                    and deployment-neutral; could be Python, Go, Rust.
  └── BaseRemoteMFE  — Module Federation's *mechanics* (load in 3 phases,
       |                telemetry checkpoints), still framework-neutral.
       └── RemoteMFE     — the one place allowed to import React. Mounts
                           components, nothing else.
              └── YourMFE    — generated, per manifest. Domain capabilities
                               and lifecycle hooks only.
```

Each arrow downward adds exactly one kind of knowledge and no more: Layer 2
knows "Module Federation" but not "React"; Layer 3 knows "React" but not
"your domain"; Layer 4 knows your domain but re-implements none of the
infrastructure above it. A CI test
(`packages/runtime/src/__tests__/boundary.test.ts`) enforces the React
quarantine mechanically — it isn't a convention, it's checked.

**The other load-bearing idea is that every capability call goes through the
same pipeline, not through per-method logic.** `BaseMFE.executeCapability()`
is a fixed middleware onion — `stateGuard → stateTransition → errorBoundary(lifecycle-before → lifecycle-main(doX) → lifecycle-after)` —
and *what varies per capability* (which states are legal to call it from,
what state it enters/exits) is data read from `@seans-mfe/contracts`
(ADR-080), not fifteen slightly-different hand-written methods. This is why
the state machine can't be quietly bypassed by one capability implementation
forgetting a check: there's only one place the check lives.

**The pattern app-developer code actually uses is composition, not
inheritance — and this is worth being explicit about, because the generated
class *offers* an inheritance-shaped extension point (domain-capability stub
methods) that the codebase's own real examples consistently don't use.**
Looking at `examples/meridian-station/meridian-console`: the generated
`mfe.ts`'s `AnalyzeUsage`-style stub method is not where `StationConsole`'s
real behavior lives. It lives in a plain React component,
`src/features/StationConsole/StationConsole.tsx`, which imports the
generated class's singleton *instance* (`mfe`, built once in generator-owned
`bootstrap.ts`) and calls an inherited method on it directly:

```tsx
// StationConsole.tsx — developer-owned
import { mfe } from '../../platform/base-mfe/bootstrap';
const cp = mfe as unknown as ControlPlane; // narrow view of an inherited capability
void cp.updateControlPlaneState({ requestId: ..., inputs: { stateKey } });
```

So the honest shape of "extend vs. consume" is: **the class hierarchy is
extended exactly once, by codegen, in a file you don't edit. Your code
consumes the resulting instance's inherited public API.** The demo below
tests this claim directly rather than just asserting it.

---

## The demo

```bash
cd seans-mfe-tool && npm run build
SCRATCH=$(mktemp -d) && cd "$SCRATCH"
```

### 1 — generate, selecting React

```bash
node /path/to/seans-mfe-tool/bin/run.js remote:init widget-analyzer --framework react --skip-install --no-interactive
```

Add one domain capability and one platform lifecycle hook to the manifest
(the minimum needed to see both generated extension points):

```yaml
capabilities:
  - AnalyzeUsage:
      type: domain
      description: Render a usage summary for this widget
  - Load:
      type: platform
      lifecycle:
        before:
          - onLoadBegin:
              handler: onLoadBegin
              description: Confirm required widget config is present before MF machinery runs
```

```bash
cd widget-analyzer && node /path/to/seans-mfe-tool/bin/run.js remote:generate
```

### 2 — what's inherited vs. what's a stub

The generated `src/platform/base-mfe/mfe.ts` opens with a JSDoc block —
generated per manifest, not boilerplate — that names every one of the 10
inherited capabilities and, separately, exactly the domain capabilities this
manifest declared:

```
* @extends RemoteMFE — ALL 10 platform capabilities are INHERITED, not re-implemented:
*   load()  render()  refresh()  authorizeAccess()  health()  describe()
*   schema()  query()  emit()  updateControlPlaneState()
* DOMAIN CAPABILITIES (this MFE's business logic — implement below):
*   AnalyzeUsage() — Render a usage summary for this widget
```

Below that: a constructor that only forwards `manifest` (more on this in
Finding 2), pre-stubbed `doLoad`/`doRender` overrides that call `super` first
and log, a generated `AnalyzeUsage()` stub returning `{}`, and a generated
`onLoadBegin()` lifecycle-hook stub. That's the entire generated surface —
nothing else in the file is yours to fill in.

### 3 — the lifecycle, live

Installed dependencies (`@seans-mfe-tool/runtime` pointed at this repo's
built `dist/runtime` via a `file:` reference — it isn't published to a
registry) and ran a small driver script against the generated class through
a minimal jsdom DOM. Real output, trimmed:

```
=== STEP 1: bootstrap.ts already called load() on import ===
[widgetanalyzerMFE][before][onLoadBegin] { requestId: 'bootstrap-load-...', capability: 'load', phase: 'before' }
[widgetanalyzerMFE][doLoad] loading remoteEntry=http://localhost:3001/remoteEntry.js
[widgetanalyzerMFE][doLoad] ready — components=[ 'AnalyzeUsage' ] duration=0ms
state after load: ready

=== STEP 2: render() — mounts AnalyzeUsage into a real DOM node ===
[widgetanalyzerMFE][doRender] result=rendered duration=1238ms

=== STEP 3: query() — no data: in the manifest (ADR-070) ===
query result: {"data":null}

=== STEP 4: updateControlPlaneState() — no daemon WebSocket attached ===
control-plane result: {"acknowledged":false,"correlationId":"demo-cp-1","error":"Daemon WebSocket not connected"}

=== STEP 5: the state machine rejects calls out of order ===
fresh instance state (never loaded): uninitialized
render correctly rejected: Invalid state: expected ready, got uninitialized
```

Every one of those is `BaseMFE`/`BaseRemoteMFE` behavior the generated class
never wrote: the `before`-phase hook firing ahead of the MF machinery, the
3-phase load, `query()`'s uniform no-BFF contract (ADR-070 — a widget with no
`data:` gets `{data: null}`, never a throw), `updateControlPlaneState()`
degrading gracefully with no daemon attached rather than crashing, and the
state guard rejecting `render()` on a freshly-constructed, never-loaded
instance with a precise error rather than a null-pointer surprise three
frames deeper.

### 4 — the ownership guardrail

Hand-edited the generated `AnalyzeUsage()` stub to return real-looking data
and log a marker line, then ran `remote:generate` again with no manifest
change:

```
✓ Generated files: ... src/platform/base-mfe/mfe.ts ...
```

```bash
grep HAND-EDITED src/platform/base-mfe/mfe.ts   # → no matches
```

Gone — reverted to the original stub. `mfe.ts` is `overwrite: true`; every
`remote:generate` re-stamps it from the manifest regardless of what's on
disk. This is the concrete cost of the inheritance-shaped extension point
mentioned above: editing the generated class's method bodies directly does
not survive. It's *why* real examples in this codebase delegate to feature
components instead — those are `overwrite: false` and actually yours.

As a bonus, the very same regenerate run also demonstrated the
generic package-dependency-drift warning from this session's earlier
work — pointed at exactly what it's for:

```
⚠ package.json is out of date with what the template would generate (1 dependency):
  mismatched devDependencies."@seans-mfe-tool/runtime": "file:/home/.../dist/runtime" → "^0.1.0"
```

(That's the demo's own `file:` override for local testing, correctly flagged
against what a real install would declare — not a bug.)

### 5 — can you extend the hierarchy directly, bypassing codegen?

Yes, technically — nothing in the export surface stops you. Wrote a
hand-authored file, never touched by codegen, that does
`class HandWrittenMFE extends RemoteMFE`:

```
[HandWrittenMFE] this class was never generated — no manifest describes it
It compiled, instantiated, and ran: loaded — state: ready
```

It works. What it doesn't get is everything the manifest-driven path buys
you for free: nothing for `mfe:validate` to check it against, nothing for
`check:mfe-drift` to compare (there's no manifest-declared shape to diff),
no `bootstrap.ts`/`remote.tsx` presentation handle a host could compose it
through. The class hierarchy enforces the *capability contract*; it does not
and cannot enforce that you got there via the manifest pipeline. That
enforcement is a separate, deliberate layer (`mfe:validate`,
`check:mfe-drift`, both covered in
[`gate-self-verification-audit.md`](./gate-self-verification-audit.md)) —
worth naming explicitly so "can I extend it directly" has an honest answer:
technically yes, architecturally you'd be opting out of everything else the
platform checks for you.

---

## Two findings from actually running this

### Finding 1 — a lifecycle hook's generated method name and its runtime lookup name can silently disagree

The manifest's lifecycle-hook entry has two names in play: the YAML key
(`onLoadBegin` above) and the `handler:` field
(`packages/dsl/src/schema.ts`'s `LifecycleHookSchema` requires `handler`,
nothing constrains it to equal the parent key). Codegen names the generated
stub method after the **key** (`packages/codegen/src/unified-generator.ts`:
`lifecycleHooks.push({ name: hookName, ... })` where `hookName` comes from
`Object.entries(hookEntry)`). The runtime resolves a `custom.*` handler by
the **`handler:` field** (`packages/runtime/src/base-mfe.ts`'s
`executeLifecycle`/`invokeCustomHandler`, which looks for
`(this as any)[hookConfig.handler]`).

Every real example in this codebase keeps the two identical
(`onLoadBegin: { handler: onLoadBegin }`), so this has never surfaced. Setting
them to different values (as this demo did on the first pass, before
correcting it) reproduces it directly:

```
"error": {
  "message": "Custom handler not found: validateWidgetConfig. Either implement
              a method on your MFE class ... or declare a source module ..."
}
```

The failure is non-fatal by default (reported as a `warn`-severity telemetry
event, load still completes) — which is exactly why it's easy to ship
unnoticed: the hook's logic silently never runs, and nothing in
`mfe:validate`'s seven rules checks handler/key agreement. Worth a follow-up
issue: either codegen should name the generated method after `handler:`
instead of the key, or `mfe:validate`/`check:adr`-style tooling should flag a
declared hook whose `handler:` doesn't resolve to a method the generated
class will actually have.

### Finding 2 — the telemetry DI seam is real on `BaseMFE` but unreachable from generated code as generated

This directly answers the logging question from earlier in this session.
`BaseMFE`'s constructor accepts `deps: BaseMFEDependencies = {}`, and
`BaseRemoteMFE` already calls `this.emitTelemetry(...)` at every lifecycle
checkpoint (`load-entry`, `load-mount`, `render-start`, ...) — silently
no-op'ing when nothing is injected. That's the sanctioned "how do I get
visibility into what the base class is doing" mechanism, and it already
exists; **no change to `packages/runtime` is needed to use it.**

But the generated constructor doesn't expose it:

```ts
constructor(manifest: any) {
  super(manifest);   // deps is never accepted, never forwarded
}
```

```
First, the sanctioned attempt: does the generated constructor forward a second arg to BaseMFE?
  deps on an instance built that way: {}
  -> the second constructor argument was silently discarded.
```

`bootstrap.ts.ejs` — the only place a generated MFE is ever constructed —
never passes a second argument either. The only way this demo got telemetry
output was reaching past `protected readonly deps` with an `as any` cast
after construction, which is not a sanctioned API — it works only because TS
access modifiers don't exist at runtime:

```ts
const instrumented = new widgetanalyzerMFE(manifest);
(instrumented as any).deps = { telemetry: { emit: (e) => console.log(...) } };
```

```
  [telemetry] load-entry               phase=entry          status=start
  [telemetry] load-entry-metric        phase=entry          status=success
  [telemetry] load-mount               phase=mount          status=start
  ...
```

Once reached, it works exactly as designed — full visibility into every
lifecycle checkpoint, for free, using zero new logging code.

**Recommendation, not yet built:** rather than adding new dev-mode logging
to `BaseMFE` (which would be new surface, and CLAUDE.md's "no `console.log`
in production code, use the structured logger" rule doesn't actually apply
cleanly here — the structured logger lives in `@seans-mfe/oclif-base`, a
Node/CLI-only package that must never enter a browser bundle, confirmed
during this session's research), the smaller and more consistent fix is in
**codegen**: have the generated constructor accept and forward an optional
`deps` parameter, and have `bootstrap.ts.ejs` construct a lightweight
console-based `TelemetryService` when some dev signal is on (a manifest flag,
or gated by `NODE_ENV !== 'production'`) — reusing the seam that already
exists rather than inventing a new one. This is a template-only change
(`packages/codegen/templates/base-mfe/{mfe.ts.ejs,bootstrap.ts.ejs}`), not a
`packages/runtime` change, and it's exactly the kind of decision this
project's own governance rules ask to be raised before building, not after —
so raising it here rather than building it. Happy to scope and build this in
a follow-up if you want it.

---

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` — unaffected; this session's
  demo work touched no repo source, only `docs/runtime-class-hierarchy.md`
  (corrected paths/layers/`doQuery` description) and this new doc.
- The scratch MFE's own generated tests pass out of the box:
  `npx jest` → `2 passed, 2 total` (`mfe.test.ts`, `AnalyzeUsage.test.tsx`).
- Re-running the driver script end to end exits `0` with every step's output
  matching what's quoted above — safe to run again from a clean checkout.
