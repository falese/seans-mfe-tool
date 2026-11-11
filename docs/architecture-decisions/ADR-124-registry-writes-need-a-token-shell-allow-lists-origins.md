---
id: 0124
title: >-
  A registry write needs the fleet's token, and a shell loads remotes only from origins it
  allows
status: Implemented
date: 2026-11-11
deciders: [sean]
area: Control plane / security / composition
enforcement: code
tags: [control-plane, registry, security, layout-manager, composition]
relates-to: [54, 55, 56, 78, 83, 121]
supersedes: []
superseded-by: []
implements-pdr: [5]
implemented-by:
  - packages/control-plane/registry/write-auth.js
  - packages/control-plane/registry/simple-registry.js
  - packages/runtime/src/layout-adaptors.ts
  - packages/runtime/src/layout-manager.ts
verified-by:
  - src/__tests__/control-plane-registry-write-auth.test.ts
  - packages/runtime/src/__tests__/layout-adaptors.test.ts
tracked-by: []
summary: >-
  The registry accepts `POST /mfes` and `POST /render` only with `Authorization: Bearer` and
  the shared secret in `REGISTRY_TOKEN`, and refuses every write when no token is configured.
  `LayoutManager` takes `allowedRemoteOrigins`; with it set, a placement whose remote entry is
  on any other origin is refused before its script is fetched. The first is on for every
  registry. The second is the shell's to turn on.
rationale-summary: >-
  A registration names the script a shell injects into its own page and the URL the daemon
  sends users' tokens to, and the registry took one from anyone who could reach its port. A
  shared secret is the smallest thing that closes that, and can be tested and deployed this
  week. Per-MFE signed registrations would also say which MFE is registering; they need key
  distribution and are a later step, not a prerequisite.
long-form: true
---

## Context

PDR-008 and ADR-078 make the registry and daemon part of the platform. The 2026-11 readiness
review (`docs/reviews/2026-11-platform-readiness/`, finding SEC-02) followed one registration
through them:

1. `POST /mfes` on the registry took a registration from any caller. Both services bind every
   interface and both fleets publish the port.
2. The daemon reads registrations from the registry and, to authorize or render, posts to the
   registration's `baseUrl` with the user's bearer token in the `Authorization` header.
3. The shell receives the resolved placement and injects its `remoteEntryUrl` as a `<script>`
   into its own page, with no check on where that URL points.

So whoever could reach the registry port could run script in the shell's origin and collect
user tokens. Nothing in the path asked who was registering or where a remote came from.

The owner decided the control plane is a product component, to be hardened, and chose a shared
secret for registration over signed registrations or leaving it to the network.

## Decision

Two guards, at the two ends of that path. Either one stops the attack above. They are
independent on purpose: one belongs to whoever runs the registry, the other to whoever builds
the shell.

### 1. A registry write needs the token

`createWriteGuard` (`packages/control-plane/registry/write-auth.js`) is middleware on
`POST /mfes` and `POST /render`. It accepts a request carrying
`Authorization: Bearer <REGISTRY_TOKEN>` and answers 401 otherwise. The comparison does not
take longer for a nearly-right token than for a wrong one.

### 2. No token means no writes

A registry started without `REGISTRY_TOKEN`, or with an empty one, answers every write with
503 and a message naming the variable. It does not fall back to accepting writes.

### 3. Reads stay open

`GET /mfes`, `GET /rules` and `GET /` need no token. The daemon syncs its directory from the
first, and design-time checks read the second.

### 4. The example fleets ship a development token

Both compose files set `REGISTRY_TOKEN: ${REGISTRY_TOKEN:-local-dev-only}` and both register
scripts send the same default, so a fleet still runs with one command. That value is in a
public repository and is not a secret. The registry prints a warning every time it starts
with it.

### 5. A shell names the origins it loads remotes from

`LayoutManagerConfig.allowedRemoteOrigins` is a list of origins. With it set, the
module-federation adaptor refuses, with a `SecurityError`, a placement whose `remoteEntryUrl`
is on any other origin, before anything is fetched or added to the page. Origins are compared
after parsing, as scheme, host and port together. The shell's own origin is always allowed, so
a relative URL works. A URL with no origin of its own, such as `data:`, is refused.

`createModuleFederationAdaptor({ allowedOrigins })` is the same guard for a host that builds
its adaptor map by hand.

### 6. The allow-list is off until a shell sets it

With `allowedRemoteOrigins` omitted, a shell loads from anywhere, as before. Turning it on by
default would break every existing shell, including the two here, whose remotes sit on a dozen
localhost ports.

## Boundaries

- **One secret for the whole fleet.** The token says a caller may write. It does not say which
  MFE it is, and it cannot be revoked for one MFE without changing it for all.
- **The registry's GraphQL endpoint is not covered.** `handleMessage` over HTTP and WebSocket
  still takes a message from any caller. It cannot register an MFE; it can inject an action
  that existing rules then evaluate.
- **The daemon is not covered.** It has no authentication, and neither WebSocket server checks
  `Origin`.
- **Authorization still fails open.** An MFE that does not declare `authorizeAccess` is treated
  as authorized (finding SEC-03). No MFE in either fleet declares it, so denying by default
  needs a way to declare an MFE public first. That is a composition-schema decision and is not
  made here.
- **The daemon still sends the user's token to a registration's `baseUrl`.** With §1 only a
  token holder can set that URL.
- **The example shells do not set `allowedRemoteOrigins`.** They are developer-owned code, and
  Meridian composes a remote from the other fleet.
- **Nothing here is transport security.** The token travels in a header; over plain HTTP,
  anything on the path can read it.

## Consequences

Better: reaching the registry port is no longer enough to change what a shell loads. A shell
that sets its allow-list is protected even if the registry is compromised.

Worse: every deployment has one more secret to set, and a registry started the old way now
refuses registrations until it has one. That is a breaking change for anyone running the
registry outside these compose files. Scripts that post to `/mfes` must send the header.

The development token is a real cost. It keeps the demo to one command, and it means a fleet
copied to a reachable host without setting `REGISTRY_TOKEN` is protected by a published
string. The startup warning is the mitigation; a registry that refused the development token
when not on loopback would be a stronger one.

## References

- ADR-054 — the control-plane message protocol these services speak.
- ADR-055 — LayoutManager, daemon-driven slot composition; it gains `allowedRemoteOrigins`.
- ADR-056 — host-side composition providers; the module-federation adaptor is one.
- ADR-078 — the control plane ships in the platform, which is why hardening it is the platform's job.
- ADR-083 — the composition document `rules.json` is compiled from and registered with.
- ADR-121 — the same stance at the CLI: input from a caller you cannot vouch for is checked.
