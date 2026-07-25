---
# Copy this file to ADR-NNN-short-slug.md. Take NNN from the next free slot in
# docs/spec.md#adr-index — that table is generated, so read it, don't edit it.
#
# `npm run check:adr` validates everything below. `npm run build:adr-index`
# regenerates the index and the PDR map from it; commit both.
id: 0000
title: A sentence that states the decision, not the topic

# Proposed | Accepted | Implemented | Deferred | Superseded | Withdrawn (ADR-075 §2).
#
#   Proposed     a proposal, not a plan. Code may not cite it.
#   Accepted     ratified. Must name the code that carries it (implemented-by)
#                or the issues that will (impl.refs) — ADR-075 §6.
#   Implemented  code is in place. Requires a non-empty implemented-by.
#
status: Proposed

# Only when the decision is ratified but the work is not finished. Omit otherwise.
# `deferred` always needs an issue in refs; `phased` should have one too.
# impl:
#   stage: phased      # phased | deferred
#   refs: ["#000"]

date: 2026-01-01
deciders: [sean]

# Sources the Area column of the generated index. Slash-separated, e.g.
# "Runtime / slots / addressing" or "Codegen / dependencies".
area: Area / sub-area

# code = a gate or the type system enforces it; convention = humans do;
# tooling = a build step does; none = neither.
enforcement: code

tags: [tag, tag]

# ADRs this one builds on, argues with, or replaces. Numbers only.
relates-to: []
supersedes: []
superseded-by: [] # both directions are required and checked

# Product decision(s) this serves, e.g. [1] for PDR-001. Drives the PDR↔ADR map.
implements-pdr: []

# Repo-relative paths to the code carrying this decision. Checked to exist.
# Required once status is Implemented. Honest [] beats an invented path.
implemented-by: []

# npm script names or test paths that demonstrate it holds. Optional, but every
# entry must resolve to a real script or file.
verified-by: []

# Long prose fields use a block scalar. An unquoted YAML scalar ends at the
# first ": " — the defect that left ADR-043 and ADR-052 silently unparsed.
summary: >-
  One paragraph. What changes, and what becomes true that was not true before.
rationale-summary: >-
  One paragraph. Why this rather than the obvious alternative.
long-form: true
---

## Context

What forced the decision. Prefer evidence over assertion: the file and line that
broke, the gate that did not catch it, the two artifacts that disagreed. If a
prior ADR promised something this one has to deliver, cite it and say what was
missing.

## Decision

State it as a rule someone could follow or violate, then number the parts that
can be argued with separately.

### 1. …

### 2. …

## Boundaries

What this deliberately does *not* do, and where a reader would be wrong to
assume it applies. A heuristic says so here. A gate that only covers part of a
surface says which part.

## Consequences

What gets better, what gets worse, and the trade-off you accepted knowingly.
Name the cost — an ADR with no cost section is usually one that has not been
thought through.

## References

- ADR-NNN — how it relates, in a few words. Keep the gloss honest: a citation
  that restates a title has to match it (`reference-gloss-matches`), and a
  short paraphrase is fine.
- #NNN — the issue or PR that tracks the work.
