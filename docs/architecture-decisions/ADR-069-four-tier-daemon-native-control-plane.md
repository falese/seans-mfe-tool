---
id: "0069"
title: "Four-tier daemon-native control plane: registry + daemon + shell + redis"
status: Accepted
date: 2026-04-26
deciders: [falese]
enforcement: review-only
supersedes: ["0016"]
superseded-by: []
tags: [orchestration, shell, daemon, registry, docker]
summary: "Replace ADR-016's single orchestration-service with two separate processes—MFERegistry (rules engine) and ShellDaemon (message broker)—plus a Redis PubSub backend, all composed via docker-compose."
rationale-summary: "Separating concerns into a stateless rules engine (registry) and a stateful message broker (daemon) improves independent scalability, matches the falese/daemon DaemonService protocol, and lets the Redis tier be swapped for in-process PubSub without changing any other tier."
long-form: true
enforcer-config: {}
---

# ADR-0069: Four-tier daemon-native control plane: registry + daemon + shell + redis

## Context

ADR-016 specified that every `mfe shell` generates an `orchestration-service/` directory containing a single Node.js process with HTTP REST endpoints (`/api/register`, `/api/discover`) and a WebSocket broadcast bus. That design was implemented in the first iteration of `shell:init`.

After aligning with the `falese/daemon` reference implementation (DaemonService protocol, DAEMON-CONTRACT.md), two problems with the single-process model became clear:

1. **Coupling**: The rules engine (what MFE to show next) and the message-routing layer (how to get the decision to the browser) live in one process. Changing one requires re-deploying the other.
2. **Protocol mismatch**: `falese/daemon` speaks `graphql-transport-ws` subscriptions, not plain WebSocket. A REST-only orchestration service cannot serve as a drop-in implementation of the DaemonService contract.

## Decision

`shell:init` generates a **four-tier control plane**:

```
registry   (port REGISTRY_PORT, default 4000)
  └─ MFERegistry: GraphQL-WS rules engine
       receives ACTION envelopes from daemon
       fires matching rules → publishes COMPONENT events

daemon     (port DAEMON_PORT, default 3001)
  └─ ShellDaemon: GraphQL-WS message broker
       persistent WS subscription to registry
       exposes sendMessage mutation to browser clients
       fans out COMPONENT_UPDATE events via PubSub

shell      (port PORT, default 3000)
  └─ React host + DaemonBridge + MFEOrchestrator
       browser connects to daemon via graphql-transport-ws
       receives COMPONENT events → loads MFE via Module Federation

redis      (port 6379)
  └─ Optional PubSub backend for multi-instance daemons
       daemon uses in-process PubSub by default; Redis swappable via env
```

### Generated directory layout

```
<name>/
├── orchestration/
│   ├── daemon/
│   │   ├── shell-daemon.ts     # ShellDaemon implementation
│   │   ├── package.json
│   │   └── Dockerfile
│   └── registry/
│       ├── mfe-registry.ts     # MFERegistry + rules engine
│       ├── package.json
│       └── Dockerfile
├── src/
│   └── shell/
│       ├── DaemonBridge.ts     # browser ↔ daemon GraphQL-WS client
│       ├── MFEOrchestrator.ts  # React hook + MFE state manager
│       ├── MFERenderer.tsx     # Module Federation dynamic loader
│       └── index.tsx
└── docker-compose.yml          # registry + daemon + shell + redis
```

### Data flow

```
Remote MFE → updateControlPlaneState({ stateKey, stateData })
    ↓  ACTION envelope → daemon sendMessage mutation
    ↓  daemon → registry handleMessage subscription
Registry rules evaluate (condition/generate) → COMPONENT published
    ↓  componentUpdate subscription → daemon PubSub
    ↓  daemon → browser DaemonBridge subscription
MFEOrchestrator updates activeMFEs state
    ↓
MFERenderer loads window[component.type].get('./App')   (Module Federation)
```

### Rule shape

```typescript
interface Rule {
  condition: (state: RegistryState, action: ActionEnvelope) => boolean;
  generate:  (state: RegistryState, action: ActionEnvelope) => { type: string; data: Record<string, unknown> };
}
```

`type` in the generated Component equals the Module Federation remote name (see ADR-071).

### Resilience

- Daemon reconnects to registry with exponential back-off (400 ms base, 1.6× factor, 5 s cap).
- DaemonBridge in the browser uses the same reconnect constants (aligned with DAEMON-CONTRACT.md).
- Docker Compose `depends_on: { condition: service_healthy }` gates startup order.
- Registry evicts Components after `COMPONENT_TTL_MS` (default 10 min) to prevent unbounded memory growth.

### Logging

ShellDaemon emits structured JSON logs when `LOG_JSON=1` (Docker default); falls back to human-readable lines in local development.

## Consequences

### Positive
- Registry and daemon can be scaled, restarted, and deployed independently.
- The two-process split is the canonical DaemonService pattern; remote MFEs gain a single stable message-bus contract.
- Redis tier is optional and swappable without touching the application tier.
- Structured logging from day one reduces ops overhead in container environments.

### Negative
- Three network hops (remote MFE → daemon → registry → daemon → browser) vs. one (remote MFE → orchestration-service → browser) increases latency slightly.
- Operators must manage four container images instead of two.
- `healthcheck` polling requires the shell Dockerfile to include `wget` or `curl`.

## Migration from ADR-016

ADR-016's `orchestration-service/` directory is superseded. Any project generated with the first `shell:init` iteration should replace `orchestration-service/` with the `orchestration/daemon/` + `orchestration/registry/` layout and update `docker-compose.yml`.

## Related

- ADR-016: Orchestration service per shell (superseded by this ADR)
- ADR-017: Docker-only orchestration (still applies; only the internal structure changed)
- ADR-068: `shell:init` command design
- ADR-070: GraphQL-WS as daemon protocol
- ADR-071: `Component.type` = Module Federation remote name
- `src/codegen/templates/shell/`
- `falese/daemon` DAEMON-CONTRACT.md
