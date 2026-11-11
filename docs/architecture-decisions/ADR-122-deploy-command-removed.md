---
id: 0122
title: >-
  There is no `deploy` command; deployment returns as a plugin-resolved target axis, and
  `build:docker` is the way to an image until it does
status: Implemented
date: 2026-11-10
deciders: [sean]
area: Deploy / plugins / scope
enforcement: code
tags: [deploy, plugins, scope, cli]
relates-to: [36, 44, 121]
supersedes: [62]
superseded-by: []
implements-pdr: [4]
implemented-by:
  - src/commands/build/docker.ts
  - src/commands/_docker.ts
verified-by:
  - src/commands/__tests__/deploy-removed.test.ts
  - src/commands/__tests__/docker-exec.test.ts
tracked-by: ["#250"]
summary: >-
  The `deploy` command, its tests and the three Dockerfile templates only it used are deleted.
  ADR-062's second half stands and is carried here: production deployment is not built into
  the CLI and returns as deploy-target plugins resolved the way framework plugins are.
  `build:docker` remains the supported way to get an image.
rationale-summary: >-
  ADR-062 kept `deploy` as a development convenience. It had stopped working: it required
  files the generator no longer emits and looked for its templates where the build does not
  put them, so it could not succeed against any generated MFE. A command that cannot work is
  worse than no command, and its mocked tests held a 90% coverage threshold green throughout.
long-form: true
---

## Context

ADR-062 split `deploy` in two. It removed the unreachable production generators and kept the
development path: copy the project to a temp directory, build an image from a template, run
it as a container.

The 2026-11 readiness review (`docs/reviews/2026-11-platform-readiness/`, finding ARC-04) read
that path against what the generator produces today:

- It required `App.jsx`, `bootstrap.jsx` and `rspack.config.js` in the project. A generated
  React MFE has `App.tsx` and no `bootstrap.jsx`. An Angular MFE has none of the three.
- It resolved its Dockerfile templates one directory above the compiled command. The build
  copies them under `dist/codegen/templates`.
- It swallowed a failed `docker build` unless the message contained the words "Build failed",
  with a comment saying this was for unit-test setup.
- It built its Docker commands as shell strings from the caller's input (ADR-121 §6).

`jest.config.js` held the file to 90% line coverage the whole time. The tests mocked the file
system and the process layer, so they measured the mocks.

## Decision

### 1. The command is deleted

`deploy`, its two test files, its schema, and `dockerfile.remote`, `dockerfile.shell`,
`dockerfile.nodeAPI` and `nginx.conf` under `src/codegen/templates/docker/` are removed.
`nginx.mfe.conf` stays: `build:docker` copies it out of the CLI image.

### 2. `build:docker` is the way to an image

It writes a Dockerfile from the framework plugin's Docker strategy (ADR-036, ADR-044) and,
with `--build`, builds it. Running the image is the operator's.

### 3. Deployment returns as a plugin axis

Unchanged from ADR-062: a deploy target is a plugin, resolved from the manifest the way a
framework plugin is. Nothing in the core CLI knows about Kubernetes, a cloud, or a registry.
A local-container target, if wanted again, is one such plugin.

## Boundaries

- This removes a command from the CLI's surface. Any script that called
  `seans-mfe-tool deploy` now gets the command-not-found envelope.
- It does not touch generated code. No generated project referred to `deploy`.
- The example fleets are unaffected: they build and run through their own compose files.

## Consequences

Better: the help output and the MCP tool list no longer offer something that fails. One
fewer place builds a Docker command. A coverage threshold that measured nothing is gone.

Worse: there is no one-command way to run a single MFE in a container. The steps are
`build:docker --build`, then `docker run`.

## References

- ADR-036 — framework plugins, the model a deploy-target plugin follows.
- ADR-044 — the hardened container image `build:docker` produces.
- ADR-062 — superseded: it kept the development half of `deploy`; this removes it.
- ADR-121 — an MCP tool call is untrusted input; `deploy` was one of the two commands that
  passed that input to a shell.
- #250 — the deploy-target plugin axis.
