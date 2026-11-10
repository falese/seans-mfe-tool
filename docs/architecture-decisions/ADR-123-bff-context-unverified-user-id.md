---
id: 0123
title: >-
  A generated BFF names the id it reads from an unverified token `unverifiedUserId`
status: Implemented
date: 2026-11-10
deciders: [sean]
area: BFF / context / security
enforcement: code
tags: [bff, security, jwt, context, migration]
relates-to: [12, 27, 82]
supersedes: []
superseded-by: []
implements-pdr: []
implemented-by:
  - packages/plugin-bff/templates/mesh-context.js.ejs
  - packages/plugin-bff/templates/server.ts.ejs
  - packages/codegen/src/platform-migrations.ts
verified-by:
  - packages/plugin-bff/src/__tests__/unverified-user-id.test.ts
  - packages/codegen/src/__tests__/platform-migrations.test.ts
tracked-by: []
summary: >-
  The Mesh context field `userId` is renamed `unverifiedUserId` in every generated BFF. It is
  the `sub` claim read from the bearer token's payload without checking the signature. A
  platform migration reports developer-owned code that still reads the old name.
rationale-summary: >-
  Verifying the token in the BFF was the alternative. It needs the BFF to hold a key, which no
  fleet configures, and it would change which requests succeed. Renaming changes no behaviour
  and makes the field say what it is at every place it is read.
long-form: true
---

## Context

ADR-027 has a generated BFF inject request-derived fields into the GraphQL context through an
Envelop plugin, `mesh-context.js`. One of them was `userId`: the plugin splits the bearer
token, base64-decodes the payload and returns its `sub`.

Nothing checks the signature. The BFF forwards the token to the services behind it and holds
no key of its own. So a caller can send any token with any `sub`, and `context.userId` reports
it. The 2026-11 readiness review recorded this as SEC-05
(`docs/reviews/2026-11-platform-readiness/`).

A field called `userId` on a server-side context reads as an identity. A resolver that filters
by it returns another user's data to anyone who asks.

## Decision

### 1. The field is `unverifiedUserId`

In `mesh-context.js`, in the `MeshContext` type in `server.ts`, and in the comment in
`.meshrc.yaml`. All three are generator-owned, so regeneration carries the rename.

### 2. Its comment says what it is for

A log line, a label, a cache hint. Not authorization. To authorize, verify the token, or leave
the decision to the service the BFF calls: that service receives the token and can check it.

### 3. Developer-owned code is told

`PLATFORM_MIGRATIONS` gains `bff-context-unverified-user-id` (ADR-082). It matches a read of
`userId` off a context named `context` or `ctx`, direct or destructured, and its fix tells the
two cases apart: rename a read that only labels; do not rename a read that authorizes, verify
instead.

## Boundaries

- **The BFF still does not verify tokens.** This names the gap; it does not close it.
- **The migration reads code, not manifests.** An `operationHeaders` entry using
  `{context.userId}` in `mfe-manifest.yaml` is not detected. The fix text says to look.
- **A context under another name is not detected.** `({ userId }, _args, c)` with `c` as the
  context goes unreported.
- No fleet in this repository read the field, so nothing here changed behaviour.

## Consequences

Better: the name carries the warning to every call site, including ones written later.

Worse: this is a breaking change to the generated BFF's context. A resolver that reads
`context.userId` gets `undefined` after regeneration, until it is updated. That failure is
visible, which is the point, but it is still a break.

## References

- ADR-012 — the GraphQL BFF this context belongs to.
- ADR-027 — GraphQL Mesh v0.100.x and its plugins, among them the context plugin whose field
  this renames.
- ADR-082 — platform migrations, the mechanism that reports the rename to developer-owned code.
