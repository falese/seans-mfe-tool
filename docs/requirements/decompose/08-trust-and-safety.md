# Epic 8. Trust, safety and operation

Journey: all steps. Governing decisions: PDR-010, ADR-084, ADR-087, ADR-120.

These requirements apply to every step. The business can let an AI agent work on a real codebase for two reasons. Deterministic code checks the output of the agent before anyone acts on it. Each decision leaves a record.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| X-1 | Never trust agent output because it exists. | The tools apply each edit that an agent proposes to a copy and validate the derived fleet before they show it. They drop failures and give the reason (PDR-010, ADR-120). |
| X-2 | Keep the agent out of generated code. | The output of the agent is edits to the proposal and to manifests. A model never writes generator-owned files (ADR-084, ADR-087). |
| X-3 | Keep the access of the agent under the control of the owner. | The model key comes from the environment only. It never comes from a flag, a file in the repository or the document. A person can switch the agent off. Each question is one request. The agent never asks on its own. |
| X-4 | Protect the data that the workspace serves. | A workspace on the machine of the engineer listens on the local address only and serves only the screenshots of the proposal. A hosted workspace accepts only a published snapshot that passes validation. |
| X-5 | Leave a complete record of decisions. | Each change is a named edit. Comments, questions, answers and approvals are in the proposal. They travel with the pull request. |
| X-6 | Be reproducible. | The draft is deterministic. Captured files use sorted keys and a frozen clock. Replays write identical files. |
| X-7 | Work for agents and scripts as well as for people. | Each command is also a typed tool for agents. Under the machine-readable option, each command returns exactly one result object. Failures use a fixed set of error kinds. |
| X-8 | Keep sensitive recorded data out of the bundle and out of model prompts. | The tools redact recorded values at capture. The model receives only the proposal and the evidence summaries, and not captured response bodies. |
| X-9 | Produce output that passes the gates of the platform. | Derived manifests and compositions pass the same validation as hand-written ones. The generated fleet passes the drift and consistency checks. |

## Where it lives

- Decisions: PDR-010, ADR-084, ADR-087, ADR-120
- Code: `packages/decompose/src/ask.ts`, `packages/plugin-coder/src/`, `packages/sentinel/src/`
- Tests: `src/__tests__/import-direction.test.ts`, `src/decompose/__tests__/agent.test.ts`
