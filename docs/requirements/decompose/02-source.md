# Epic 2. Source: understand how the app is built

Journey step 2. Command: `decompose:analyze`. Governing decision: ADR-109 section 3.

Behavior alone cannot show couplings that leave no trace on screen. So the business needs the code read and linked to the capture. Then runtime evidence and source evidence vote on the same files. The command reads React apps written in TypeScript or JavaScript.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| S-1 | Say which screen each file belongs to, which files are shared, and which belong to the shell. | Each source file is labelled screen, shared, shell or unreached, from the routes that reach it. On the reference app: 27 files, none unreached. |
| S-2 | Find each backend that the code calls, also through wrapper functions. | The tools follow calls through common clients to concrete paths. On the reference app they find all 13 endpoints and explain all 13 observed calls. |
| S-3 | Find data that a component depends on, also when nothing shows it. | A component that reads a store field only to filter is linked to the endpoint that loads it. On the reference app this shows that the hazard summary depends on dockings. |
| S-4 | Join what the app did to the code that did it. | Each observed endpoint is matched to its client and callers. Endpoints that no journey used are listed. |
| S-5 | Assess the existing tests honestly. | For each test file: what it imports, mocks, snapshots, skips and waits on, with real pass and fail results. Tests that the own config of the project excludes are marked as excluded. |
| S-6 | Use history and ownership as evidence. | Files that change together and their code owners are recorded. A monolith that was imported in one commit has no change signal. |

## Limits

The tools can miss URLs that the app builds from runtime data, and calls on client instances. The join reports observed calls that the source cannot explain. The tools read only the destructured-hook store pattern, so they do not read Redux selectors. They read only React Router, so they do not read file-based routing in Next.js or Remix. Apps that are not React are out of scope for source analysis. Runtime capture still works for them.

## Where it lives

- Decisions: ADR-109 section 3
- Code: `src/commands/decompose/analyze.ts`, `src/decompose/source/`
- Explainer: [decompose-analyze.md](../../decompose-analyze.md)
- Tests: `src/decompose/source/__tests__/`
