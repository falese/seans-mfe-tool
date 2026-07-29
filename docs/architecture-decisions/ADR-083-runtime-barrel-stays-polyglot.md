---
id: 0083
title: The runtime barrel carries no framework; the specialized abstracts live behind subpaths
status: Implemented
date: 2026-07-29
deciders: [sean]
area: Runtime / packaging / framework boundary
enforcement: code
tags: [runtime, packaging, framework, boundary, breaking-change]
relates-to: [34, 36, 43, 56, 82]
supersedes: []
superseded-by: []
implements-pdr: [6]
implemented-by:
  - packages/runtime/src/react.ts
  - packages/runtime/src/index.ts
  - packages/runtime/package.json
  - scripts/copy-runtime-files.js
verified-by:
  - packages/runtime/src/__tests__/boundary.test.ts
tracked-by: []
summary: >-
  RemoteMFE moves off the main runtime barrel to a '/react' subpath, mirroring the
  '/angular' subpath it has always had, so that importing any value from
  '@seans-mfe-tool/runtime' cannot pull a UI framework into a bundle that did not ask
  for one; a reachability test over the barrel's module graph enforces it.
rationale-summary: >-
  ADR-056 permits the framework-specialized abstracts to import React or Angular, and
  quarantines them at layer 5 — but the barrel re-exported one of them, so the
  quarantine leaked to every consumer the moment a template gained its first value
  import, breaking three Angular MFEs that have no React installed.
long-form: true
---

## Context

ADR-056 draws a bright line: the neutral core carries zero UI-framework
surface, and framework knowledge is quarantined in the specialized abstracts —
`RemoteMFE` (React) and `AngularRemoteMFE` (Angular) — which are *"deliberately
NOT scanned … they are allowed to import React / Angular precisely because they
produce the native handle."*

That is right, and it was undermined by one line in `packages/runtime/src/index.ts`:

```ts
export { RemoteMFE } from './remote-mfe';
```

The barrel re-exported a layer-5 abstract. So `@seans-mfe-tool/runtime`, the
package every generated MFE depends on and the only one they import, reached
`react` and `react-dom/client` transitively.

**This was invisible for as long as every consumer imported from the barrel
using `import type`.** Type-only imports are erased at compile time and emit no
require, so the framework edge existed in the module graph but nothing walked
it.

It stopped being invisible when #342 added the first *value* imports to
templates an Angular MFE emits — `ValidationError` in `mfe.ts.ejs`,
`NetworkError`/`BusinessError` in the BFF connector. Three Angular MFEs
(`meridian-docking-control`, `meridian-life-support`, `meridian-cargo-ops`)
then failed to bundle:

```
./node_modules/@seans-mfe-tool/runtime/remote-mfe.js:133:60-87
  Error: Can't resolve 'react-dom/client' in '/app/node_modules/@seans-mfe-tool/runtime'
```

An error naming a runtime file that none of their code mentions, for a
framework they do not use, triggered by importing a typed error class.

Two properties of the failure are worth recording, because they shaped this
decision:

- **`await import()` does not help.** `remote-mfe.ts` reaches React only through
  dynamic import, with a comment noting it is browser-only. Bundlers resolve
  dynamic specifiers statically in order to emit a chunk, so laziness at runtime
  buys nothing at build time.
- **Every gate was green.** `check:mfe-drift` compares bytes and the bytes were
  correct; `check:template-typecheck` runs `tsc`, which resolves types happily.
  Nothing in CI bundles an Angular MFE (#345), so the first thing to notice was
  a human running `docker compose build`.

## Decision

### 1. The barrel is polyglot

`@seans-mfe-tool/runtime` exports the neutral core only: `BaseMFE`, the typed
error hierarchy, contexts, handlers, the slot contract, layout, the
control-plane client. Any MFE, in any framework, can import any value from it
without receiving a framework in its bundle.

### 2. Each framework abstract lives behind its own subpath

```ts
import { RemoteMFE }        from '@seans-mfe-tool/runtime/react';
import { AngularRemoteMFE } from '@seans-mfe-tool/runtime/angular';
```

`/angular` already worked this way. `/react` is new, and the asymmetry — one
abstract on the barrel, one behind a subpath — was the whole defect. The rule
is now symmetric and stated: **a consumer opts into a framework by importing
its entry point, never as a side effect.**

Adding a framework means adding a subpath, consistent with ADR-036: new
framework support is a new plugin and template variant, never an edit to shared
neutral code.

### 3. Enforced by reachability, not by file

`boundary.test.ts` gains a walk over everything the barrel reaches through
relative imports, failing on any module that imports a UI framework and
printing the import trail rather than the leaf — the fix is to cut an edge of
the path, not to edit the file at the end of it.

The per-file scan ADR-056 already had could not have caught this: it asks
"does this file import React", and `RemoteMFE` is *supposed* to.

### 4. The existing scan was repaired in the same change

The `FRAMEWORK_IMPORT` pattern was `/(?:from|require\(\s*)['"](react|…)['"]/` —
no `\s*` before the quote, and no `import(` alternative. It therefore matched
`require('react')` and nothing else: not `from 'react'`, not
`await import('react')`. Neither form appears in this codebase for `require`,
so **the gate could not fail**.

A test that cannot fail is worse than no test, because it is cited as evidence.
This one was cited by ADR-056 as *"the bright line made machine-checked"*.

## Boundaries

- **This is a breaking public API change.** Any MFE outside this repo importing
  `RemoteMFE` as a value from the barrel must add `/react`. A
  `PLATFORM_MIGRATIONS` entry (`remote-mfe-subpath`, ADR-082) reports it with
  the fix; it matches value imports only, since type-only imports never emitted
  a require and were never broken.
- **`remote-mfe.ts` keeps importing React.** That is ADR-056 layer 5 working as
  designed. Nothing about the module changed except who can reach it.
- **The dynamic imports stay dynamic.** They are not the defect and making them
  static would not change bundler behaviour. Revisit only if the runtime ever
  ships pre-bundled.
- **No `/vue`, `/svelte` subpath is created speculatively.** ADR-036 says a
  framework arrives as a plugin; its entry point arrives with it.

## Consequences

**Better.** An Angular MFE can import a typed error without acquiring React.
The barrel's neutrality is now a property the build checks rather than a
convention nobody was measuring, and the repaired scan means ADR-056's other
claims are enforced for the first time.

**Worse.** One more public entry point to document and keep in two exports maps
(`packages/runtime/package.json` and the generated one in
`scripts/copy-runtime-files.js`) — a duplication that will drift eventually and
has no gate. And every existing React MFE outside this repo needs a one-line
edit.

**The cost accepted.** Fixing this at the barrel rather than routing the Angular
templates around it is the larger change — it touches the platform's primary
public API and every React MFE. The alternative, re-exporting error classes
from `/angular`, would have left the barrel framework-coupled and the next
value import would have hit the same wall from a different direction.

## References

- ADR-056 — the boundary this restores; its layer-5 exemption is correct and
  was leaking through the barrel.
- ADR-036 — framework support as plugins; a new framework brings its own entry
  point rather than editing neutral code.
- ADR-082 — the migration registry that reports this in code the generator does
  not own.
- ADR-043 — regeneration reaches `mfe.ts` (generator-owned), which is why the
  in-repo fleet needed only `check:mfe-drift`.
- #342 — the change whose first value import surfaced this.
- #345 — nothing in CI bundles or composes an MFE, which is why a human found it.
