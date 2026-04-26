---
id: "0070"
title: "Use graphql-transport-ws for all daemon inter-process and browser communication"
status: Accepted
date: 2026-04-26
deciders: [falese]
enforcement: review-only
supersedes: []
superseded-by: []
tags: [protocol, websocket, graphql, daemon]
summary: "All communication between registry, daemon, and browser uses the graphql-transport-ws sub-protocol (subscriptions + mutations) rather than plain WebSocket or REST."
rationale-summary: "graphql-transport-ws provides typed subscription envelopes, a standard connection_init handshake, and back-pressure via ack/ping, matching the falese/daemon DaemonService contract and avoiding bespoke framing code in every tier."
long-form: true
enforcer-config: {}
---

# ADR-0070: Use `graphql-transport-ws` for all daemon inter-process and browser communication

## Context

The four-tier control plane (ADR-069) requires two bidirectional channels:

1. **Daemon → Registry**: daemon subscribes to `componentUpdate` events; sends `sendMessage` mutations to forward actions.
2. **Browser → Daemon**: browser subscribes to `componentUpdate` events; sends `sendMessage` mutations to dispatch MFE actions.

Candidate protocols considered:

| Protocol | Notes |
|---|---|
| Plain WebSocket + JSON frames | Flexible but requires bespoke framing, message IDs, and error codes |
| Server-Sent Events (SSE) | Server-to-client only; browser cannot send actions without a separate HTTP call |
| REST polling | High latency; no push capability |
| GraphQL over HTTP (queries) | No streaming; reconnect logic required |
| `graphql-ws` (deprecated) | Sub-protocol `graphql-ws`; superseded by `graphql-transport-ws` |
| **`graphql-transport-ws`** | Active IETF-aligned sub-protocol; matches `falese/daemon` DaemonService contract |

## Decision

All tiers use the `graphql-transport-ws` WebSocket sub-protocol (package `graphql-ws`).

### Schema (shared by registry and daemon)

```graphql
scalar JSON

type Component {
  id:        String!
  type:      String!
  data:      JSON
  direction: String!
  kind:      String!
  metadata:  JSON
}

type Query   { health: String! }

type Mutation {
  sendMessage(
    direction: String!
    type:      String!
    data:      JSON
    source:    String
  ): Component!
}

type Subscription {
  componentUpdate: Component!
}
```

### Reconnect constants (daemon + DaemonBridge — must match DAEMON-CONTRACT.md)

| Constant | Value |
|---|---|
| `RECONNECT_BASE_MS` | 400 ms |
| `RECONNECT_MAX_MS`  | 5 000 ms |
| `RECONNECT_FACTOR`  | 1.6 |
| `FORWARD_TIMEOUT_MS`| 4 000 ms |

These constants are identical in `ShellDaemon` (Node.js) and `DaemonBridge` (browser) to ensure symmetric back-pressure behaviour.

### Server-side (Node.js)

Both registry and daemon use:
- `express` HTTP server wrapped with `http.createServer`
- `WebSocketServer` (package `ws`) bound to path `/graphql`
- `useServer` from `graphql-ws/lib/use/ws` to attach the protocol handler
- `PubSub` from `graphql-subscriptions` for in-process fan-out (Redis adapter is swappable)

### Client-side (browser)

`DaemonBridge` uses the native `WebSocket` API with sub-protocol `graphql-transport-ws`. It:
1. Sends `{ type: 'connection_init' }` on open.
2. Sends a `subscribe` frame for `componentUpdate` immediately after `connection_ack`.
3. Dispatches mutations via a separate subscription frame (id scoped per mutation).
4. Reconnects with the shared exponential-back-off constants on any close/error.

## Consequences

### Positive
- A single schema file defines the wire contract for all tiers; TypeScript types can be generated from it.
- `graphql-transport-ws` handles ping/pong keep-alives, so no custom heartbeat code is needed.
- The browser client requires only the native `WebSocket` API; no additional runtime library dependency.
- Consistent sub-protocol across all three channels simplifies debugging (Wireshark, wscat, etc.).

### Negative
- All tiers must speak `graphql-transport-ws`; non-GraphQL clients (e.g., shell scripts) need a thin wrapper.
- `PubSub` from `graphql-subscriptions` is in-memory only; scaling to multiple daemon instances requires a Redis adapter.
- Forward-timeout (4 s) for fire-and-forget mutations may drop actions under registry restart; callers should implement retry at the application level.

## Related

- ADR-069: Four-tier daemon-native control plane
- `src/codegen/templates/shell/orchestration/daemon/shell-daemon.ts.ejs`
- `src/codegen/templates/shell/orchestration/registry/mfe-registry.ts.ejs`
- `src/codegen/templates/shell/src/shell/DaemonBridge.ts.ejs`
- `falese/daemon` DAEMON-CONTRACT.md
