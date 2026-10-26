# Epic 5. Proof: show that the split app behaves like the original

Journey step 8. Command: `decompose:verify`, the parity gate. Governing decision: ADR-113.

The business cannot accept a migration step on trust. The existing tests are too weak to vouch for it. So the captured behavior of the original defines "the same".

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| V-1 | Test the candidate against the captured behavior of the original and not against its test suite. | The candidate runs the journeys of the baseline with the frozen clock of the baseline and the recorded responses. Its backends need not run. The data cannot differ. |
| V-2 | Detect missing or changed content. | A step fails when a region is missing, its text changed, it moved under a different parent, or a new region shows text. |
| V-3 | Detect changed backend traffic. | A step fails when a call that the baseline made is missing or an extra call appears. |
| V-4 | Detect new errors. | A step fails when a console error or page error appears that the baseline did not have. |
| V-5 | Detect visual change. | A step fails when the pixels of a region change by more than a set tolerance. The report names the region that drew the change, once. |
| V-6 | Ignore harmless restructuring. | The tools match regions by component and order. The same components that new files draw inside shell wrappers are not differences. |
| V-7 | Give a clear verdict and the detail behind it. | The tools always save a full machine report and a short written report. The command fails with a distinct code when parity is not met. |
| V-8 | Prove that the checker is trustworthy. | The unchanged original passes against itself: 11 of 11 steps, 250 of 250 regions, 0 pixels. A one-colour change on the reference app fails in each step. |
| V-9 | Say what parity does not cover. | The report lists the routes in the source that no journey visits. |
| V-10 | Check at the contract that faces the business when backends sit behind generated gateways. | The tools compare at the upstream calls of the gateway. They add contract tests from the inferred API descriptions, generated end-to-end specs for each new feature, and the migration of the tests that are marked keep. |

## Limits

Baselines depend on the machine, because fonts and rendering differ. Capture the baseline where the gate runs. Network parity is measured at the browser. It differs when screens call a gateway and not the old REST paths.

## Where it lives

- Decisions: ADR-113
- Code: `src/commands/decompose/verify.ts`, `src/decompose/verify/`
- Explainer: [decompose-verify.md](../../decompose-verify.md)
- Tests: `src/decompose/verify/__tests__/`
