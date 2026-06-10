---
id: 0054
title: Control-Plane Message Protocol as a Shared Contract in @seans-mfe/contracts
status: Implemented
date: 2026-06-10
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [contracts, daemon, control-plane, runtime, protocol, messages]
summary: The Renderer ⇄ Daemon ⇄ Registry ⇄ MFE wire protocol (PLATFORM-CONTRACT.md v3.2) is codified once in `@seans-mfe/contracts/messages` — Message envelope, ActionRecord, Resolution, RenderedExperience, ExperienceState, SessionContext, MfeRegistration, DaemonConfig — plus runtime guards (`isResolution`, `isRenderedExperience`, `isActionRecord`, `buildMessage`). The daemon repo's `@control-plane/contracts` re-exports these types instead of defining its own; component-era CARD/FORM/NOTIFICATION shapes are replaced by MFE-owned `RenderedExperience`.
rationale-summary: Three divergent copies of the protocol existed (PLATFORM-CONTRACT.md, packages/contracts/src/messages.ts, daemon/contracts/types.ts) with incompatible direction/kind unions and a component-typed payload the platform spec explicitly forbids. A single typed source of truth — with per-user SessionContext so the registry can resolve experiences per user, per application — is the precondition for the daemon to select, render, and control SMT-generated MFEs dynamically.
long-form: true
---

# ADR-054: Control-Plane Message Protocol as a Shared Contract in @seans-mfe/contracts

## Context

PLATFORM-CONTRACT.md v3.2 defines the daemon as a **state-change router and render
orchestrator**: it receives actions from renderers, asks the registry "which MFE should
handle this state?", receives a resolution `{mfe, capability, props}`, invokes the resolved
MFE's capabilities (`authorizeAccess` → `load`/`render`/`refresh`), and relays the MFE's
`RenderedExperience` back to renderers. The daemon does **not** define component types.

Before this ADR, the protocol existed in three divergent forms:

1. **PLATFORM-CONTRACT.md** — `direction: COMPONENT|ACTION`, kinds including
   `ACTION_FORWARD`, payloads `RenderedExperience | ActionRecord`.
2. **`packages/contracts/src/messages.ts`** — a drifted, unconsumed sketch
   (`direction: ACTION|ECHO|SNAPSHOT|RESOLVE`) that matched neither the spec nor any
   implementation.
3. **`falese/daemon` `contracts/types.ts`** — the implemented daemon contract, but
   component-era: payloads typed as `Component` with a `CARD|FORM|NOTIFICATION`
   discriminator, which v3.2 explicitly forbids, and no user/session context at all.

Per-user, per-application dynamic composition (PDR-005, PDR-006) requires the registry to
see *who* acted and *where* — none of the three variants carried that.

## Decision

1. **`@seans-mfe/contracts/messages` is the single source of truth** for the control-plane
   wire protocol. It exports:
   - `Message` / `MessageDirection` (`COMPONENT|ACTION`) / `MessageKind`
     (`COMPONENT_UPDATE | STATE_SNAPSHOT | ACTION_ECHO | ACTION | ACTION_FORWARD`) /
     `MessageMetadata` (correlationId, acknowledged, error)
   - `ActionRecord` — upward state changes, now carrying optional `stateKey` (for
     `updateControlPlaneState` signals), `mfe`, and `context: SessionContext`
   - `SessionContext` / `ControlPlaneUser` — sessionId, user (id, roles, attributes), jwt,
     `application` (host app type — open string), locale. This is how "any user, their
     context, any type of application" reaches the registry's rules.
   - `Resolution` — the registry's answer: `{mfe, capability, props}`
   - `RenderedExperience` — what an MFE's `render()` returned: `{id, mfe, capability,
     output: unknown, contentType, props?, createdAt}`. `contentType` is an **open string**
     (ADR-036 precedent); `text/html`, `application/json`, `module-federation` are named in
     `EXPERIENCE_CONTENT_TYPES` but unknown mechanisms must be tolerated.
   - `ExperienceState` — per-experience daemon state (payload of `STATE_SNAPSHOT`)
   - `MfeRegistration` — what the registry stores from `describe()`: name, version, type,
     `baseUrl` (capability endpoints), capabilities, optional `contentType` and
     `remoteEntryUrl`
   - `ControlPlaneStateResult` — aligned with `BaseMFE.updateControlPlaneState()`,
     including optional synchronous `resolution`
   - `DaemonConfig` — registryUrl, port, reconnect/backoff/timeout constants
   - Runtime guards and builder: `isResolution`, `isRenderedExperience`, `isActionRecord`,
     `buildMessage` — pure, dependency-free, usable from plain JavaScript daemons and
     registries to validate payloads at service boundaries.

2. **The daemon repo consumes, never redefines.** `@control-plane/contracts` in
   `falese/daemon` re-exports these types (via a vendored `npm pack` tarball of
   `@seans-mfe/contracts` until the package is published — MERGE-PLAN.md Phase 1) and adds
   only daemon-side abstractions (`DaemonService`, invoker/directory interfaces).

3. **Component-era types are retired from the shared contract.** `Component` and
   `ComponentState` do not exist in `@seans-mfe/contracts`; `ActionRecord.componentId`
   remains (it names the targeted experience) for wire compatibility with deployed
   renderers.

## Consequences

- The daemon, registry, renderers, and `BaseMFE` runtime can all validate against one
  protocol; drift between repos becomes a type error or a failing guard test instead of a
  runtime surprise.
- Registry rules gain access to `action.context` (user, roles, application, locale) and can
  resolve different MFEs for the same state per user/app — the basis for contextual
  composition.
- `messages.ts` changes are breaking-protocol changes: they require a new ADR and a
  matching update in `falese/daemon` before release.
- Until `@seans-mfe/contracts` is published to npm, the daemon repo pins a vendored tarball;
  publishing (backlog item 7) replaces it with a semver range.

## References

- PLATFORM-CONTRACT.md v3.2 (daemon message protocol, the 10 capabilities, render flow)
- ADR-041 (BaseMFE capability contract), ADR-042 (lifecycle state machine),
  ADR-036 (open framework/bundler schema precedent), PDR-005 (runtime composition)
- `packages/contracts/src/__tests__/messages.test.ts` (protocol pinning tests)
