# ADR-059 — BaseControlPlane: abstract base for all control-plane implementations

- **Status:** Accepted
- **Date:** 2026-06-14
- **Relates to:** ADR-054 (control-plane message protocol), ADR-055 (LayoutManager), ADR-056 (MFE presentation boundary), ADR-057 (virtualized daemon socket), ADR-058 (slot-provider MFEs)

## Context

The platform's "abstract base owns the shape; concrete owns the how" pattern holds at
every level:

| Layer | Abstract base | Concrete implementations |
|---|---|---|
| MFE runtime | `BaseMFE` | `RemoteMFE`, `AngularRemoteMFE` |
| CLI commands | `BaseCommand` | every oclif command |
| Framework plugins | `BaseFrameworkPlugin` | `ReactRspackPlugin`, `AngularWebpackPlugin` |

The **control plane** — daemon + registry + LayoutManager + slots + adaptors +
DaemonChannels — has no equivalent abstraction. The Node daemon (`Falese/daemon`) and
the Rust daemon are independent implementations of the same concept, but nothing
codifies that concept as a typed contract.

Without a base class, the control plane cannot:
- Be swapped (Node ↔ Rust ↔ future implementations) without host-side changes.
- Be tested against a shared conformance contract.
- Be documented as a first-class platform citizen in `docs/schemas/`.

## Decision

Introduce `BaseControlPlane` as an abstract class in `src/runtime/base-control-plane.ts`.

**Key design choices settled in the design session (2026-06-14):**

**1. Daemon + registry together.**  
The abstract unit is the whole control plane (daemon + registry), not daemon-only. Both
existing implementations bundle them, and the host has no reason to interact with
daemon and registry as separate concerns.

**2. LayoutManager is owned internally.**  
The host never instantiates `LayoutManager`. `BaseControlPlane.start()` creates and
wires it using the transport returned by `createTransport()`. LayoutManager becomes a
first-class internal member — always present when the control plane is running —
rather than a separate construction concern for the host.

**3. The host API is minimal.**  

```typescript
const cp = new NodeControlPlane({
  container: document.getElementById('app'),
  session: { sessionId, user, jwt },
  daemonUrl: 'ws://localhost:3004/graphql', // 3001-3003 belong to the MFEs (ADR-055)
});

await cp.start();
// daemon drives everything from here
await cp.stop();
```

The host provides a mount point and session context. It does not configure slots,
adaptors, channels, or the transport — those are internal to the control plane.
Optional escape hatches (`adaptors`, `onStatus`, `onError`) are available in the
constructor config but never required.

**4. Build/CI interplay deferred.**  
The interplay between `BaseControlPlane` and `BaseFrameworkPlugin` for local dev
orchestration and CI is a separate design session. `BaseControlPlane` is deliberately
ignorant of `BaseFrameworkPlugin`.

**5. Spawn vs connect is not prescribed.**  
`doStart()` may either spawn a daemon subprocess or connect to an already-running
service. Concrete implementations choose. The abstract interface requires only that
`start()` results in a running control plane ready to receive `register()` calls and
serve `createTransport()`.

## Abstract interface

```typescript
abstract class BaseControlPlane {
  // Constructor — config is set once; start()/stop() take no args
  constructor(config: ControlPlaneConfig)

  // Identity
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly implementation: string;  // e.g. 'node', 'rust'

  // Lifecycle — concrete (orchestrates doStart + LayoutManager)
  async start(): Promise<void>
  async stop(): Promise<void>
  get status(): ControlPlaneStatus

  // Registry — abstract (daemon + registry own these)
  abstract register(mfe: MfeRegistration): Promise<void>
  abstract unregister(name: string): Promise<void>
  abstract resolve(action: ActionRecord): Promise<Resolution>
  abstract health(): Promise<ControlPlaneHealth>

  // Transport — abstract (how LayoutManager reaches this control plane)
  abstract createTransport(): DaemonTransport

  // Implementation hooks — called by start()/stop()
  protected abstract doStart(): Promise<void>
  protected abstract doStop(): Promise<void>

  // Introspection
  get activeSlots(): string[]
}
```

`ControlPlaneConfig` carries only what the base class needs: `container`, `session?`,
`hostFramework?`, `adaptors?`, `onStatus?`, `onError?`. `hostFramework` is forwarded
to the internal LayoutManager for ADR-056 handle negotiation (omit it for a
framework-free host — every MFE then composes via its guaranteed imperative handle).
Concrete implementations extend the config with their own daemon-connection settings
(e.g. `daemonUrl` for a Node implementation, or `binaryPath` + `port` for a spawned
Rust binary).

## Consequences

**Positive:**
- Node and Rust daemon implementations get a typed conformance contract they can
  implement independently, then plug into any host shell.
- Host shells reduce to three lines: instantiate, `start()`, `stop()`.
- LayoutManager, slots, adaptors, and DaemonChannels are internal implementation
  details — host authors never read those APIs.
- A third or fourth control-plane implementation (in-process mock, cloud-hosted
  daemon) requires no host-side changes.
- `docs/schemas/control-plane.md` can document the full contract as a first-class
  platform schema.

**Negative / constraints:**
- Concrete implementations (`NodeControlPlane`, `RustControlPlane`) live in separate
  repos — this ADR only defines the contract. Those repos must add the implementation.
- The `adaptors` escape hatch in `ControlPlaneConfig` is the one point where the host
  can influence internal LayoutManager behaviour. Overuse would couple the host to the
  adaptor registry. Use sparingly.

## Implementation location

`BaseControlPlane` lives in `src/runtime/` (alongside `BaseMFE`, `LayoutManager`) —
not in `packages/contracts/` — because it depends on `LayoutManager` directly. Repos
implementing concrete control planes will import from `@seans-mfe-tool/runtime` (the
published runtime package) the same way MFE implementations import `BaseMFE`.
