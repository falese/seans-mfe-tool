---
id: 0012
title: SMT knows its multi-command flows — where a person or an agent is in one, and what to run next — instead of leaving the order to docs, scripts and memory
status: Accepted
date: 2026-10-25
deciders: [sean]
supersedes: []
superseded-by: []
tags: [workflow, orchestration, developer-experience, agent, decomposition, mcp]
summary: SMT's real tasks are flows of several commands — decompose a monolith, create and build an MFE — and today the order, the preconditions and where each step reads and writes live only in documentation, npm scripts and people's heads. The platform takes ownership of them. Each flow is described once, as data, and SMT reports where a given directory stands in it — what is done, what is stale, what is waiting on a person, and the exact next command — derived from the artifacts on disk. The decomposition flow is first, through `flow:status`.
---

# PDR-012: SMT knows its multi-command flows — where a person or an agent is in one, and what to run next

## Problem space

**Every SMT task worth doing is a flow, not a command.**
- Decomposing a monolith (PDR-011) runs capture, analyze, propose, shape, present, approve,
  then scaffold, port and strangle, then verify.
- Creating an MFE runs init, generate, then the build with its Mesh and BFF steps, then
  Docker.
- Each command is well made on its own: typed errors, one JSON envelope, an MCP tool per
  command (PDR-003).
- No part of the platform knows the order, what each step needs from the one before, or where
  that output lands.

**The cost is measurable.** The first run of the decomposition flow against meridian-monolith
(#425) took five wrong turns before the first proposal:
- a monolith with no `npm install`;
- a journeys file that did not exist;
- a proposal pointed at the wrong directory;
- an analysis not joined to its capture;
- relative and absolute paths mixed.

Each command reported its own failure correctly. None could say where the user was in the
flow, because none knows there is one.

**The build flow has the same problem.** Its order is written four times, in places that know
nothing of each other:
- npm scripts (`build:workspace` is four commands in one string);
- turbo pipelines;
- one shell script per fleet;
- the verification table in CLAUDE.md, a hand-kept workflow that warns about the same
  stale-build trap three times.

**An agent driving SMT over MCP has it worst.** It sees every tool's schema and nothing about
their sequence, so the next tool is always a guess.

## Decision

SMT owns its flows.

- Each flow is described once, as data, beside the commands it sequences. A description says:
  - the steps, and the command each one runs;
  - what each step needs from earlier steps;
  - where each step writes;
  - which steps are a person's decision rather than a command.
- Given a directory, SMT reports where it stands in a flow:
  - which steps are done;
  - which are stale, because something upstream changed after them;
  - which are waiting on a person, and which are not available yet;
  - the exact next command, with its arguments filled in from what is already on disk.
- The state is derived from the artifacts every time. Nothing records progress, so nothing
  can disagree with the files.

The decomposition flow is first, and `flow:status` is the first surface. A `next` hint in every
command's JSON envelope, running the remaining steps, and the init → generate → build flow
come later, on the same definitions.

## Why this over alternatives

- **Better error messages per command.** Done for three of the five wrong turns (#450). That
  treats the symptom. A command can say what *it* lacks, not that a different command should
  have run first, or that its output is now stale.
- **A playbook document, or an agent skill.** These are prose, so they drift. A description
  that the platform reads can be checked against the commands it names, and it serves people
  and agents from one source.
- **A general workflow engine** (DAG, retries, a run database). turbo already caches builds,
  and CI already sequences gates. What is missing is *knowing* the flow, not executing it, and
  a run database would be a second record of progress that can disagree with the files.

## Success signals

- A first-time user runs the decomposition flow on a new monolith by following `flow:status`
  alone, and none of #425's wrong turns recurs.
- An agent over MCP calls `flow:status` and then the command it names, and never calls a
  decompose command out of order.
- `flow:status` names the step a later change made stale. For example, PROPOSAL.md after an
  edit, or an approval after a change.
- When the build flow is added, the verification table in CLAUDE.md shrinks rather than grows.

## Consequences / trade-offs

- **Each flow description is a contract to keep current.** A new command, or a changed output
  path, must update its flow. A gate has to check that every command a flow names exists.
- **"Done" means only that the right artifacts exist and are fresh.** A step whose output
  exists but is wrong still reads as done. Each command's own validation stays the authority
  on correctness.
- **The CLI gains a topic (`flow`)** and a small engine package.
- **Some steps are not built yet** (scaffold, port and strangle; #410). They show as not
  available, so the flow is honest about the gap rather than hiding it.

## Implemented by

- ADRs: ADR-119
- Issues: #452
- Code: `packages/flow/`, `flows/decompose.yaml`, `src/flow/index.ts`, `src/commands/flow/status.ts`; explainer `docs/flows.md`
