# Epic 6. Guidance and design handoff

Journey: all steps. Commands: `flow:status` and `design:export`. Governing decisions: PDR-012, ADR-119, ADR-115.

A migration is many commands in an order. On the first real run, a user made five wrong turns, because no command knew the order. So the business requires that the platform knows where a migration stands and what to do next. It also requires that designers can work from what really renders.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-1 | Tell a person or an agent where a migration stands. | For a given folder, the tools report each step as done, out of date, waiting for a person, ready, blocked or unavailable. |
| G-2 | Name the exact next command with its arguments filled in. | The next command uses the app address and directory that earlier steps recorded. It shows a placeholder when a value is not known. |
| G-3 | Never disagree with the files. | The tools derive the state from the files on each call. Nothing records progress. A command that a person runs by hand, or a deleted report, shows at once. |
| G-4 | Know when earlier work is out of date, by content and not by clock. | A step is out of date when what it was built from changed. A checkout that changes all timestamps does not change the answer. Older outputs use timestamps and show a warning. |
| G-5 | Serve people and agents from one source. | The same report is available as one machine-readable result. An agent that follows it does not call steps out of order. |
| G-6 | Show the state of the proposal on request. | An option adds the full proposal view (validation, approval, pending suggestions). The default report stays fast. |
| D-1 | Give designers an editable picture of any running screen. | The tools export a page as a design file, a reference screenshot and a plugin that rebuilds the layers. They keep only what the screenshot shows. They use auto-layout only where it is exact. |
| D-2 | Give each feature its own design library of capabilities and states. | The tools give capture modes and a component library for each feature. |

## Limits

"Done" means that the correct files exist and are current. A step with a wrong output still reads as done. The validation of each command stays the authority on correctness.

## Where it lives

- Decisions: PDR-012, ADR-119 (guidance); ADR-115 (design)
- Code: `packages/flow/`, `flows/decompose.yaml`, `src/flow/`, `src/commands/flow/status.ts`; `src/design/`, `src/commands/design/export.ts`
- Explainers: [flows.md](../../flows.md), [decomposition-architecture.html](../../decomposition-architecture.html)
- Tests: `src/flow/__tests__/decompose-flow.test.ts`
