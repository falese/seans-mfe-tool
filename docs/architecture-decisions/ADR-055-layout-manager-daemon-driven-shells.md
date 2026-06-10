---
id: 0055
title: LayoutManager — Daemon-Driven Slot Composition for Generic Shells
status: Implemented
date: 2026-06-10
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [runtime, layout, shell, slots, daemon, control-plane, module-federation]
summary: `src/runtime/layout-manager.ts` adds a framework-free LayoutManager that turns any shell into a 100% generic, initially empty host — it connects to the daemon's `messages` subscription and mounts each EXPERIENCE component into a named layout slot (`props.slot`, default 'main') via a pluggable adaptor keyed by `contentType`. Built-in adaptors: `module-federation` (loads any remote — React or Angular — through the shared BaseMFE bootstrap `{ mfe, mfeReady }`), `text/html` (data-action delegation), `application/json`. `ModuleFederationExperienceOutput` `{remoteEntryUrl, scope, module, component?, props?}` is added to `@seans-mfe/contracts`. The ABC Kids shell is the reference host.
rationale-summary: PLATFORM-CONTRACT v3.2 + ADR-054 made the daemon select and render MFEs, but every shell still hardcoded which remotes exist and when to mount them (the ABC Kids GameLauncher pattern). Composition belongs to the control plane; the shell should only own slots and adaptors. A framework-free manager with injectable transport/slot factories keeps it testable in node and hostable from React, Angular, or plain HTML shells alike.
long-form: true
---

# ADR-055: LayoutManager — Daemon-Driven Slot Composition for Generic Shells

## Context

After ADR-054 the daemon resolves state changes to MFEs and relays MFE-owned
`RenderedExperience`s. But shells still hardcoded composition: the ABC Kids
shell statically imported `abcKidsFlappy/App` etc. and decided imperatively
when to mount them. That couples every shell to every MFE and contradicts the
product thesis (PDR-005/006): the registry decides *what* renders for whom;
the shell should only provide *where* (slots) and *how* (adaptors).

## Decision

1. **`LayoutManager` (`src/runtime/layout-manager.ts`)** — framework-free
   (no React/Angular imports), DOM-light (slot elements and the daemon
   transport are injected, so routing logic unit-tests in node):
   - Subscribes to the daemon's `messages` GraphQL subscription via
     `GraphQLTransportWsDaemonTransport` (self-contained
     graphql-transport-ws client, bounded-backoff reconnect).
   - Stays **empty until the daemon signals**: slots are created on demand
     when the first `EXPERIENCE` component arrives.
   - Routes each experience to the slot named by `experience.props.slot`
     (default `'main'`); mounting a new experience into an occupied slot
     unmounts the previous one first.
   - Mounts via the adaptor registered for the experience's `contentType`;
     unknown contentTypes and `RESOLUTION_ERROR` components surface through
     `onError` instead of throwing.
   - `sendAction()` sends actions up the control plane carrying the shell's
     `SessionContext` — the registry resolves per user/application.

2. **Adaptors are the extension point.** `ExperienceAdaptor.mount(experience,
   slot, helpers) → unmount`. Built-ins:
   - `module-federation` — loads `output.remoteEntryUrl`, initializes the
     shared scope, imports `output.module` from container `output.scope`, and
     drives the remote's BaseMFE bootstrap (`{ mfe, mfeReady }` → `render()`
     with `containerId`). **Framework-independent**: RemoteMFE (React) and
     AngularRemoteMFE (Angular) satisfy the same lifecycle (ADR-041), so one
     adaptor mounts both.
   - `text/html` — MFE-owned markup; `[data-action]` clicks become control-
     plane actions.
   - `application/json` — generic data view.
   New delivery mechanisms = a new adaptor, not a new manager (mirrors the
   ADR-036 plugin posture).

3. **Contract addition (`@seans-mfe/contracts`):**
   `ModuleFederationExperienceOutput` `{ remoteEntryUrl, scope, module,
   component?, props? }` + `isModuleFederationOutput` guard pin the
   `module-federation` output shape end to end (registry route props →
   daemon → layout manager).

4. **ABC Kids shell is the reference host.** `examples/abc-kids/shell` now
   renders only connection chrome and an empty `layout-host` div; all
   composition arrives from the daemon (`DAEMON_WS_URL`, default
   `ws://localhost:3004/graphql` — 3001-3003 belong to the MFEs). The legacy
   GameBrowser/GameLauncher components remain in the tree for reference but
   are no longer wired into `App`.

## Consequences

- Any application type can become a daemon-composed host by embedding the
  manager and (optionally) registering adaptors — React/Angular shells, plain
  HTML pages, kiosk wrappers.
- Shells no longer need static Module Federation `remotes` config for daemon-
  driven MFEs; remotes load dynamically from the experience payload. Shared
  singletons still come from the shell's MF `shared` config.
- The slot vocabulary (`props.slot`) is part of the registry's resolution
  props — layout becomes a rules-engine concern, enabling per-user layouts.
- Tests: `src/runtime/__tests__/layout-manager.test.ts` (manager routing,
  slot lifecycle, session threading, transport protocol) and
  `examples/abc-kids/shell/src/App.test.tsx` (shell stays generic/empty).

## References

- ADR-041 (BaseMFE capability contract), ADR-054 (control-plane protocol),
  PDR-005 (runtime composition), PLATFORM-CONTRACT.md v3.2
