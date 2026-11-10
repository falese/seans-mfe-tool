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

- **The control plane has no authentication.** The registry accepts a
  registration from any caller, and the shell loads the script that
  registration names. Run it only on a network where every peer is trusted. It
  is part of the product and is not hardened yet; that work is planned and not
  started.
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
