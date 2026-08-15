# `packages/control-plane`

The platform's composition runtime: the **registry** that resolves an action into
an experience, and the **daemon** that routes actions up and experiences down.

This repository owns the canonical implementation (**PDR-008**, **ADR-078**).
`@falese/daemon` is retired — there is no upstream, and nothing here reconciles
against one.

| Service | Source | Default port | Role |
|---|---|---|---|
| `registry/` | `simple-registry.js`, `slot-target.js` | 4000 | Stores MFE registrations, evaluates placement rules, publishes resolved components |
| `daemon/` | `simple-daemon.js` | 3004 | Relays renderer actions to the registry and the resolved experience back |

`packages/runtime/src/base-control-plane.ts` (ADR-059) owns the *abstract* shape;
this package is the concrete implementation of it.

## What lives here, and what does not

**Here:** the engine. The rule evaluator, the registration store, the slot-target
matcher, the transport.

**Not here:** the rules. Each fleet authors its own composition in
`control-plane/control-plane.yaml` and compiles it to `control-plane/rules.json`
with `seans-mfe-tool compose:build` (ADR-083). Placement is the deploying
project's decision; only the engine that evaluates it is the platform's
(ADR-078 §4). The compiled `rules.json` is a generated artifact — edit the YAML.

## Why these are not workspace packages

`packages/control-plane` has **no root `package.json`**, so `packages/*` does not
pick it up and the root install does not hoist anything from here. That is
deliberate:

- Each service is a **standalone container image** built from its own directory
  as the Docker context, with its own pinned `package-lock.json`. Hoisting into
  the root workspace would discard those lockfiles and make the images depend on
  the root install's resolution.
- Nothing in the CLI tree imports this code. The only in-repo consumer is a
  behavioural pin test (`packages/contracts/src/__tests__/registry-slot-pin.test.ts`)
  that `require`s `slot-target.js` by path.

Run `npm ci` inside `registry/` or `daemon/` if you need them locally;
`examples/meridian-station/scripts/dev-up.sh` does this for you on first run.

## How a fleet consumes it

Compose reaches out of the example into this package, rather than each fleet
carrying a copy:

```yaml
registry:
  build: ../../packages/control-plane/registry
daemon:
  build: ../../packages/control-plane/daemon
```

Both reference fleets do this. Before ADR-078 §1 they each carried a
byte-identical 1,296-line copy, and a registry fix had to be made twice.

## Ports

The defaults live in the Dockerfiles; each fleet overrides them by environment.

| Fleet | registry | daemon |
|---|---|---|
| `abc-kids` | 4000 | 3004 |
| `meridian-station` | 4500 | 4504 |

## Known limits

- **In-memory only.** Registrations and rules do not survive a restart, and
  components are evicted after `COMPONENT_TTL_MS` (default 10 minutes). Making
  persistence a manifest field is ADR-078 §2, tracked by #139.
- **Dev-grade.** ADR-062 keeps production deployment a plugin axis; nothing here
  claims the registry is horizontally scalable.
- `slot-target.js` duplicates the slot matcher from `@seans-mfe/contracts`
  because that package is not published yet. The copy is pinned against the real
  implementation by test and should be deleted once the registry can import it
  (ADR-073 §5).
