# Epic 7. Build, move and switch over

Journey steps 5 to 7. Governing decisions: ADR-111, PDR-011. Source: epic #410 and its issues.

These requirements turn an approved plan into running features.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| M-1 | Generate the fleet from the agreed proposal: a feature and a gateway for each domain, connected to the inferred API descriptions. | The generated fleet passes the drift, consistency and composition checks of the repository. |
| M-2 | Wrap the monolith as one feature, so that it keeps running inside the new shell. | The shell that shows only the wrapper looks and behaves like the monolith alone. The parity gate measures this. |
| M-3 | Start with a composition that places the wrapper everywhere. | One generated composition document, which the existing build compiles. |
| M-4 | Make demo mode serve the real captured data. | The demo data of each gateway comes from the recorded responses. |
| M-5 | Ship a starter design library with each feature. | One component for each capability, with loading, ready and error variants. Each generated feature ships a design plugin. |
| M-6 | Build a regression suite that does not depend on the old tests. | Kept tests move with their component. Brittle tests are rewritten. Dead tests are dropped, with a reason. The tools generate characterization specs, visual baselines and contract tests. Coverage is above the coverage of the monolith. Each gap in the answer key is covered. |
| M-7 | Move components into the new features one placement at a time. | A model changes only developer-owned files and never generator-owned files. Each placement switch passes the parity gate. Each switch opens its own pull request, so that a person approves each step. |
| M-8 | Show leftover coupling and do not hide it. | Shared state, the shared API client or the shared design system is pushed into gateways and host-provided values, or the pull request flags it. |
| M-9 | Write the method as a playbook that an agent can follow. | An agent skill gives the stages, the human gates, the naming rules and the stop-and-ask conditions: low evidence agreement, a component that two domains claim, and a backend that every domain shares. Rules that a tool can check become automated checks. |
| M-10 | Prove the method end to end on the reference app. | From capture to the last switch-over: the same journeys pass on the composed shell, the fleet passes all repository gates, and the pull request records the proposal scores. This run is the demonstration. |
| M-11 | Support apps whose address bar and back button carry state. | The tools set entry state on connect and map URLs to state keys, so that deep links and back navigation work. |

## Order of work

M-7 and M-10 need M-1 and M-2. M-6 needs M-1.

## Where it lives

- Decisions: ADR-111, PDR-011
- Code: `packages/codegen/`, `packages/control-plane/`
- Guide: [decompose-runbook.md](../../decompose-runbook.md)
- Issues: #417 (generate and wrap), #418 (regression suite), #419 (port and switch over), #420 (playbook and end-to-end run), #421 (design library), #423 (URL state)
