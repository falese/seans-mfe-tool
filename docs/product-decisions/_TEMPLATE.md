---
id: NNNN
title: <Short product decision, stated as the bet>
status: Proposed | Accepted | Superseded | Rejected
date: YYYY-MM-DD
deciders: [sean]
supersedes: []
superseded-by: []
tags: []
summary: <One sentence a teammate can read in isolation and understand the decision.>
---

# PDR-NNN: <Title>

## Problem space

What pain does this address, and who feels it? Describe the situation *before* this
decision — the friction, the failure mode, the thing that does not scale. Be concrete:
name the teams, the workflow, the artifact that drifts or breaks. This section should
make the decision feel inevitable.

## Decision

The bet, in one paragraph. State what we are doing, not how it is built (the "how"
belongs in the linked ADRs).

## Why this over alternatives

The one or two credible alternatives and why they lost. Keep it short — enough that a
reader does not re-litigate a closed question.

## Success signals

How we will know this was the right call. Prefer observable signals (a team shipped X
without touching Y; an agent generated Z with no human edits) over aspirations.

## Consequences / trade-offs

What this commits us to, what it costs, and what becomes harder. Honest about the
negative and neutral consequences, not just the wins.

## Implemented by

- ADRs: ADR-NNN, ...
- Requirements: REQ-NNN, ...
- PRs / code: paths and PR numbers that realize this decision
