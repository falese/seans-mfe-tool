# Security policy

## Reporting a vulnerability

Please report it privately through GitHub: on this repository, open
**Security → Advisories → Report a vulnerability**. That reaches the maintainer
without making the report public.

Do not open a public issue for a suspected vulnerability.

Include what you can of: the affected command, package or generated file; the
version or commit; and the steps that show the problem. A report does not need
a working exploit.

## What to expect

This project has one maintainer. You should get an acknowledgement within a
week. If the report is confirmed, the fix and an advisory are published
together, and you are credited unless you ask not to be.

## Supported versions

There are no numbered releases yet. Fixes land on `main`.

## What counts

The parts of this repository that take input someone else controls:

| Part | Where the input comes from |
|---|---|
| The MCP server (`mcp:serve`) | An AI agent, which acts on text it has read. Tool calls are treated as untrusted (ADR-121) |
| Code generation | A manifest, which may have been written by a model |
| The decomposition workspace | A browser on the developer's machine |
| Generated BFFs and APIs | End users of the application they belong to |
| The control plane (`packages/control-plane/`) | Anything on the network it is bound to |

## Known limits

Read these before deploying anything from this repository.

- **The control plane is only partly hardened.** A registry write needs a
  token (`REGISTRY_TOKEN`, ADR-124), and a shell can restrict the origins it
  loads remotes from (`allowedRemoteOrigins`). Still open: the daemon and the
  registry's GraphQL endpoint take messages from any caller, an MFE that does
  not declare `authorizeAccess` is treated as authorized, and nothing here is
  transport security. Run it on a network where every peer is trusted, and put
  TLS in front of it.
- **The example fleets use a published development token**, `local-dev-only`.
  Set `REGISTRY_TOKEN` to a real secret before a registry is reachable by
  anything you do not trust.
- **A shell loads remotes from anywhere unless told otherwise.** Set
  `allowedRemoteOrigins` on its `LayoutManager`.
- **A generated BFF does not verify tokens.** It forwards the bearer token to the
  services behind it. The id it reads from the token is named
  `context.unverifiedUserId` for that reason (ADR-123). Do not authorize on it:
  verify the token, or authorize in the service the BFF calls.
- **MCP tool calls run with the server's environment**, including any API keys
  in it.
- **Evidence bundles from `decompose:capture` store API responses as
  received.** Capture against test data, and review a bundle before committing
  it.

The full assessment these come from is in
[`docs/reviews/2026-11-platform-readiness/`](./docs/reviews/2026-11-platform-readiness/D-security-assessment.md).
