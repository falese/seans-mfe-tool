---
id: 0099
title: Google signs in the user, the backend mints the fleet's own verified bearer token, and an allowlist decides who gets in
status: Proposed
date: 2026-09-17
deciders: [sean]
area: Security / authentication
enforcement: code
tags: [authentication, oauth, oidc, jwt, security, deployment, bff]
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
  public deployment is fully open. This ADR closes it with a login the fleet can
  put in front of execs: Google (OIDC) authenticates the person; the backend
  verifies Google's ID token, checks an email/hosted-domain allowlist, and mints a
  short-lived HS256 fleet token; the shell attaches that token and the BFF and API
  tiers verify it. It secures the demo and gives it real identity; it does not add
  authorization.
rationale-summary: >-
  Google is chosen over a shared passphrase because "Sign in with Google" reads as
  production-grade and yields verified identity (sub/email) that the deferred
  authorization work will later map to roles. But Google authenticates anyone with
  an account, so identity alone does not gate a public demo — the allowlist does,
  at the one backend chokepoint where the Google token is exchanged. The fleet keeps
  minting and verifying its own HS256 token rather than verifying Google's RS256
  token in nine services, so the BFF/API verification stays the simple wiring the
  primitives already support (`validateJWT`, the API middleware) instead of a JWKS
  client duplicated across the fleet.
long-form: true
---

## Context

Deploying Meridian Station to a public host (a static front end over a backend on
a PaaS) exposes three domain APIs, six GraphQL BFFs, and the control-plane daemon
to the open internet. Every one of those tiers is unauthenticated today, even
though the token machinery to close them is already present and correct. The gap is
not missing code — it is unwired code:

- **The API imports its auth middleware and never applies it.**
  `examples/meridian-station/apis/harbormaster-api/src/routes/berths.route.js:4`
  does `const { auth } = require('../middleware/auth')`, and then line 12 mounts
  the route as `router.get('/', validateSchema(...), listBerths)` with no `auth` in
  the chain. The middleware (`.../middleware/auth.js:17`) performs a real
  `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` and is dead code. It
  is generated from `packages/plugin-api/templates/api/base/**`, so every generated
  API inherits the same dead wiring.

- **The BFF extracts the token but never verifies its signature.**
  `packages/plugin-bff/templates/mesh-context.js.ejs` (`extractUserIdFromToken`)
  base64-decodes the JWT payload to read `sub`/`userId` and injects `context.jwt`
  without checking the signature. The runtime already ships the correct check —
  `validateJWT` in `packages/runtime/src/handlers/auth.ts:16` verifies HS256 and
  sets `context.user` — but no BFF calls it. A forged, unsigned payload is trusted.

- **Nothing issues a token.** There is no `jwt.sign` and no login endpoint anywhere
  in the fleet; the only tokens in the tree are `fake-jwt-*` strings in an unrelated
  Phase-1.3 e2e (`tests/e2e/authentication.spec.ts`).

The daemon already threads a per-session JWT into its authorize step
(`packages/control-plane/daemon/simple-daemon.js:363`), but the shell never
populates it: `createSession()` in
`examples/meridian-station/shell/src/App.tsx:31` mints a random `sessionId` and
attaches no credential.

A shared demo passphrase would close the hole, but the demo is shown to
executives, and a passphrase reads as a toy. Google OIDC reads as production-grade
and returns verified identity that the deferred authorization work (ADR-007) will
later map to roles. The catch is that **Google authenticates anyone with a Google
account** — authentication is not gatekeeping. So the design must add an allowlist,
and must decide where Google's token is trusted.

ADR-007 defers the *authorization* grammar and forbids implementing it until a
superseding ADR exists. That deferral is not the blocker here: securing a demo
needs *authentication* and a coarse *allow/deny*, not a role model. This ADR stays
on that side of the line.

## Decision

A deployed fleet **rejects any request that does not carry a valid, fleet-signed
bearer token.** The token is obtained by signing in with Google, and who may obtain
one is decided by an allowlist at a single backend chokepoint. Concretely:

### 1. Google (OIDC) authenticates the person; the SPA uses Authorization Code + PKCE

The static front end runs the OAuth 2.0 Authorization Code flow with PKCE (no
client secret in the browser) against Google, requesting the `openid email profile`
scopes, and receives a Google **ID token** (RS256).

### 2. The backend exchanges the Google token for the fleet's own token, and gates there

One backend endpoint accepts the Google ID token, verifies it against Google's JWKS
(`iss`, `aud` = our client id, `exp`, signature), and then **checks the verified
`email` (or the `hd` hosted-domain claim) against an allowlist.** A caller not on
the allowlist is rejected here — this is the demo's gate. A caller on it receives a
short-lived HS256 **fleet token** signed with `JWT_SECRET`, carrying `sub`, `email`,
and a bounded `exp`. Google's RS256 token never travels past this endpoint.

### 3. The BFF verifies the fleet token's signature before any resolver runs

The generated BFF context (`mesh-context.js`) calls the runtime's `validateJWT`
against `JWT_SECRET` and populates `context.user` from the *verified* claims.
`extractUserIdFromToken`'s unverified base64 decode is removed — a decoded-but-
unverified payload is never trusted. A missing or invalid token yields a
`SecurityError`, not a silently anonymous context.

### 4. The API tier mounts its existing auth middleware on every data route

The generated route templates apply `auth` ahead of each data handler, so the
already-present HS256 verification actually runs. `/health` and liveness routes stay
open; every `/api/*` data route is closed.

### 5. The shell gates on the fleet token and propagates it

The shell shows a Google sign-in, exchanges the result for the fleet token (§2),
stores it per-tab, attaches `Authorization: Bearer <token>` to BFF calls, and
populates the daemon session's `jwt` so the existing authorize step and downstream
hops receive it. Sign-out clears it and returns to the gate.

### 6. The secret and client config are required, with no deployed default

`JWT_SECRET` is validated at boot per ADR-046; the deployed configuration supplies a
real secret, the Google client id, and the allowlist as config vars, and never the
committed `meridian-demo-not-a-secret` placeholder. WebSocket and HTTP origins use
`wss://`/`https://` and CORS is scoped to the front-end origin.

## Boundaries

- **This is authentication plus a coarse allow/deny, not authorization.** The fleet
  token carries identity, not role or permission claims that gate capabilities;
  every allowlisted holder can reach everything. Roles, permissions, ownership, and
  the expression grammar remain deferred under ADR-007. This ADR does not supersede
  it.
- **Google is the identity provider, not the fleet's token verifier.** The fleet
  verifies its own HS256 token; Google's RS256 token is verified only at the
  exchange endpoint. The nine downstream services gain no JWKS client. Swapping to
  verifying Google tokens fleet-wide, or adding a second IdP, is a later decision.
- **The allowlist is coarse.** It is an email/domain allow/deny at one endpoint, not
  per-resource access control. For a demo it may be Google's OAuth "test users"
  list (test mode caps at 100 explicitly listed users), which doubles as the
  allowlist with no consent-screen verification.
- **Scope is the reference fleet's deployment posture.** It changes the generated
  BFF/API templates (so all generated MFEs inherit verified auth), the Meridian
  shell, and the backend (a token-exchange endpoint). It does not harden the
  registry/daemon admin surface beyond passing the session token through the path
  that already expects it.

## Consequences

**Better:** the confused-deputy hole (BFF trusting an unverified payload) is closed;
the dead API middleware becomes live; a public deployment requires a real, gated
login instead of being open; the demo gains verified identity that the future
authorization work can build on; and the downstream verification is still the simple
HS256 wiring the primitives already support, not a JWKS client copied into nine
services.

**Worse / the costs accepted knowingly:**

- **Setup and moving parts.** A Google Cloud project, an OAuth client, a consent
  screen, and per-environment redirect URIs (local, the front-end origin, the
  backend) now exist and must be kept in sync. The PKCE exchange and the mint
  endpoint are new code with their own failure modes.
- **Google's SPA flow does not hand browsers refresh tokens.** The fleet token is
  short-lived and re-auth is periodic — acceptable for a demo, not a
  session-persistence design.
- **This reaches generated code**, so it requires a `PLATFORM_MIGRATIONS` entry
  (ADR-082) for the change developers must react to, and a regeneration of all
  `examples/**` — a large but mechanical diff, gated by `check:mfe-drift` and
  `check:mfe-consistency`.
- **The allowlist is the whole gate.** A misconfigured or empty allowlist either
  locks everyone out or lets every Google account in; the gate is exactly as good as
  that one config var.

## References

- ADR-007 — *Authorization Expression Grammar*: defers authorization; this ADR
  stays on the authentication side of that line and does not supersede it.
- ADR-046 — *Environment Configuration and Secret Validation*: `JWT_SECRET` and the
  Google/allowlist config are validated at boot under its rules.
- ADR-027 — *GraphQL Mesh v0.100.x with Production Plugins & Transforms*: the BFF
  context is injected via the Envelop plugin this ADR modifies to verify signatures.
- ADR-052 — *BFF Demo Mode — Per-Request Mock Switch via resolversComposition*: the
  header-driven demo posture this authentication gate sits alongside.
- ADR-082 — *The platform reports its own breaking changes in code it does not own,
  and never rewrites that code*: governs the migration entry this change requires.
