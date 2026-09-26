# Control Plane Interface

Source of truth: `packages/runtime/src/layout-manager.ts` (host side) and
`packages/control-plane/` (registry + daemon services).

Refs: ADR-105 (retires BaseControlPlane), ADR-078 (control plane in the platform),
ADR-054 (control-plane message protocol), ADR-055 (LayoutManager),
ADR-056 (MFE presentation boundary), ADR-057 (virtualized daemon socket),
ADR-058 (slot-provider MFEs).

---

## Purpose

The control plane is one concrete implementation that ships with the platform
(PDR-008, ADR-078): the **registry** and **daemon** services in
`packages/control-plane`, which both reference fleets build their images from.
There is no abstract base to extend. ADR-059's `BaseControlPlane` anticipated
several external implementations (Node, Rust). Those moved in here and became
this one implementation, so ADR-105 retired the abstraction.

A host connects to the running daemon with a `LayoutManager` over one
`GraphQLTransportWsDaemonTransport`:

```typescript
import { LayoutManager, GraphQLTransportWsDaemonTransport } from '@seans-mfe-tool/runtime';

const layout = new LayoutManager({
  container: document.getElementById('app')!,
  session:   { sessionId, user, jwt },
  transport: new GraphQLTransportWsDaemonTransport(
    'ws://localhost:3004/graphql', // 3001-3003 belong to the MFEs (ADR-055)
    (url, protocol) => new WebSocket(url, protocol),
  ),
  onStatus: (status) => console.info('daemon', status),
  onError:  (message) => console.error(message),
});

layout.start();        // connect; slots fill as the daemon publishes experiences
await layout.stop();   // unmount every slot, close the socket
```

The host provides a mount point, session context and a transport. Slots,
adaptors and per-slot `DaemonChannel`s (ADR-057) are the LayoutManager's job.

---

## `LayoutManagerConfig`

| Field | Required | Description |
|---|---|---|
| `container` | yes | Mount point. The manager creates one child element per slot. |
| `transport` | yes | The one physical daemon connection, virtualized per slot (ADR-057). |
| `session` | no | Threaded onto every action so the registry resolves per user/app. |
| `hostFramework` | no | The host's framework, used for handle negotiation (ADR-056). |
| `adaptors` | no | `contentType` → adaptor, merged over the built-in defaults. |
| `createSlotElement` | no | Slot element factory. Defaults to `<section>`. |
| `onStatus` / `onError` | no | Transport status and terminal-error callbacks. |

The full, current field list is the `LayoutManagerConfig` entry in the API
reference (`docs/api`), which is generated from source.

---

## Registry and daemon

| Service | Default port | Role |
|---|---|---|
| `packages/control-plane/registry` | 4000 | Stores MFE registrations, evaluates placement rules, publishes resolved components |
| `packages/control-plane/daemon` | 3004 | Relays renderer actions to the registry and the resolved experience back |

Placement rules belong to each fleet. A fleet writes them in
`control-plane/control-plane.yaml` and compiles them to `control-plane/rules.json`
with `seans-mfe-tool compose:build` (ADR-083). See `packages/control-plane/README.md`.
