# Epic 3. Proposal: suggest how to split the app, with the evidence

Journey step 3. Commands: `decompose:propose`, and `decompose:score` to measure quality. Governing decisions: ADR-110, ADR-112.

The business needs a first answer to the question "where do the domain boundaries go?" The answer must be the same each time. It must show its reasons. It must say what it could not place.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| P-1 | Draft a split from the evidence alone. Give the same draft each time. | The same analysis always gives the same draft. On the reference app the draft puts 26 of 27 files in the correct domain (F1 0.963). |
| P-2 | Show the evidence for each boundary. | Each domain has a score from 0 to 1 for route, data, imports, runtime, change history and ownership. It also has written reasons. |
| P-3 | Flag what no domain can own cleanly. Do not guess. | Shared files get a suggestion: replace with a backend per domain, dissolve, duplicate or split. Reads of the data of another domain are listed as couplings. On the reference app the tools flag all three couplings of the answer key. |
| P-4 | Say where each capability shows on screen. | Each capability has a slot and a route. The tools find one-per-item placements, for example a tile for each berth. |
| P-5 | Decide what to do with the existing tests. | Each test is marked keep, rewrite or discard, with reasons. Capabilities that no kept test uses are listed as uncovered. |
| P-6 | Describe the API of each backend when the team has no published description. | The tools infer an API description for each backend from recorded traffic and code, and mark it as inferred. A published description wins, and the tools compare the two. On the reference app all 13 operations match the hand-written ones. |
| P-7 | Turn the agreed proposal into the inputs that the build needs. | The tools derive a manifest for each domain and a composition. They pass the same validation as hand-written ones. |
| P-8 | Apply judgment as named changes that people can review. | Naming, merging, splitting and moving are edits on top of the untouched draft. Then the tools can list what a person or an agent changed. |
| P-9 | Measure the quality of a proposal against a known answer. | The score reports file assignment, backends, slot structure, test verdicts and gap detection. It ignores names. On the reference app the draft scores 0.963 and the draft with the nine edits of the agent scores 1.000. |
| P-10 | Give each capability a typed contract for the data that it receives. | A capability declares the inputs that it accepts. The tools check each placement against it. |

## Limits

An inferred API description covers only what the app was seen or written to call. It has no request bodies. The clustering thresholds were tuned on the reference app. The real-world corpus ran two React implementations of one product. They give the same eight domains. This is two apps of one product and not a broad sample.

## Where it lives

- Decisions: ADR-110, ADR-112, ADR-118
- Code: `src/commands/decompose/propose.ts`, `score.ts`, `src/decompose/propose/`, `packages/decompose/src/`
- Explainer: [decompose-propose.md](../../decompose-propose.md)
- Tests: `packages/decompose/src/__tests__/`, `src/decompose/propose/__tests__/`
