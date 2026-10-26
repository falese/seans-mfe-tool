# Epic 4. Agreement: review, shape and approve the proposal

Journey step 4. Commands: `decompose:workspace`, `decompose:ask`, `decompose:edit`, `decompose:present`. Governing decisions: ADR-116, ADR-120, ADR-110.

Domain boundaries are organizational decisions as much as technical ones. So the business requires that people decide and that an agent only proposes. The workspace is where people review, discuss and approve. The review package shows the plan to people outside the workspace. The approval record names what a person approved.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| A-1 | Let a non-engineer see the proposal on the screens of the app. | Each captured screen shows the proposed domains outlined where they begin, with the evidence for each. |
| A-2 | Let a non-engineer shape the proposal without editing files. | The person can merge, split and rename domains, and move files or capabilities between domains. Each change derives and validates the whole fleet again. A change that breaks validation is refused. |
| A-3 | Let a non-engineer ask for changes in plain language. | The agent answers with proposed changes. They show as pending suggestions. The tools check each one by applying it alone. They drop invalid ones and give the reason. Nothing changes until a person accepts. |
| A-4 | Keep the conversation with the decision. | The proposal stores comments, questions and answers. After a reload, in a second tab and in the pull request, the same text shows. |
| A-5 | Make the approval name exactly what a person approved. | The approval records who, when, and a fingerprint of the decisions in the proposal. A later change to those decisions makes the approval out of date. Comments and suggestions do not. |
| A-6 | Put the approval where the team already works. | An approval commits the proposal directory to the repository, and only that directory. A person can switch this off. |
| A-7 | Give reviewers a package that they can read without the tool. | A written proposal (domains, evidence, risks, test plan, composition), a page with the outlined screens, and a design-tool plugin that imports the same boundaries as layers. |
| A-8 | Hold no hidden state. | The workspace keeps no data of its own. A reload, a second tab or a restart shows the same plan. |
| A-9 | Build nothing until the approval is current. | The flow lists the approval before the build. The build is the next step after it. |
| A-10 | Let a product owner with no developer setup take part. | The engineer publishes a snapshot. The owner edits it in a hosted copy of the same screen. The edits return to the repository. |

## Limits

A person must build the workspace once in the repository before first use. The agent needs a model key from the environment.

## Where it lives

- Decisions: ADR-116, ADR-120, ADR-110
- Code: `packages/workspace/`, `src/commands/decompose/workspace.ts`, `ask.ts`, `edit.ts`, `present.ts`, `packages/plugin-coder/`
- Explainer: [decompose-workspace.md](../../decompose-workspace.md)
- Tests: `packages/workspace/src/api/__tests__/`, `packages/decompose/src/__tests__/ask.test.ts`
