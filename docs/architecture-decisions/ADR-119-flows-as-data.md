---
id: 0119
title: >-
  A flow is a YAML description of steps, their commands, their inputs and outputs and the human
  gates between them; its state is derived from the artifacts on disk, never recorded; flow:status
  reports it and names the next command
status: Implemented
date: 2026-10-25
deciders: [sean]
area: CLI / workflow
enforcement: code
tags: [workflow, flow, cli, agent, decomposition, mcp]
relates-to: [19, 89, 109, 110, 113, 116, 118]
supersedes: []
superseded-by: []
implements-pdr: [12]
implemented-by:
  - packages/flow/src/flow.ts
  - packages/flow/src/status.ts
  - flows/decompose.yaml
  - src/flow/index.ts
  - src/commands/flow/status.ts
verified-by:
  - packages/flow/src/__tests__/status.test.ts
  - src/flow/__tests__/decompose-flow.test.ts
  - src/__tests__/import-direction.test.ts
tracked-by: ["#452"]
summary: >-
  A new package, `@seans-mfe/flow` (on contracts only), defines what a flow is and computes where
  a directory stands in one. A flow is a YAML document: its inputs (values read from artifacts,
  such as the app URL a capture recorded), and its steps — each a command template, the steps it
  follows, the files it produces, the host checks that decide it, whether it is a person's gate,
  and whether it is available yet. State is derived from the filesystem on every call: done,
  stale (an upstream output is newer), waiting (a gate), next, blocked, optional or unavailable.
  The engine is pure over an injected filesystem probe and named checks the host registers. The
  CLI ships the decomposition flow (`flows/decompose.yaml`) and the `flow:status` command.
rationale-summary: >-
  The definition is data so it serves people, agents and later surfaces (envelope hints,
  flow:run) from one source, and so a gate can check it against the commands it names. State is
  derived rather than recorded because a second record of progress would disagree with the files
  the moment someone runs a command by hand. The engine is standalone rather than built on the
  sentinel kernel: its ports validate and locate one artifact type, while a flow is a sequence
  over many. A host check has the shape of a ValidatePort, so a sentinel adapter can be passed
  in where one fits.
long-form: true
---

## Context

PDR-012 decides that SMT knows its multi-command flows, and that the decomposition flow and
`flow:status` come first. The decomposition commands already write a predictable layout, rooted
at the evidence bundle (ADR-109, ADR-110, ADR-118):

| Step | Writes | Reads |
|---|---|---|
| `decompose:capture <url> --out <bundle>` | `bundle.json` (records the app's URL), `journeys/`, `requests.json`, `screens/` | the running app |
| `decompose:analyze <app> --evidence <bundle>` | `source/graph.json`, `source/join.json`, `source/project.json` (records the app's directory) | the app's source, the bundle |
| `decompose:propose <bundle>` | `proposal/proposal.base.yaml`, `proposal/decomposition.yaml`, the derived fleet | `source/` |
| `decompose:edit` / `ask` / `workspace` | `proposal/decomposition.yaml` | the proposal |
| `decompose:present <bundle>/proposal` | `proposal/PROPOSAL.md`, `proposal/overlay/` | the proposal, the bundle |
| approval (a person, in the workspace) | `approval` in `decomposition.yaml` | the proposal |
| scaffold, port, strangle | — not built yet (#410) | |
| `decompose:verify <bundle>` | `../verify/parity.json` | the bundle, the composed app |

Everything `flow:status` needs to know is on disk, or is a fact a command can compute about what
is on disk.

## Decision

### 1. A flow is a YAML document

```yaml
id: decompose
title: Decompose a monolith into MFEs
root: the evidence bundle            # what the directory argument is
inputs:                              # values read from artifacts, for command arguments
  appUrl: { from: bundle.json, field: app, otherwise: <app-url> }
steps:
  - id: analyze
    title: Read the app's source
    after: [capture]
    produces: [source/graph.json, source/join.json]
    command: decompose:analyze {appDir} --evidence {root}
```

Each step has:

- `id` and `title`;
- `after`: the steps it follows;
- `produces`: paths relative to the root. The first entry is the step's *own* output, compared
  for freshness. `..` is allowed;
- `command`: a template over `{root}` and the inputs;
- `check` (optional): a named host check that decides the step instead of, or as well as, its
  files;
- `kind`: `command` (the default), `gate` (a person decides) or `optional` (it never blocks a
  later step);
- `available: false` with `issue`: a step that is planned but not built.

The document is parsed with a zod schema, so a malformed flow fails loudly and names the field.

### 2. State is derived, every time

For each step, in order:

- **unavailable**: `available: false`.
- **blocked**: a step it follows is not done (optional steps never block).
- **done**: every file it produces exists and its check, if any, passes.
- **stale**: done, but no longer true of what it was built from:
  - **by content, where the step declares `from`.** The command records the digest of each
    input beside its first output (`<output>.from.json`, paths relative to the output). A
    step is stale when an input's content differs from what was recorded.
  - **by timestamp otherwise,** or for an output written before provenance was recorded. The
    report then says so.
  - **or its check reports `stale`,** as an approval does after the proposal changes.
- **waiting**: a gate that is not done.
- **next**: the first step that is not done or optional, whose predecessors are all done.
- **ready**: any other step that could run now.
- **optional**: an optional step, whatever its files say. A check may add detail, such as how
  many suggestions are waiting.

`next` is the first `next`-state step, or else the first stale one, with its command rendered.
An input that no artifact supplies yet renders as its `otherwise` placeholder, and the result
says the placeholder needs filling. Nothing is written.

### 3. The engine is a package; the host supplies checks

- `@seans-mfe/flow` (imports `contracts` only) holds:
  - the schema;
  - `loadFlow(yamlText)`;
  - `flowStatus(flow, root, probe, checks)`.
- `probe` is `{ mtime(path), readJson(path), digest?(path) }`, so the engine is pure and
  unit-testable without a disk.
- `writeProvenance(output, inputs)` and `digestFile` are the package's only filesystem code.
  They are what a producing command calls.
- `checks` is a map from name to `(root) => { done, stale?, detail? }`. This is the shape of
  sentinel's `ValidatePort` lifted to a step (ADR-089), so a sentinel adapter can be passed as
  a check. The engine does not import sentinel: its ports locate and validate one artifact
  type, and a flow is a sequence over many.

### 4. The CLI ships the flows and the command

- **Definitions.** Flow definitions live at `flows/<id>.yaml` in the CLI package (published
  with it). The first is `flows/decompose.yaml`.
- **Checks.** The CLI registers the checks the decomposition flow names:
  - `proposal-approved`, from `approvalStatus` in `@seans-mfe/decompose`;
  - `suggestions-waiting`;
  - `at-parity`, from `parity.json`.
- **`flow:status [dir] --flow <id>`.** A core command in a new `flow` topic. It returns one
  envelope with the steps, their states and details, and `next`. Without `--flow` it uses the
  only flow there is; with several, it requires the flag.
- **A gate.** A test checks that every command a shipped flow names exists in the CLI, and that
  every check it names is registered. A renamed command fails CI, not a user.

## Freshness by content, not by clock

The first version (#453) compared modification times, as Make does. That is Make's best-known
weakness, and it applies here in full:

- A `git clone` or a branch switch rewrites every timestamp.
- After one, a review package can read as stale when nothing changed.
- Worse, an edited proposal can read as fresh.

A digest of each input, recorded by the step that read it, cannot be fooled that way.

This is a recorded fact, but it is not a record of progress. The output states what it is true
of, the same way an approval carries the hash of what it approved (ADR-116 §5). Delete the
output, and the fact goes with it. DVC keeps the equivalent digests in a separate `dvc.lock`;
keeping them beside each output means nothing outside the artifacts can disagree with them.

The decomposition steps that record provenance:
- `analyze` (from `bundle.json` and `requests.json`);
- `propose` (from `source/graph.json` and `source/join.json`);
- `present` (from `proposal/decomposition.yaml`).

`capture` reads a running app, which has nothing to hash. `approve` and `verify` are decided by
their checks.

## Prior art

Each of these solves part of the problem. None solves the part SMT needs, and the ones closest
to it inform the design.

| Tool | What it already does | Why it is not the answer here |
|---|---|---|
| **Make, Just, Taskfile** | Targets, prerequisites, "stale if an input is newer", `make -n` for what would run | No human gates. Domain facts (approval still current) must be faked as marker files. Output is for people, not an agent. Make's timestamps are the flaw described above |
| **DVC pipelines** (`dvc.yaml`, `dvc status`, `dvc repro`) | The closest match: stages with command, deps and outs; content hashes; `status` names stale stages | A Python toolchain built around data versioning in git. Hashes live in a lock file beside the repository rather than with each output. No gates, no placeholders, no unbuilt steps. The content-hash idea is adopted from it |
| **Turborepo, Nx** (turbo is in this repository) | A task graph over package scripts, with input-hash caching and `--dry` | Works per workspace package, not per user directory and its artifacts. No gates. The init → generate → build flow should *describe* and *delegate to* turbo, not reimplement its caching |
| **Temporal, Airflow, Argo, Prefect** | Orchestration with retries, schedules and approval steps | Each needs a server and its own run state: the second record of progress PDR-012 rejects. Reconsider only if `flow:run` ever needs retries or scheduling |
| **Backstage scaffolder, Yeoman, Projen** | Guided, multi-step generation | One-shot wizards, with no notion of where an existing directory stands |

What remains SMT's own is small:
- the gates a document decides (the approval hash);
- steps that are not built yet, shown honestly;
- arguments filled from earlier steps' outputs;
- one JSON envelope, which makes it an MCP tool.

That is why the engine is about 300 lines, not a dependency.

## Boundaries

- No command runs. `flow:run` and the `next` hint in every envelope are later decisions, made
  on these definitions.
- `done` means the outputs exist and are fresh. Each command's own validation stays the
  authority on whether they are correct.
- One flow ships now. The init → generate → build flow is the next definition, not a different
  mechanism.

## Consequences

- An agent over MCP gets `flow:status` as a tool, and its `next.command` is a command it can call.
- Changing a decompose command's output path now means changing `flows/decompose.yaml` too. The
  gate catches a renamed command, but not a moved file, so the flow's tests run against a real
  bundle layout.
- The engine is small and has no dependencies beyond contracts and zod, so it can move with
  the kernel if PDR-010's extraction happens.

## References

- PDR-012; #452.
- ADR-109, ADR-110, ADR-113, ADR-116, ADR-118: the decomposition commands and their layout.
- ADR-089: the sentinel ports a check can adapt.
- ADR-019: MCP's one child process per tool call, which `flow:status` inherits as a tool.
