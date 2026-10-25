# Decompose a monolith — start to finish

This guide walks one monolith through every step that is built today, using the reference app
`examples/meridian-monolith`. Each command's own page is reference: flags, formats, limits. This page gives the
order, and what to check between steps.

**When you lose your place, run `flow:status`.** It reads the evidence folder and prints which
steps are done, which are out of date, which are waiting on a person, and the next command with
its arguments filled in ([flows](./flows.md)):

```bash
seans-mfe-tool flow:status ./evidence
```

The report lists each step with its state and ends with the command to run next:

```
  Decompose a monolith into MFEs  /work/evidence

  ✓ Run the app and record what it does
  ✓ Read the app's source, joined to the capture
  ✓ Propose the domains
  ○ Shape the proposal — merge, split, rename, ask the agent — 1 suggestion waiting
  ↻ Write the review package — proposal/decomposition.yaml changed after proposal/PROPOSAL.md was written
  ✓ Approve the proposal — approved by Sean
  ✗ Generate the MFEs, their BFFs and the legacy wrapper — not built yet (#410)
  · Prove the composed app behaves like the monolith — waits on scaffold

  next: seans-mfe-tool decompose:present /work/evidence/proposal
```

The steps below are the same ones, in order. Each names what it writes. Steps 5–7 (build, move, switch
over) are not built yet ([#410](https://github.com/falese/seans-mfe-tool/issues/410)).
The order and the commands live in one place, `flows/decompose.yaml`; `flow:status` reads it.

## Before you start

- **Build the CLI** from the repository root: `npm install && npm run build`.
- **Run the monolith** with its dependencies installed. A missing `npm install` shows up as
  `webpack: command not found`.
  - For meridian, start the backends and then the app, as its
    [README](../examples/meridian-monolith/README.md#run-it) describes. The app is on
    `http://localhost:5090`.
- **Use a development build of the app.** That is what lets capture map each screen region to
  its source file.
- **Use absolute paths, or one working directory throughout.** The examples below run everything
  from one directory that holds `./evidence`.

## 1. Watch the app

```bash
seans-mfe-tool decompose:capture http://localhost:5090 --out ./evidence --explore 20
```

`--explore 20` clicks through up to 20 interactions on its own. To drive specific journeys
instead, write a journeys file and pass `--journeys journeys.yaml`; the file has to exist.
→ [decompose-capture](./decompose-capture.md)

## 2. Read the code

```bash
seans-mfe-tool decompose:analyze /abs/path/to/examples/meridian-monolith --evidence ./evidence
```

**Always pass `--evidence`.** It writes the analysis inside the bundle (`evidence/source/`) and
joins observed traffic to the code that made it. Without it, no observed call can be explained.
→ [decompose-analyze](./decompose-analyze.md)

## 3. Suggest the pieces

```bash
seans-mfe-tool decompose:propose ./evidence
```

Pass the bundle itself; propose finds `source/` inside it. It writes `evidence/proposal/`: the
plan, a copy of the untouched draft, each piece's manifest and data description, and the
composition. → [decompose-propose](./decompose-propose.md)

## Shape it (optional)

There are three ways in, and all three go through the same checked edits:

```bash
# The workspace — for product owners (once, in the repository: npm run build:workspace)
seans-mfe-tool decompose:workspace ./evidence/proposal        # open http://127.0.0.1:4611

# Named edits from the command line
seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml --rename-domain shell=console

# Ask the agent (needs ANTHROPIC_API_KEY); its edits arrive as suggestions to accept or reject
seans-mfe-tool decompose:ask ./evidence/proposal "Split hazards out of cargo — they are a separate team"
```

→ [decompose-workspace](./decompose-workspace.md)

## 4. Review and approve

```bash
seans-mfe-tool decompose:present ./evidence/proposal
```

This writes `PROPOSAL.md`, the screens with each piece outlined, and a Figma plugin. Run it
again after any edit: `flow:status` marks the package out of date once the plan changes.

**Approving is a person's step.** Use the workspace's Approve tab, which also commits the
proposal to git unless you pass `--no-commit`, or:

```bash
seans-mfe-tool decompose:edit ./evidence/proposal/decomposition.yaml \
  --ops '[{"kind":"approve","by":"Your Name","at":"2026-10-25T12:00:00Z"}]'
```

An approval records exactly which version of the plan was approved. Any later change to the
pieces makes it out of date, and `flow:status` says so.

## 5–7. Build, move, switch over

Not built yet ([#410](https://github.com/falese/seans-mfe-tool/issues/410)). `flow:status` shows
this step as not available, and stops here.

## 8. Check nothing changed

Once the split app runs, replay the captured journeys against it:

```bash
seans-mfe-tool decompose:verify ./evidence --url http://localhost:<the composed shell>
```

→ [decompose-verify](./decompose-verify.md)

## Scoring against an answer key (optional)

For a reference app with a known right answer, such as meridian's `answer-key.yaml`:

```bash
seans-mfe-tool decompose:score ./evidence/proposal/decomposition.yaml \
  --answer-key examples/meridian-monolith/answer-key.yaml
```

## When something goes wrong

| You see | Cause | Do |
|---|---|---|
| `webpack: command not found` while capturing | The monolith's dependencies are not installed | `npm install` in the monolith |
| capture: the journeys file does not exist | `--journeys` names a missing file | Write the file, or use `--explore N` |
| analyze: "not an evidence bundle (no requests.json)" | `--evidence` points somewhere other than the capture's `--out` | Pass the capture's folder |
| propose: the analysis is not found | Analyze ran without `--evidence`, so it wrote elsewhere | Re-run analyze with `--evidence ./evidence` |
| `flow:status` says a step is out of date | Something it was built from changed | Run the command it names |
| The workspace says no agent is connected | No `ANTHROPIC_API_KEY` in the shell that started it | Export the key and restart, or carry on without the agent |
