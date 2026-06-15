# Control-Plane Message Protocol

Source of truth: `packages/contracts/src/messages.ts`.

Refs: ADR-053 (protocol), ADR-055 (module-federation output shape).

This module is the single source of truth for the wire contract between
**Renderer ↔ Daemon ↔ Registry ↔ MFE**. The daemon control plane
(`@control-plane/contracts`) re-exports these types. Non-TypeScript implementations
validate payloads with the runtime guards exported from the same module.

---

## Data flow overview

```
Renderer ──(ActionRecord)──▶ Daemon ──(ActionRecord)──▶ Registry
Registry ──(Resolution)───▶ Daemon ──(RenderedExperience)──▶ Renderer
MFE      ──(updateControlPlaneState)──▶ Daemon ──(STATE_UPDATE ActionRecord)──▶ Registry
```

---

## Session and user context

### ControlPlaneUser

The authenticated principal a session acts as.

```typescript
interface ControlPlaneUser {
  id: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique user identifier. |
| `roles` | no | Role strings for authorisation decisions. |
| `attributes` | no | Arbitrary user attributes (e.g. locale, tier). |

### SessionContext

Per-session context threaded through every action. The daemon copies `user`, `jwt`, and
`requestId` into the MFE `Context` when invoking capabilities.

```typescript
interface SessionContext {
  sessionId: string;
  user?: ControlPlaneUser;
  jwt?: string;
  application?: string;
  locale?: string;
  attributes?: Record<string, unknown>;
}
```

| Field | Required | Description |
|---|---|---|
| `sessionId` | yes | Unique session identifier. |
| `user` | no | Authenticated principal. |
| `jwt` | no | Raw JWT forwarded as `Authorization` header on capability calls. |
| `application` | no | Host application type: `'web'` \| `'mobile'` \| `'desktop'` \| `'cli'` \| … (open string). |
| `locale` | no | BCP-47 locale string, e.g. `'en-US'`. |
| `attributes` | no | Arbitrary session attributes. |

---

## Upward flow — actions

### ActionRecord

A state change flowing up: Renderer → Daemon → Registry. Covers both user interactions
(`CLICK`, `SUBMIT`) and MFE-initiated control-plane state updates
(`updateControlPlaneState` → `STATE_UPDATE` with a `stateKey`).

```typescript
interface ActionRecord {
  id: string;
  componentId: string;
  actionType: string;
  data: Record<string, unknown>;
  timestamp: string;       // ISO-8601
  stateKey?: string;
  mfe?: string;
  context?: SessionContext;
}
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique action identifier (UUID). |
| `componentId` | yes | Id of the experience the action targets. |
| `actionType` | yes | Canonical action type. Daemons normalise raw values (e.g. `BUTTON_CLICK → CLICK`) before forwarding. Common values: `CLICK`, `SUBMIT`, `STATE_UPDATE`. |
| `data` | yes | Action payload. Shape is domain-specific. |
| `timestamp` | yes | ISO-8601 string. |
| `stateKey` | no | Set for `STATE_UPDATE` signals, e.g. `'analysis.complete'`. |
| `mfe` | no | Which MFE emitted the action, when known. |
| `context` | no | Session context — drives per-user registry resolution. |

---

## Registry resolution

### Resolution

The registry's answer to "what should render for this state change?"

```typescript
interface Resolution {
  mfe: string;
  capability: string;
  props: Record<string, unknown>;
}
```

| Field | Required | Description |
|---|---|---|
| `mfe` | yes | Name of the MFE to invoke. |
| `capability` | yes | Domain capability to render. |
| `props` | yes | Props passed to the capability's render inputs. |

---

## MFE registration

### MfeRegistration

What the registry stores when an MFE registers via `describe`. Gives the daemon
everything it needs to reach the MFE's capability endpoints and gives renderers what
they need to mount the presentation layer.

```typescript
interface MfeRegistration {
  name: string;
  version: string;
  type: string;
  baseUrl: string;
  capabilities: string[];
  contentType?: string;
  remoteEntryUrl?: string;
  moduleFederation?: { scope: string; module: string; component?: string };
  framework?: string;
  handleKinds?: HandleKind[];
  manifest?: Record<string, unknown>;
}
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | MFE identifier (matches manifest `name`). |
| `version` | yes | Semver string. |
| `type` | yes | DSL manifest `type` (e.g. `'remote'`, `'feature'`). |
| `baseUrl` | yes | Base URL where the daemon reaches capability HTTP endpoints. |
| `capabilities` | yes | List of capability names the MFE exposes. |
| `contentType` | no | Default delivery mechanism, e.g. `'module-federation'`. Open string (ADR-036). |
| `remoteEntryUrl` | no | For module-federation MFEs: where the renderer fetches `remoteEntry.js`. |
| `moduleFederation.scope` | no | Global container name, e.g. `'abc_kids_flappy'`. |
| `moduleFederation.module` | no | Exposed module, e.g. `'./App'`. |
| `moduleFederation.component` | no | Component name passed to `mfe.render()` inputs. |
| `framework` | no | Framework string for observability and handle negotiation (ADR-056). Open string (ADR-036). |
| `handleKinds` | no | Presentation handle kinds the MFE exposes (ADR-056). Guarantees the imperative floor; native kinds are opt-in. |
| `manifest` | no | Full manifest record for registry-side resolution rules. |

When `moduleFederation`, `remoteEntryUrl`, and `contentType: 'module-federation'` are
all present, the daemon synthesises the `RenderedExperience` from the registration
without calling HTTP capability endpoints — the `BaseMFE` lifecycle runs in the host
shell, not server-side (ADR-055).

---

## Downward flow — rendered experiences

### RenderedExperience

What an MFE's `render()` returned, relayed by the daemon to renderers.

```typescript
interface RenderedExperience {
  id: string;
  mfe: string;
  capability: string;
  output: unknown;
  contentType: string;
  props?: Record<string, unknown>;
  createdAt: string;   // ISO-8601
}
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique experience identifier. |
| `mfe` | yes | Which MFE produced this experience. |
| `capability` | yes | Which domain capability was rendered. |
| `output` | yes | MFE-owned payload: HTML string, component reference, structured data — discriminated by `contentType`. |
| `contentType` | yes | Delivery mechanism. Open string. Known constants: `'text/html'`, `'application/json'`, `'module-federation'`. |
| `props` | no | The resolution props this experience was rendered with. |
| `createdAt` | yes | ISO-8601 creation timestamp. |

### ModuleFederationExperienceOutput

The `output` shape when `contentType === 'module-federation'` (ADR-055). Gives a layout
manager everything needed to load the remote and drive its `BaseMFE` lifecycle.

```typescript
interface ModuleFederationExperienceOutput {
  remoteEntryUrl: string;
  scope: string;
  module: string;
  component?: string;
  props?: Record<string, unknown>;
}
```

| Field | Required | Description |
|---|---|---|
| `remoteEntryUrl` | yes | Where the renderer fetches the remote container. |
| `scope` | yes | Global container name. |
| `module` | yes | Exposed module to import (must export `{ mfe, mfeReady }`). |
| `component` | no | Component name passed to `mfe.render()` inputs. |
| `props` | no | Extra props merged into the render inputs. |

### ExperienceState

The daemon's per-experience state entry: the experience plus every action submitted
against it. Payload of a `STATE_SNAPSHOT` message.

```typescript
interface ExperienceState {
  experience: RenderedExperience;
  actions: ActionRecord[];
  lastUpdated: string;   // ISO-8601
}
```

---

## Message envelope

All messages on the daemon's `messages` GraphQL subscription share this envelope.

### MessageDirection

```typescript
type MessageDirection = 'COMPONENT' | 'ACTION';
```

- `COMPONENT` — downstream (Registry → Daemon → Renderer)
- `ACTION` — upstream (Renderer/MFE → Daemon → Registry)

### MessageKind

```typescript
type MessageKind =
  | 'COMPONENT_UPDATE'   // new/changed RenderedExperience pushed to renderers
  | 'STATE_SNAPSHOT'     // full ExperienceState for one experience
  | 'ACTION_ECHO'        // immediate daemon ack of a received action
  | 'ACTION'             // raw upward action
  | 'ACTION_FORWARD';    // daemon → registry forwarded action
```

### Message

```typescript
interface Message {
  direction: MessageDirection;
  kind: MessageKind;
  payload: RenderedExperience | ActionRecord | ExperienceState;
  metadata: MessageMetadata;
}
```

Payload by `kind`:

| `kind` | `payload` type |
|---|---|
| `COMPONENT_UPDATE` | `RenderedExperience` |
| `STATE_SNAPSHOT` | `ExperienceState` |
| `ACTION_ECHO` / `ACTION` / `ACTION_FORWARD` | `ActionRecord` |

### MessageMetadata

```typescript
interface MessageMetadata {
  correlationId: string;   // UUID shared by originating request + all downstream messages
  acknowledged: boolean;   // true once the daemon has processed (not just received)
  error: string | null;    // non-null when processing failed
}
```

---

## MFE-facing result

### ControlPlaneStateResult

Returned by `BaseMFE.updateControlPlaneState()`. Maps to the `ACTION_ECHO` metadata
the daemon publishes.

```typescript
interface ControlPlaneStateResult {
  acknowledged: boolean;
  correlationId: string;
  error: string | null;
  resolution?: Resolution | null;
}
```

`resolution` is populated when the registry produced a new resolution synchronously.
Usually the resolution arrives asynchronously as a `COMPONENT_UPDATE` instead.

---

## Daemon configuration

### DaemonConfig

Accepted by every daemon implementation. Reconnect constants are exposed so tests can
inject small values.

| Field | Type | Default | Description |
|---|---|---|---|
| `registryUrl` | `string` | `ws://registry:4000/graphql` | WebSocket URL to the registry. |
| `port` | `number` | `3001` | Port the daemon's own GraphQL/WebSocket server listens on. |
| `reconnectBaseMs` | `number` | `400` | Starting delay (ms) for the first reconnect attempt. |
| `reconnectMaxMs` | `number` | `5000` | Maximum reconnect delay (ms). |
| `reconnectFactor` | `number` | `1.6` | Exponential growth rate per failed attempt. |
| `forwardTimeoutMs` | `number` | `4000` | Timeout (ms) for a forwarded action mutation. |

---

## Runtime guards

All guards are exported from `packages/contracts/src/messages.ts` and work in plain
JavaScript as well as TypeScript.

| Guard | Checks |
|---|---|
| `isResolution(value)` | `{ mfe: string, capability: string, props: object }` |
| `isRenderedExperience(value)` | `{ mfe: string, capability: string, contentType: string, output: * }` |
| `isActionRecord(value)` | `{ componentId: string, actionType: string, data: object }` |
| `isModuleFederationOutput(value)` | `{ remoteEntryUrl: string, scope: string, module: string }` |

### buildMessage

Constructs a protocol envelope with consistent defaults
(`acknowledged: false`, `error: null`, generated `correlationId`):

```typescript
buildMessage({
  direction: 'ACTION',
  kind: 'ACTION',
  payload: actionRecord,
  correlationId?: string,   // defaults to crypto.randomUUID()
  acknowledged?: boolean,   // defaults to false
  error?: string | null,    // defaults to null
}): Message
```
