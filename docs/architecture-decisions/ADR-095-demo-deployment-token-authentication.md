---
id: 0095
title: Every request across the deployed fleet carries a verified bearer token, minted by a single demo login
status: Proposed
date: 2026-09-17
deciders: [sean]
area: Security / authentication
enforcement: code
tags: [authentication, jwt, security, deployment, bff]
relates-to: [7, 27, 46, 52, 82]
supersedes: []
superseded-by: []
implements-pdr: []
implemented-by: []
verified-by: []
tracked-by: []
summary: >-
  The reference fleet ships JWT machinery at every tier but wires none of it: the
  API imports its auth middleware and never mounts it, the BFF extracts the bearer
  token and never verifies its signature, and nothing issues a token at all — so a
  public deployment is fully open. This ADR makes a signed HS256 bearer token
  mandatory and verified at both the BFF and API tiers, minted by a single
  demo-login endpoint from a shared credential, and threaded from the shell through
  the daemon session to every downstream call. It secures the demo for public
  hosting; it does not add authorization.
rationale-summary: >-
  The primitives already exist and are correct (`validateJWT` verifies HS256; the
  API middleware verifies HS256) — the defect is that they are unreachable, so the
  cheapest correct fix is to wire what is built rather than design new auth. A
  single shared demo credential is chosen over per-user identity because the goal
  is to keep the open internet out of a hosted demo, not to model users; anything
  richer is authorization, which ADR-007 defers and this ADR deliberately leaves
  deferred.
long-form: true
---

## Context

Deploying Meridian Station to a public host (a GitHub Pages front end over a
Heroku backend) exposes three domain APIs, six GraphQL BFFs, and the control-plane
daemon to the open internet. Today every one of those tiers is unauthenticated,
even though the token machinery to close them is already present and correct. The
gap is not missing code — it is unwired code:

- **The API imports its auth middleware and never applies it.**
  `examples/meridian-station/apis/harbormaster-api/src/routes/berths.route.js:4`
  does `const { auth } = require('../middleware/auth')`, and then
  `berths.route.js:12` mounts the route as
  `router.get('/', validateSchema(...), listBerths)` with no `auth` in the chain.
  The middleware (`.../middleware/auth.js:17`) performs a real
  `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` and is dead code.
  This is generated from `packages/plugin-api/templates/api/base/**`, so all three
  APIs and every generated API inherit the same dead wiring.

- **The BFF extracts the token but never verifies its signature.**
  `packages/plugin-bff/templates/mesh-context.js.ejs` (`extractUserIdFromToken`)
  base64-decodes the JWT payload to read `sub`/`userId` and injects `context.jwt`
  without checking the signature. The runtime already ships the correct check —
  `validateJWT` in `packages/runtime/src/handlers/auth.ts:16` verifies HS256 and
  sets `context.user` — but no BFF calls it. A forged, unsigned payload is trusted.

- **Nothing issues a token.** There is no `jwt.sign` and no login endpoint
  anywhere in the fleet; the only tokens in the tree are `fake-jwt-*` strings in an
  unrelated Phase-1.3 e2e (`tests/e2e/authentication.spec.ts`). So even the one
  tier that *did* verify would reject every real request.

The daemon already threads a per-session JWT into its authorize step
(`packages/control-plane/daemon/simple-daemon.js:363` — "Authorize with the
session's JWT/user context"), but the shell never populates it: `createSession()`
in `examples/meridian-station/shell/src/App.tsx:31` mints a random `sessionId` and
attaches no credential.

ADR-007 defers the *authorization* grammar (roles, permissions, ownership) and
forbids implementing it until a superseding ADR exists. That deferral is not the
blocker here: securing a demo needs *authentication* — proof the caller holds a
valid token — not *authorization*. This ADR stays strictly on the authentication
side of that line.

## Decision

A deployed fleet **rejects any request that does not carry a valid, signed bearer
token.** The token is minted by a single demo login and verified independently at
each server tier. Concretely:

### 1. The BFF verifies the signature before any resolver runs

The generated BFF context (`mesh-context.js`) calls the runtime's `validateJWT`
against `JWT_SECRET` and populates `context.user` from the *verified* claims.
`extractUserIdFromToken`'s unverified base64 decode is removed — a decoded-but-
unverified payload is never trusted. A missing or invalid token yields a
`SecurityError` (surfaced as a GraphQL auth error), not a silently anonymous
context.

### 2. The API tier mounts its existing auth middleware on every data route

The generated route templates apply `auth` ahead of each data handler, so the
already-present HS256 verification actually runs. `/health` and any liveness route
stay open by design; every `/api/*` data route is closed.

### 3. A single demo-login endpoint mints the token

One endpoint accepts a shared demo credential (a passphrase carried as a Heroku
config var, never committed) and returns a short-lived HS256 token signed with
`JWT_SECRET`, with `sub: "demo"` and a bounded `exp`. There is no user database,
no registration, and no per-caller identity — one credential, one token shape.

### 4. The shell obtains and propagates the token

The shell gates on a token: it prompts for the demo credential, stores the minted
token (per-tab), attaches `Authorization: Bearer <token>` to BFF calls, and
populates the daemon session's `jwt` so the existing authorize step and every
downstream hop receive it. Logging out clears the token and returns to the gate.

### 5. The secret is required, with no deployed default

`JWT_SECRET` is validated at boot per ADR-046; the deployed configuration supplies
a real secret as a config var and never the committed `meridian-demo-not-a-secret`
placeholder. WebSocket and HTTP origins use `wss://`/`https://` and CORS is scoped
to the front-end origin.

## Boundaries

- **This is authentication, not authorization.** Tokens carry no role or
  permission claims that gate anything; every holder of a valid token can reach
  every capability. Roles, permissions, ownership, and the expression grammar
  remain deferred under ADR-007. This ADR does not supersede it.
- **Single shared credential, demo-grade.** One passphrase protects the whole
  deployment. There is no per-user identity, no refresh-token rotation, no SSO, and
  no account lifecycle. It keeps the open internet out of a hosted demo; it is not
  a production auth system and must not be cited as one.
- **Scope is the reference fleet's deployment posture.** It changes the generated
  BFF/API templates (so all generated MFEs inherit verified auth) and the Meridian
  shell. It does not harden the registry/daemon admin surface beyond passing the
  session token through the path that already expects it.

## Consequences

**Better:** the confused-deputy hole (BFF trusting an unverified payload) is
closed; the dead API middleware becomes live; a public deployment requires a
credential instead of being open; and the fix is almost entirely *wiring code that
already exists and is already tested*, not new security design.

**Worse / the costs accepted knowingly:**

- **Every request now needs a token, and the demo gains a login step.** That
  friction is the point, but it means the "open the URL and it just works" flow now
  has one gate in front of it.
- **This reaches generated code**, so it requires a `PLATFORM_MIGRATIONS` entry
  (ADR-082) describing the change in developer-owned code that authors must react
  to, and a regeneration of all `examples/**` (21 MFEs) — a large but mechanical
  diff, gated by `check:mfe-drift` and `check:mfe-consistency`.
- **A shared secret is a shared secret.** Anyone given the passphrase has full
  access, and a leaked passphrase compromises the whole demo until rotated. This is
  an accepted limit of demo-grade auth, not an oversight.

## References

- ADR-007 — *Authorization Expression Grammar*: defers authorization; this ADR
  stays on the authentication side of that line and does not supersede it.
- ADR-046 — *Environment Configuration and Secret Validation*: `JWT_SECRET` is
  validated at boot under its rules; this ADR relies on that for the deployed
  secret.
- ADR-027 — *GraphQL Mesh v0.100.x with Production Plugins & Transforms*: the BFF
  context is injected via the Envelop plugin this ADR modifies to verify signatures.
- ADR-052 — *BFF Demo Mode — Per-Request Mock Switch via resolversComposition*:
  the header-driven demo posture this authentication gate sits alongside.
- ADR-082 — *The platform reports its own breaking changes in code it does not own,
  and never rewrites that code*: governs the migration entry this change requires.
