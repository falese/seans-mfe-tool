# Control Plane Interface

Source of truth: `src/runtime/base-control-plane.ts`.

Refs: ADR-059 (BaseControlPlane), ADR-054 (control-plane message protocol),
ADR-055 (LayoutManager), ADR-056 (MFE presentation boundary),
ADR-057 (virtualized daemon socket), ADR-058 (slot-provider MFEs).

---

## Purpose

`BaseControlPlane` is the abstract base every control-plane implementation must extend.
It packages daemon + registry + LayoutManager + slots + adaptors + DaemonChannels into a
single unit with a three-line host API:

```typescript
const cp = new NodeControlPlane({
  container: document.getElementById('app'),
  session:   { sessionId, user, jwt },
  daemonUrl: 'ws://localhost:3001/graphql',
});

await cp.start();   // daemon + registry + LayoutManager all wired
await cp.stop();    // reverse in correct order
```

The host never instantiates `LayoutManager`, configures slots, or touches the transport.
Those are internal implementation details.

---

## BaseControlPlane

```typescript
abstract class BaseControlPlane {
  readonly __controlPlaneBrand = '__BaseControlPlane__' as const;

  // Identity
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly implementation: string;   // e.g. 'node', 'rust'

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
  get uptime(): number | undefined
}
```

---

## ControlPlaneConfig

Constructor configuration accepted by every control-plane implementation.
Concrete implementations extend this with their daemon-connection fields.

```typescript
interface ControlPlaneConfig {
  container:      LayoutHostLike;
  session?:       SessionContext;
  hostFramework?: string;
  adaptors?:      Record<string, ExperienceAdaptor>;
  onStatus?:      (status: TransportStatus) => void;
  onError?:       (message: string) => void;
}
```

| Field | Required | Description |
|---|---|---|
| `container` | **yes** | Host element (or structural equivalent) LayoutManager mounts into. Must expose `appendChild`. |
| `session` | no | Session context threaded into every action (user, jwt, locale). |
| `hostFramework` | no | The host shell's framework (e.g. `'react'`). When set, activates ADR-056 native handle negotiation — MFEs that expose a matching native handle compose in-tree with shared context (providers, router, store). Omit for a framework-free host; every MFE then composes via its guaranteed imperative handle (isolation). |
| `adaptors` | no | Custom content-type adaptors merged with the built-in set. Use sparingly — prefer the built-in adaptors (`module-federation`, `text/html`, `application/json`). |
| `onStatus` | no | Called when the daemon transport status changes. |
| `onError` | no | Called when LayoutManager encounters a mounting error. |

**Concrete extension example (NodeControlPlane):**

```typescript
interface NodeControlPlaneConfig extends ControlPlaneConfig {
  daemonUrl: string;   // e.g. 'ws://localhost:3001/graphql'
}
```

---

## ControlPlaneStatus

```typescript
type ControlPlaneStatus =
  | 'idle'       // never started
  | 'starting'   // start() in progress
  | 'running'    // daemon + LayoutManager live
  | 'stopping'   // stop() in progress
  | 'stopped'    // cleanly shut down
  | 'error';     // doStart() threw — LayoutManager was never created
```

Status transitions:

```
idle → starting → running → stopping → stopped
                ↓
              error   (doStart() throws; LayoutManager not created)
```

---

## ControlPlaneHealth

Returned by the abstract `health()` method.

```typescript
interface ControlPlaneHealth {
  status:     ControlPlaneStatus;
  registered: string[];     // names of registered MFEs
  uptime?:    number;       // ms since start() completed; absent when not running
}
```

---

## Lifecycle — start() and stop()

### start()

1. Sets `status` → `'starting'`.
2. Calls `doStart()` (concrete: start daemon, connect to registry).
3. Creates `LayoutManager` with the transport from `createTransport()`, passing
   `container`, `session`, `adaptors`, `onStatus`, and `onError` from config.
4. Calls `layoutManager.start()`.
5. Sets `status` → `'running'` and records start time (for `uptime`).

If `doStart()` throws, status is set to `'error'` and the error re-thrown.
`LayoutManager` is never created in the error path.

### stop()

Safe to call from any status — no-op if `idle` or already `stopped`.

1. Sets `status` → `'stopping'`.
2. Calls `layoutManager.stop()` and clears the internal reference.
3. Calls `doStop()` (concrete: disconnect from daemon, shut down registry).
4. Clears start time.
5. Sets `status` → `'stopped'`.

---

## Identity properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique id, e.g. `'node-daemon'`, `'rust-daemon'`, `'mock'`. |
| `displayName` | `string` | Human-readable name for CLI / observability output. |
| `implementation` | `string` | Runtime type tag, e.g. `'node'`, `'rust'`. |

---

## Introspection

| Member | Type | Description |
|---|---|---|
| `activeSlots` | `string[]` | Names of currently active layout slots. Delegates to `LayoutManager.activeSlots`; returns `[]` when not running. |
| `uptime` | `number \| undefined` | Milliseconds since `start()` completed. `undefined` when not running. |

---

## Abstract members to implement

| Member | Signature | Description |
|---|---|---|
| `register` | `(mfe: MfeRegistration) => Promise<void>` | Register an MFE with the control plane's registry. |
| `unregister` | `(name: string) => Promise<void>` | Remove an MFE from the registry. |
| `resolve` | `(action: ActionRecord) => Promise<Resolution>` | Ask the registry to resolve an action to an experience. |
| `health` | `() => Promise<ControlPlaneHealth>` | Return current health of daemon, registry, and registered MFEs. |
| `createTransport` | `() => DaemonTransport` | Return the `DaemonTransport` LayoutManager uses. Called once inside `start()`. |
| `doStart` | `() => Promise<void>` | Start the underlying daemon and registry. Called before LayoutManager is wired. |
| `doStop` | `() => Promise<void>` | Shut down the underlying daemon and registry. Called after LayoutManager is torn down. |

---

## Brand check

`isBaseControlPlane` enables duck-type safety across module boundaries. Use it
instead of `instanceof` when the same class may load from different physical paths
(e.g. via `npm link`):

```typescript
function isBaseControlPlane(value: unknown): value is BaseControlPlane {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__controlPlaneBrand === '__BaseControlPlane__'
  );
}
```

---

## Implementing a concrete control plane

A minimal skeleton:

```typescript
import { BaseControlPlane } from '@seans-mfe-tool/runtime';
import type {
  ControlPlaneConfig,
  ControlPlaneHealth,
} from '@seans-mfe-tool/runtime';
import type {
  MfeRegistration,
  Resolution,
  ActionRecord,
} from '@seans-mfe/contracts';
import type { DaemonTransport } from '@seans-mfe-tool/runtime';

interface NodeControlPlaneConfig extends ControlPlaneConfig {
  daemonUrl: string;
}

class NodeControlPlane extends BaseControlPlane {
  readonly id             = 'node-daemon';
  readonly displayName    = 'Node Daemon Control Plane';
  readonly implementation = 'node';

  constructor(private readonly nodeConfig: NodeControlPlaneConfig) {
    super(nodeConfig);
  }

  protected async doStart(): Promise<void> {
    // connect to the Node daemon WebSocket
  }

  protected async doStop(): Promise<void> {
    // disconnect
  }

  async register(mfe: MfeRegistration): Promise<void> { /* … */ }
  async unregister(name: string):       Promise<void> { /* … */ }
  async resolve(action: ActionRecord):  Promise<Resolution> { /* … */ }
  async health():                       Promise<ControlPlaneHealth> { /* … */ }

  createTransport(): DaemonTransport {
    return new GraphQLWebSocketClient(this.nodeConfig.daemonUrl);
  }
}
```

Concrete implementations live in their own repos (`Falese/daemon`, Rust daemon repo)
and import `BaseControlPlane` from the published `@seans-mfe-tool/runtime` package —
the same way MFE implementations import `BaseMFE`.
