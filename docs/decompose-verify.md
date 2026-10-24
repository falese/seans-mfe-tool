# `decompose:verify` — the parity gate

A decomposition step is accepted only when the app behaves as the monolith did (ADR-113).
`decompose:verify` is how that is checked. It takes the monolith's evidence bundle, drives a
candidate app through the same journeys on the same recorded data, and compares the two runs
step by step.

```
seans-mfe-tool decompose:capture http://localhost:5090 --out ./evidence      # the baseline
seans-mfe-tool decompose:verify ./evidence                                    # the monolith against itself
seans-mfe-tool decompose:verify ./evidence --url http://localhost:4000 \
  --out ./verify/step-3                                                       # the composed app, after a strangler step
```

## What it compares

The candidate runs with the baseline's frozen clock, and every API call is answered from the
baseline's recorded responses (ADR-109 replay). Its backends need not be running, and nothing
in the data can differ. For each step it compares four things:

| | Fails when |
|---|---|
| **content** | a region is missing, its text changed, it sits under a different parent, or a new region shows text |
| **network** | a backend call the baseline made is missing, or an extra one is made |
| **console** | an error or page error appears that the baseline did not already have |
| **visual** | a region's own pixels changed (its nested regions excluded) |

Regions are matched by component and order of appearance (`BerthTile#2`), never by source file.
The composed app renders the same components from new files, inside wrappers the shell adds. A
wrapper that shows no text of its own is not a difference.

The visual check compares each region by its own content, so a region that moved on the page
still matches. A pixel counts as changed when a channel moves by more than `--pixel-tolerance`
(default 4 of 255). Like Playwright's `toHaveScreenshot`, no changed pixel is allowed by default;
`--max-diff-pixels` sets a budget. Because nested regions are excluded, a change is reported once,
in the region that drew it, not in every region around it.

## What it writes

```
<out>/candidate/        the candidate's evidence bundle
<out>/parity.json       the full report: per journey, per step, every difference
<out>/parity.md         the same for people: the verdict, then each failing step
```

The command exits non-zero (`PARITY_FAILED`) when the candidate is not at parity. The report is
on disk either way. `--candidate <bundle>` compares an existing bundle without starting a
browser.

The report also lists **coverage gaps**: routes in the source graph that no journey visits.
Parity says nothing about those (ADR-113, Boundaries).

## On meridian-monolith

| Candidate | Steps at parity | Regions at parity | Visual failures |
|---|---|---|---|
| the monolith, unchanged | 11 / 11 | 250 / 250 | 0 |
| heading renamed and recoloured | 0 / 11 | 239 / 250 | 11 (`BerthStrip#0`, every step) |
| heading recoloured only (`#5d6690` → `#6a6f9a`) | 0 / 11 | 239 / 250 | 11 (`BerthStrip#0`) |

The unchanged run is the proof ADR-113 §3 asks for: the journeys are deterministic, so a
difference later means the app changed. Same-machine renders of the same page are
pixel-identical: the clean run differs by 0 pixels.

## Limits

- **Baselines are machine-specific.** Fonts and rasterisation differ between machines, so
  capture the baseline where the gate runs, as with any screenshot test.
- **Network parity is at the browser.** Once a domain's BFF sits between the screen and its
  backends, its screens call `/graphql` rather than the REST paths the monolith called.
  Comparing at the BFF's upstream calls comes with the contract tests (#418).
- **The catch-all route counts as visited.** `*` matches any path, so it never shows up as a
  coverage gap.
- **Still to come under #418:**
  - generated Playwright characterization specs for each scaffolded MFE's own CI;
  - contract tests from the inferred specs (ADR-112);
  - migrating the tests triaged as keep.
