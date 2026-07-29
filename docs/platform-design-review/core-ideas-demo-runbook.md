# Core Ideas Demo Runbook

A repeatable, scratch-directory walkthrough of five use cases that together
show the platform's core ideas in action: manifest-driven codegen, the
generator/developer ownership split, idempotent regeneration, ADR-082
migration surfacing, and — honestly, warts included — what it takes to bring
a pre-existing, non-standardized MFE under the platform's contract. Every
command below was actually run against this repo while writing this doc —
output is trimmed but not paraphrased.

Nothing here is committed to the repo. It runs entirely in a scratch
directory and ends with cleanup, so it's safe to run again from a clean
checkout at any time.

## Setup

```bash
cd seans-mfe-tool
npm run build                 # dist/, oclif manifest, dist/runtime
SCRATCH=$(mktemp -d)
```

The CLI is invoked as `node bin/run.js <command>` throughout (the published
Node entry point) rather than installed globally, so this works from any
checkout without a global install.

---

## Use case 1 — scaffold a new MFE, no BFF

```bash
cd "$SCRATCH"
node /path/to/seans-mfe-tool/bin/run.js remote:init demo-widget --framework react --skip-install --no-interactive
```

**What correct looks like:** `demo-widget/mfe-manifest.yaml` is written with
no `data:` key at all — `remote:init`'s `createMinimalManifest()` never
populates it, so a scaffold has no BFF by construction, not because a flag
suppressed one.

```bash
cd demo-widget
node /path/to/seans-mfe-tool/bin/run.js remote:generate
```

**What correct looks like:** 16 files generated — `src/remote.tsx`,
`src/platform/base-mfe/*`, `package.json`, bundler config, `src/App.tsx`,
`src/index.tsx`, `public/*` — and no `server.ts`, no `.meshrc.yaml`, no
`src/platform/bff/`. Confirm:

```bash
node /path/to/seans-mfe-tool/bin/run.js mfe:validate . --json
# {"ok":true,"data":{...,"issues":[]},...}
```

## Use case 2 — add a data source, regenerate

Add a `data.sources` entry (shape borrowed from
`examples/meridian-station/meridian-concourse/mfe-manifest.yaml`), pointing
at a trivial local OpenAPI spec:

```bash
mkdir specs
cat > specs/widget-api.yaml <<'EOF'
openapi: 3.0.0
info: { title: Widget API, version: 1.0.0 }
paths:
  /widgets:
    get:
      operationId: GetWidgets
      responses:
        '200': { description: OK }
EOF

cat >> mfe-manifest.yaml <<'EOF'

data:
  sources:
    - name: WidgetAPI
      handler:
        openapi:
          source: ./specs/widget-api.yaml
  serve:
    endpoint: /graphql
    playground: true
EOF

node /path/to/seans-mfe-tool/bin/run.js remote:generate
```

**What correct looks like:** the BFF layer materializes wholesale in one run —
`.meshrc.yaml`, `src/platform/bff/{bff.ts,bff.test.ts,mesh-context.js}`,
`server.ts`, `Dockerfile`, `docker-compose.yaml`, `README.md` all appear as
newly **Generated**. The CLI's own output names the ownership split directly:

```
Kept (developer-owned):
  tsconfig.json
  package.json
  rspack.config.js
  src/App.tsx
  src/index.tsx
  __mocks__/fileMock.js
  Yours to edit — regeneration never overwrites these
```

`package.json` is *not* touched — but not because there's no template logic
for it. `packages/codegen/templates/base-mfe/package.json.ejs` is fully
BFF-aware: its `hasBff` branch renders the complete Mesh dependency set
(`@graphql-mesh/serve-runtime`, `express`, `cors`, `helmet`,
`@graphql-tools/{delegate,utils,wrap}`, `tslib`, `@seans-mfe-tool/runtime`,
the right `scripts.dev`/`build`) and *every* `remote:generate` computes that
content correctly, `data:` or not. The reason it never reaches disk is a
write-time policy, not a rendering gap: `writeGeneratedFiles`
(`packages/codegen/src/unified-generator.ts`) skips *any* file that already
exists and is marked `overwrite:false`, and `package.json` is marked that way
deliberately (an MFE author edits it — extra deps, custom scripts, version
pins — as a matter of course). So the platform computes the exactly correct
`package.json` on every run and then used to discard it silently.

It no longer does so silently. Right below the "Kept (developer-owned)" list,
the same run now prints:

```
⚠ package.json is out of date with what the template would generate (18 dependencies):
  missing    dependencies."@graphql-mesh/serve-runtime": "^1.2.4"
  missing    dependencies."@graphql-tools/delegate": "^10.2.4"
  ...
  missing    devDependencies."@graphql-mesh/cli": "^0.100.21"
  missing    devDependencies."concurrently": "^8.2.0"
  package.json is developer-owned, so this was not applied for you — update by hand, then npm install.
```

This is deliberately **generic**, not BFF-specific: `reportPackageDependencyDrift`
(`src/commands/remote/generate.ts`) doesn't re-derive an expected dependency
list by hand at all. `generateAllFiles` already renders `package.json.ejs`'s
full output before `writeGeneratedFiles` decides to skip it — that render is
`allFiles`, sitting right there — so the reporter diffs that real render
against the real on-disk content via `diffPackageDependencies`
(`packages/codegen/src/package-dependency-diff.ts`), for `dependencies` and
`devDependencies` alike. It reports two kinds of finding, not just one:
`missing` (the template wants a package that isn't declared at all) and
`mismatched` (declared, but at a different version than the template would
write — e.g. a stale `react` pin). Because it reads the template's own
output, it's automatically correct for *anything* the template controls —
framework version pins, design-system deps, build tooling, Angular's package
set — not only the Mesh/BFF deps this use case happens to add; a `data:`
manifest just makes for a large, legible example. Nothing the developer added
on their own (an extra `lodash`, say) is ever flagged — only packages the
render actually asks for. Add what's listed and the warning goes quiet, the
same "goes quiet when they fix it" shape as ADR-082's `platform-migrations`
warning right above it in the same output. To fully typecheck you'll still
need the `@graphql-mesh/cli`/`@graphql-mesh/openapi` devDependencies (both in
the printed list) plus a `mesh build` to materialize `./.mesh`'s generated
types — the warning tells you what to add, not how to finish standing up the
BFF.

Confirm the fresh generation is itself drift-free:

```bash
cd ..  # repo root
npm run check:mfe-drift:check -- "$SCRATCH/demo-widget"
# OK    .../demo-widget
# 1 MFE(s) checked — no generator-owned drift.
```

## Use case 3 — add a new platform feature via manifest, regenerate

Add a `providesSlots` entry:

```bash
cd "$SCRATCH/demo-widget"
cat >> mfe-manifest.yaml <<'EOF'

providesSlots:
  - id: main
    description: Primary widget region
EOF
node /path/to/seans-mfe-tool/bin/run.js remote:generate
```

**What correct looks like:** `src/slots.tsx` appears, generator-owned, and
includes a template-literal union type derived straight from the manifest
(ADR-072):

```ts
export type DeclaredSlotId = 'main';
```

Wire it into developer-owned `src/App.tsx`:

```tsx
import { DeclaredSlot } from './slots';
// ...
<DeclaredSlot id="main">
  <p>Primary widget region content.</p>
</DeclaredSlot>
```

`node /path/to/seans-mfe-tool/bin/run.js mfe:validate . --typecheck --json`
reports `typecheck: {ran:true, ok:true}` — a manifest-declared feature is a
type, not a convention. Now typo the id:

```tsx
<DeclaredSlot id="mian">
```

```
✗ typecheck
    src/App.tsx(8,21): error TS2322: Type '"mian"' is not assignable to type '"main"'.
```

**What correct looks like:** a stale slot reference is a compile error at the
exact call site, not a runtime throw discovered later. Revert the typo before
continuing.

(To reproduce `--typecheck` exactly, `npm install` in the scratch MFE first,
pointing `@seans-mfe-tool/runtime` at a `file:` dependency on the repo's
built `dist/runtime` — it isn't published to a registry. If you added
`data:` in use case 2 and haven't finished installing the Mesh deps per that
section's note, temporarily move `server.ts` aside before running
`--typecheck` so its unrelated missing-dependency errors don't obscure this
one; move it back afterward.)

## Use case 4 — modify a platform feature, regenerate

Two halves: what regeneration *can* propagate automatically, and what it
*can't* — surfaced instead as an ADR-082 warning.

### 4a — a generator-owned file changes; regeneration propagates it

```bash
cd /path/to/seans-mfe-tool
# edit packages/codegen/templates/base-mfe/mfe.ts.ejs: add one JSDoc line
#   * @see docs/some-doc.md — example propagation probe
cd "$SCRATCH/demo-widget"
node /path/to/seans-mfe-tool/bin/run.js remote:generate
grep '@see' src/platform/base-mfe/mfe.ts
```

**What correct looks like:** the new line appears in `demo-widget`'s
generated `mfe.ts` immediately, with no edit to `demo-widget` itself — this
is ADR-043's idempotent-regeneration property: the template is the source of
truth, `overwrite:true` files are re-stamped every run, and every MFE built
from that template inherits the change on its next `remote:generate`. Revert
the template edit afterward — it was only a probe.

### 4b — a developer-owned file uses something the platform changed; ADR-082 surfaces it

Reintroduce a pre-ADR-017 pattern into `src/index.tsx` (developer-owned):

```ts
throw new Error('Root element not found');   // was: throw new SystemError(...)
```

```bash
node /path/to/seans-mfe-tool/bin/run.js mfe:validate .
```

```
  ⚠ platform-migrations
      - Throwing a raw `Error` — the platform classifies failures by error
        type, so this is reported as `unknown` and never retried (ADR-017)
        src/index.tsx:64
        fix: Throw a typed error from '@seans-mfe-tool/runtime': ValidationError
        (bad input), BusinessError (precondition), NetworkError (transport,
        carries the status), SystemError (environment), SecurityError, TimeoutError

demo-widget is consistent, with 1 platform-migration warning(s).
```

**What correct looks like:** file, line, and a concrete fix, at generation
time and at validate time — contrast this with the original incident this
platform is built on (`breaking-change-regeneration-dx-report.md`): before
ADR-082, this exact pattern was invisible to every gate in the box. Now,
because `typed-errors` is a *declared* entry in
`packages/codegen/src/platform-migrations.ts`, it surfaces automatically.
(See `gate-self-verification-audit.md` for what happens when a breaking
change reaches developer-owned code *without* a declared entry — the same
code, with the registry entry removed, is invisible again. That's ADR-082's
stated boundary, not a bug.)

Revert the `throw new SystemError(...)` line back before moving on.

## Use case 5 — true up a non-standardized MFE

Everything so far starts from a manifest. This one doesn't: a pre-existing,
hand-written React remote, plain webpack + `ModuleFederationPlugin`, no
`mfe-manifest.yaml`, never touched by this CLI. There is no
`remote:adopt`/`mfe:import` command — searched the whole `src/commands/**`
tree while preparing this and confirmed none exists, and no ADR or doc
proposes one. ADR-082 says as much directly: *"This does not migrate
anything. It reports."* "Truing up" an existing MFE means composing the
primitives every other use case already used: write the manifest by hand,
`remote:generate`, close what `mfe:validate` reports. This section is that
loop end to end, including the two places it doesn't go smoothly.

Start from a legacy remote with no manifest:

```
legacy-widget/
  package.json          # react ^18.0.0, webpack devDeps, no @seans-mfe-tool/runtime
  webpack.config.js      # ModuleFederationPlugin: name legacy_widget, exposes ./App
  public/index.html      # hand-written
  src/App.tsx
  src/index.tsx
```

```bash
node /path/to/seans-mfe-tool/bin/run.js mfe:validate legacy-widget
```

```
ValidationError: Invalid or missing mfe-manifest.yaml in .../legacy-widget:
No manifest found in .../legacy-widget. Expected one of: mfe-manifest.yaml,
mfe-manifest.yml, .mfe-manifest.yaml, .mfe-manifest.yml
exit=64
```

**What correct looks like:** a clear, specific error and a stable exit code
(64 = validation), not a crash — the platform has an opinion about MFEs it
doesn't recognize, and states it plainly.

Hand-write the minimal manifest that describes what already exists:

```yaml
name: legacy-widget
version: 0.3.1
type: remote
language: typescript
framework: react
description: Hand-written MFE, adopted into the manifest system
endpoint: http://localhost:3099
remoteEntry: http://localhost:3099/remoteEntry.js
capabilities: []
dependencies:
  runtime:
    react: ^18.0.0
    react-dom: ^18.0.0
```

`framework: react` is doing real work here, not documentation. `deriveBuiltinVariant`
picks the framework from `manifest.framework`, falling back to Angular if
`bundler: webpack` is set without it (`unified-generator.ts`) — so a
same-shaped manifest with `bundler: webpack` instead of `framework: react`
would silently generate this MFE as Angular. Then regenerate:

```bash
cd legacy-widget
node /path/to/seans-mfe-tool/bin/run.js remote:generate
```

```
✓ Generated files:
  src/remote.tsx, src/platform/base-mfe/{mfe.ts,bootstrap.ts,mfe.test.ts,types.ts},
  rspack.config.js, tsconfig.json, .gitignore, .dockerignore,
  public/{index.html,demo.html,favicon.ico}, __mocks__/fileMock.js

Kept (developer-owned):
  package.json
  src/App.tsx
  src/index.tsx
```

**Two things worth stopping on, not glossing over:**

1. **The hand-written `public/index.html` is gone**, replaced by the
   platform's template. `public/index.html` is generator-owned
   (`overwrite:true`) — the ownership split protects `App.tsx`/`index.tsx`/
   `package.json`, but it was never scoped to "anything that already
   existed." Anything generator-owned in a directory that predates the
   manifest gets silently re-stamped on the first `remote:generate`, same as
   it would on the hundredth.
2. **`webpack.config.js` is untouched — and a brand-new `rspack.config.js`
   now sits next to it.** The generator doesn't detect, read, or reconcile
   an existing bundler config; the react/rspack variant is hard-wired
   (`unified-generator.ts`'s variant selection branches only on
   `angular-webpack` vs. everything else, which always means rspack). Two
   competing federation configs — one hand-written, one generated — now
   coexist, and nothing warns about it.

`mfe:validate legacy-widget` at this point reports 13 problems — all in the
developer-owned files the generator correctly declined to touch:
`react-pinned` (react `^18.0.0` vs. platform `~18.2.0`), `manifest-package-sync`
and `shared-declared` (the newly generated `rspack.config.js` shares MUI/emotion
by platform default, none of which the hand-written `package.json` or
`webpack.config.js` ever declared), and `runtime-declared`
(`@seans-mfe-tool/runtime` missing). This is the actual "truing up" work, and
it's manual by design — the same "generator seeds once, developer finishes"
contract every other use case in this runbook already demonstrated.

Closing it means accepting what `framework: react` already implied: the
generated `rspack.config.js` is the build going forward, not the old
`webpack.config.js`. Delete `webpack.config.js` and its now-unused devDeps,
pin `react`/`react-dom` to `~18.2.0`, add `@seans-mfe-tool/runtime` and the
MUI/emotion deps the generated federation config already shares, and update
`scripts.dev`/`scripts.build` to call `rspack` instead of `webpack`:

```bash
node /path/to/seans-mfe-tool/bin/run.js mfe:validate legacy-widget
```

```
  ✓ react-pinned
  ✓ manifest-package-sync
  ✓ shared-declared
  ✓ shared-version-sync
  ✓ runtime-declared
  ✓ platform-migrations

legacy-widget is consistent.
```

**What correct looks like:** clean, and `check:mfe-drift:check` against the
same directory reports no drift — this MFE is now indistinguishable, to
every gate in the platform, from one that was `remote:init`-scaffolded from
day one. Nothing here required new tooling; it required reading what
`mfe:validate` reported and doing the work it named. That the platform
doesn't pretend to do this automatically is consistent with ADR-082's stated
position — it reports, it doesn't rewrite code it doesn't own — but it's a
real gap that only shows up when you actually try this: there's no
`--dry-run`-style preview of *which* generator-owned files in an
already-populated directory are about to be silently replaced, and nothing
flags a second bundler config appearing next to a first. Worth a follow-up
issue, not fixed in this pass.

## Cleanup

```bash
rm -rf "$SCRATCH"   # covers demo-widget (use cases 1-4) and legacy-widget (use case 5)
```

Nothing in this walkthrough touches the repository itself — `git status` at
the repo root should be unchanged by running it (aside from any template
edit you made and reverted in step 4a).
