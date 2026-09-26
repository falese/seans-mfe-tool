---
id: 0106
title: >-
  The query capability keeps its error envelope, and a transport failure in it is typed — one
  status mapping, shared by the capability and the generated BFF client, on every target
status: Proposed
date: 2026-09-26
deciders: [sean]
area: Runtime / capabilities / query
enforcement: code
tags: [runtime, query, bff, errors, native-targets]
relates-to: [12, 17, 30, 53, 70, 82, 96, 101, 102]
supersedes: []
superseded-by: []
implements-pdr: []
implemented-by: []
verified-by: []
tracked-by: ["#345"]
summary: >-
  A failed BFF request answered by the query capability stays in the QueryResult envelope, as
  ADR-053 and ADR-096 decided, but each transport error now carries a type, a retryable flag and
  the HTTP status, from one status-to-type mapping. The same mapping decides which typed error the
  generated bff.ts connector throws, so a 404 is no longer reported as a retryable network error.
  The Angular template stops overriding doQuery and inherits BaseMFE.doQuery, as the React
  template already does. Swift and Rust carry the same fields and the same table.
rationale-summary: >-
  The composition smoke job (#345) showed that no shell can tell a transient 503 from a
  misconfigured endpoint: the live path returns an untyped message. Throwing instead would
  reverse the envelope policy all three targets share, and would route a transient failure
  through the capability error boundary. Typing the envelope's transport errors fixes the
  observable gap additively. Existing callers keep working and no developer-owned code has to
  change.
long-form: true
---

## Context

The platform says a failure is classified: typed errors carry a `type` and a `retryable` flag, and
a caller branches on those rather than on message text (ADR-017, ADR-030). The `query` capability
is the one place the composed fleet calls a BFF, and it is the one place that promise does not
hold.

**What the composed fleet actually does with a 5xx.** The abc-kids shell fetches a game's data with
`mfe.query()` (`examples/abc-kids/shell/src/components/GameLauncher.tsx`). That is
`BaseMFE.doQuery`, which on any non-2xx *returns*:

```ts
{ data: null, errors: [{ message: 'BFF request failed: 503 Service Unavailable' }] }
```

It has no type, no `retryable` flag and no status. The shell swallows it. A 503 during a deploy and
a 404 from a wrong endpoint are indistinguishable except by parsing a string.

**#342 fixed a different path.** It made the generated `bff.ts` connector throw
`NetworkError(msg, status)`. But no game UI imports `bff.ts`, and flappy exposes only `./App`, so
the fixed code is not in the composed bundle at all. The composition smoke job (#345, PR #400) was
meant to assert #342's claim in a browser, and would have failed. #342's unit demo is true. It is
just about a different path.

**The two web lanes already disagree.** The React template inherits `BaseMFE.doQuery` (ADR-053 §2).
The Angular template still emits a `doQuery` override that routes through `bff.ts`, catches the
typed error it throws, and flattens it back to `{ message }`
(`packages/codegen/templates/base-mfe-angular/mfe.ts.ejs:88`). The override's comment also offers
`inputs.bffUrl` as an override, and the code never reads it.

**`NetworkError` is retryable by construction.** `NetworkError.retryable` is the literal `true`
(`packages/contracts/src/errors/NetworkError.ts`), and `bff.ts` throws one for every non-2xx. So a
404 or a 401 from the connector is reported as retryable today.

**The envelope is deliberate, and shared.** ADR-053 §3 chose in-band errors for a non-2xx: "a
runtime error visible in the query result rather than a call-site JS exception". ADR-096 applied
the same split to the native targets: the capability answers with an envelope, and the typed client
throws. Swift and Rust implement it with the comment "`query` answers with errors, it does not
throw" (`MFEBase.swift.ejs`, `mfe_base.rs.ejs`), and ADR-102 requires every target to implement the
same base-class contract.

## Decision

The `query` capability keeps answering with an envelope. A transport failure inside that envelope
is typed, from one mapping that the capability and the generated BFF client share.

### 1. Transport errors in `QueryResult.errors` are typed

`QueryError` gains three optional fields:

```ts
interface QueryError {
  message: string;
  path?: string[];
  type?: 'network' | 'security' | 'validation' | 'system';
  retryable?: boolean;
  status?: number;
}
```

`BaseMFE.doQuery` sets all three on the error it returns for a transport failure: a non-2xx, or
`fetch` rejecting with no response. The message is unchanged, so code that reads it keeps working.
A caller branches on `errors.some((e) => e.retryable)` instead of parsing text.

GraphQL errors in a 2xx response are **not** transport errors and stay as they are,
`{ message, path }`. A partial response is a normal GraphQL outcome, and whether it is retryable is
the resolver's business, not the transport's.

### 2. One mapping from HTTP outcome to type

| Outcome | `type` | `retryable` | Error the connector throws |
|---|---|---|---|
| `fetch` rejected, no response (offline, DNS, refused, CORS) | `network` | `true` | `NetworkError`, status `0` |
| `408`, `429`, any `5xx` | `network` | `true` | `NetworkError` |
| `401`, `403` | `security` | `false` | `SecurityError` |
| `400`, `422` | `validation` | `false` | `ValidationError` (field `document`) |
| any other `4xx` (`404`, `405`, …) | `system` | `false` | `SystemError`: the endpoint is misconfigured, ADR-053 §3's case |

It is one exported function in `packages/contracts`, `classifyHttpOutcome(status | undefined)`,
re-exported by the runtime. `BaseMFE.doQuery` uses it to fill §1's fields. The generated `bff.ts`
uses it to choose which typed error to throw, instead of throwing `NetworkError` for everything.
The `type` strings are the typed errors' own `type` values, so the envelope and a thrown error
classify the same failure the same way.

### 3. The Angular template inherits `doQuery`

`base-mfe-angular/mfe.ts.ejs` stops emitting its `doQuery` override, as ADR-053 §2 did for React.
Both web lanes then share one URL resolution (including `inputs.bffUrl`), one header policy and
§1's typed errors. The file is generator-owned, so regeneration carries the change to every Angular
MFE.

### 4. Swift and Rust carry the same fields and table

`QueryError` in `Types.swift.ejs` and `types.rs.ejs` gains `type`, `retryable` and `status`, with
the same names, optionality and encoding as §1. `MFEBase.doQuery` / `do_query` fill them from the
same table when `GraphQLPost.send` fails. `BFFError.network` / `MfeError::Transport` already carry
the status, so no new transport plumbing is needed. The table is pinned by a frozen-literal test in
each lane (the ADR-096 pattern), so the three copies cannot drift apart silently.

### 5. Replaces ADR-053 §3's contract, and only that section

Once this is accepted, a `RemoteMFE` with no BFF that calls `query()` still receives
`{ data: null, errors: [...] }` rather than an exception. But the error now reads
`{ type: 'system', retryable: false, status: 404, … }`. ADR-053 §1 and §2 stand unchanged.
ADR-053 is not edited; this section is the record of the change.

## Boundaries

- **`query()` does not start throwing.** A throw would reverse the envelope policy three targets
  share (ADR-053 §3, ADR-096). It would also run through `executeCapability`'s error boundary,
  which fires the `error` lifecycle phase for what is often a transient blip. Considered and
  rejected (see Consequences).
- **No retry is added.** This makes retry *decidable*; it does not perform it. Whether and when to
  retry stays with the caller, as ADR-030 already leaves it.
- **`Retry-After` is not surfaced.** A 429 or 503 may carry one, and `status` is enough to know it
  might. Carrying the header is a later, additive field.
- **GraphQL-level errors stay untyped** (§1). Classifying resolver errors would need a convention
  in the BFF's error extensions, and that is a separate decision.
- **The generated `bff.ts` keeps throwing.** Its callers decode into a type and should not silently
  receive half a response (ADR-096 §Boundaries). Only *which* error it throws changes (§2).

## Consequences

**Better**

- A shell can tell a transient 503 from a misconfigured endpoint without parsing a message. #345's
  composition job can assert #342's intent on the path the fleet actually runs:
  `errors[0]` reads `{ type: 'network', retryable: true, status: 503 }`.
- The two web lanes stop disagreeing about `query()`, and the Angular lane gains the `bffUrl`
  override its generated comment already promised.
- A 404 or a 401 from `bff.ts` stops claiming to be retryable.

**Worse, and accepted**

- **Three runtimes change in one decision.** ADR-102 makes that the price of any contract change,
  and the frozen-literal pins are what keep it honest afterwards.
- **`bff.ts` callers that caught `NetworkError` for every failure now see `SecurityError`,
  `ValidationError` or `SystemError` for 4xx.** `bff.ts` is generator-owned, but code that
  *catches* its errors is developer-owned. This needs a `PLATFORM_MIGRATIONS` entry (ADR-082)
  matching a `catch` that narrows on `NetworkError` around a `bff.ts` call. The fleet has no such
  code today (no game UI imports `bff.ts`), so the entry is there for adopters.
- **The envelope is richer, not stricter.** A caller that ignores `errors` still ignores them, and
  the fix only helps callers that look. The shell in `examples/abc-kids` is updated to look, as the
  worked example.

**Rejected alternative: throw on transport failure.** It gives the strongest signal, and it is what
the generated connector does. It was rejected because it reverses a policy three targets
deliberately share, and because every existing caller would need a `try`/`catch` to keep today's
behaviour. That makes it a breaking change to developer-owned code, with a migration for every
shell.

## References

- ADR-012 — the GraphQL Mesh BFF generated from a manifest's `data:` section; what `query` calls.
- ADR-017 — typed errors instead of `throw new Error()`; the `type` values §1 reuses.
- ADR-030 — error classification and retry; this makes a query failure classifiable, and leaves retry with the caller.
- ADR-053 — `BaseMFE.doQuery` is the single web implementation; §3's error contract is replaced by §5 here.
- ADR-070 — the uniform no-data contract; an MFE with no `data:` still answers `{ data: null }`, untouched.
- ADR-082 — platform migrations; the entry §Consequences requires for `bff.ts` catch sites.
- ADR-096 — the native lifecycle contract and its envelope-versus-typed-client split, kept here.
- ADR-101 — Rust implements all ten capabilities, `query` among them.
- ADR-102 — every target implements the base class; why §4 lands with §1.
- #345 — the composition smoke job that found the gap, and the assertion it holds until this lands.
