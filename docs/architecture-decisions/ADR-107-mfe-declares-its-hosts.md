---
id: 0107
title: >-
  An MFE's manifest declares the hosts it works in, by control-plane namespace, and a project
  can compose only MFEs that name it
status: Implemented
date: 2026-09-30
deciders: [sean]
area: DSL / manifest / composition
enforcement: code
tags: [dsl, manifest, composition, control-plane, hosts, iam]
relates-to: [7, 78, 83, 103]
supersedes: []
superseded-by: []
implements-pdr: [5, 8]
implemented-by:
  - packages/dsl/src/schema.ts
  - packages/dsl/src/control-plane-schema.ts
  - packages/dsl/src/control-plane-compiler.ts
  - packages/dsl/src/parser.ts
  - packages/codegen/src/validate.ts
  - src/commands/remote/init.ts
verified-by:
  - packages/dsl/src/__tests__/schema.hosts.test.ts
  - packages/dsl/src/__tests__/control-plane-compiler.test.ts
  - packages/dsl/src/__tests__/control-plane-fleet-equivalence.test.ts
  - packages/codegen/src/__tests__/validate.test.ts
  - src/commands/__tests__/remote-init.test.ts
  - check:mfe-consistency
tracked-by: ["#345"]
summary: >-
  `mfe-manifest.yaml` gains `hosts:`, a non-empty list of `{ id }` entries, each naming a host
  project by the `namespace` its `control-plane.yaml` declares. The compose compiler rejects a
  fleet member whose `hosts` does not include the composing project's namespace
  (`undeclared-host`, fatal), and `mfe:validate` rejects a manifest with no `hosts` at all
  (`hosts-declared`, error). Every example manifest declares its hosts; `abc-kids-flappy` declares
  both `abc` and `meridian`, which turns the cross-project composition #400 proved from a fact
  about meridian's composition document into a claim the MFE's owner makes. Host entries are
  objects so a host's own identity and access scheme can be added later without a second spelling.
rationale-summary: >-
  #400 composed abc-kids' flappy into meridian by adding one line to meridian's
  control-plane.yaml. That showed a domain feature composes into any shell, but only the host
  side knew about it: flappy's owner had no say and no record that a second shell depended on it.
  Composition belongs to the deploying project (ADR-078, ADR-083), and support belongs to the
  MFE's owner. The manifest is where the owner makes every other promise about the MFE, so that
  is where this promise goes. Hosts are keyed by namespace rather than project name because the
  namespace is the identity the platform already enforces per project.
long-form: true
---

## Context

PR #400 placed `abc-kids-flappy` into meridian-station. The whole change on the
composition side was one entry in meridian's fleet list:

```yaml
# examples/meridian-station/control-plane/control-plane.yaml
mfes:
  - meridian-console
  # …
  - ../abc-kids/flappy
```

That proved PDR-005's claim that a domain feature composes into any shell. But it
also showed that composition was one-sided. Flappy's manifest said nothing about
meridian. Nothing stopped any project from composing any MFE it could read, and
nothing told flappy's owners that a second shell now depended on their capability
contract. The next version of flappy could break meridian, and no gate in either
project would notice.

Every other promise an MFE makes lives in its manifest: capabilities, slots,
dependencies, build targets. "Which shells this is built and tested for" was the
only one missing.

Hosts will also get their own identity and access-management schemes. A shell
that authenticates its users differently from abc-kids has to be something an MFE
can name before any of that can be attached to it.

## Decision

**An MFE's manifest lists the hosts it works in. A project whose namespace is not
on that list cannot compose it, and a manifest with no list does not validate.**

### 1. A host is named by its control-plane namespace

```yaml
hosts:
  - id: abc
  - id: meridian
```

`id` is the `namespace:` the host project declares in its `control-plane.yaml`
(ADR-083 §1). The platform already requires that namespace to be declared rather
than inferred, and uses it to scope every state key a project may route on. The
project name (`meridian-station`) is a label the platform does not check for
uniqueness. The grammar is shared: `NAMESPACE_PATTERN` in
`packages/dsl/src/schema.ts` is the one definition, and `control-plane-schema.ts`
imports it.

The list is non-empty, has no repeats, and allows exactly one spelling: an object
per host, no bare-string shorthand. The web build's two spellings (ADR-095 §6)
showed what a second spelling costs.

### 2. Strict: absence is an error, enforced by validation rather than parsing

- **Compose.** `compileControlPlane` reports `undeclared-host` (fatal) for every
  fleet member whose `hosts` does not include the document's namespace, including
  one that has no `hosts` at all. `compose:build` refuses to write `rules.json`,
  and `compose:validate` (CI-gated) fails. The finding names the MFE through a new
  optional `mfe` field on `ControlPlaneFinding`. `stateKey` becomes optional,
  because this finding is about a fleet member, not a route.
- **`mfe:validate`.** `hosts-declared` is checked for every framework and is an
  error when `hosts` is missing. Its `fix` says what to write. `check:mfe-consistency`
  runs it across every example.
- **Parsing.** `DSLManifestSchema` keeps `hosts` optional. Every command in the
  CLI parses manifests. Rejecting an older manifest at parse time would make it
  unreadable to `remote:generate`, `describe` and the build commands, and it would
  surface as a zod error instead of a named rule with a fix. The requirement is
  enforced by the two gates above, where the fix can be stated.

`remote:init --host <namespace>` (repeatable) writes the list when scaffolding.
Without it, the manifest has no `hosts:` and the command prints a warning.

### 3. Host identity and access management: the slot is reserved, not filled

Each host entry is an object so that a host's IAM block (auth scheme, audience,
required claims, whatever that decision turns out to be) can sit beside `id`
later without changing the shape of the field. Until that decision is made,
`HostSchema` is `.strict()`. An `auth:` written today is rejected. If it were
stripped silently, it would read as configured and do nothing. Capability-level
authorization is still ADR-007's, and it is still deferred. Host-level IAM is a
separate decision and will be a separate ADR.

## Boundaries

- **Design-time only.** Nothing at runtime checks `hosts`. The registry and the
  shell load whatever `rules.json` says. The guarantee is that a committed
  `rules.json` which passes `compose:validate --check` was compiled from
  manifests that consented to it.
- **Not an access-control mechanism.** A host that edits a copy of a guest's
  manifest, or skips `compose:build`, is not stopped. This records the owner's
  intent and turns silent breakage into a failing gate. It does not secure
  anything. Host IAM (§3) is where enforcement will live.
- **No version dimension.** `hosts` says flappy works in meridian. It does not
  say which versions of meridian's shell. If that is ever needed, it goes on the
  host entry, which is another reason the entry is an object.
- **No platform migration entry.** ADR-082's registry detects developer-owned
  *source lines* that use something the platform changed. A missing manifest key
  is not a line. `hosts-declared` already reports the file and the fix through
  `mfe:validate`, which is what a migration entry would have done.

## Consequences

- Composing an MFE into a new shell now takes two edits, one in each project:
  the host adds it to `mfes:`, and the MFE's owner adds the host to `hosts:`.
  That is the intended cost. Whoever supports a capability contract has to agree
  before a new consumer depends on it.
- Every existing MFE outside this repository fails `mfe:validate` until it
  declares `hosts`. This is a deliberate breaking change for manifests. It was
  chosen over an "absent means anywhere" default, which would have left the
  field optional in practice forever.
- The reverse question, "which shells does flappy appear in?", can now be
  answered from flappy alone, before a breaking change to one of its
  capabilities.
- `ControlPlaneFinding.stateKey` becomes optional. The compose commands print
  only `rule` and `message`, and the change is reflected in their generated
  output schemas.

## References

- ADR-007 — authorization expression grammar, deferred. Capability-level
  authorization is still there; host IAM will be its own decision.
- ADR-078 — the control plane ships in the platform, and a composition
  environment is generated from a manifest; the deploying project owns it.
- ADR-083 — the project-scoped composition DSL whose `namespace` a host `id`
  names.
- ADR-103 — a manifest's browser build registers as `<name>-wasm`; the last
  registration the composition compiler learned to derive from a manifest.
- #400 — the composition smoke PR that placed abc-kids' flappy in meridian.
