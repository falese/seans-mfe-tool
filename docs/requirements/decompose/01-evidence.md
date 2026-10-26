# Epic 1. Evidence: see what the running app does

Journey step 1. Command: `decompose:capture`. Governing decision: ADR-109.

The business needs facts about how the app behaves today. The tools collect the facts once and keep them on disk. The strongest signal for a domain boundary is the backend that a screen region calls. It exists only while the app runs.

## Requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| E-1 | Observe the real running app without a change to it. | A capture of a running development build completes. The app needs no code change. |
| E-2 | For each step, record what each part of the screen is, and which component and source file draw it. | Each region lists its component, file, landmark, position and own text. A library component is credited to the app component that used it. |
| E-3 | Link each backend call to the screen regions that it feeds. State how the link was made. | Each request lists the app files on its call stack and the regions that it feeds. A mark shows if the region asked for the data or shows it. A global store that fires every request does not hide who shows the data. |
| E-4 | Record the behavior that a later check compares. | Each step stores its route, navigations, console errors, page errors and a screenshot. |
| E-5 | Drive the app through journeys and do not change its data. | Written journeys run as given. Automatic exploration follows in-app links only. It never presses buttons and never sends forms. |
| E-6 | Make a capture repeatable. | A replay of the recorded responses with the recorded clock writes identical files. On the reference app, a replay matches the live capture. Screenshots are not part of this rule. |
| E-7 | Keep all that later steps need in one bundle on disk. | The proposal, the inference and the parity checks read the bundle. They never run the app again. |
| E-8 | Reuse the end-to-end tests of the team as journeys. | The existing specs of the monolith run with the capture instrumentation. |
| E-9 | Capture apps that need a login. Keep sensitive recorded data out of the bundle. | Journeys that need a login work. The tools redact recorded values before they reach disk. |

## Limits

A production build also captures, but the regions follow the page landmarks and have no source files. The command shows a warning. Behavior that no journey used is not in the recording. This means unknown, not unused.

## Where it lives

- Decisions: ADR-109
- Code: `src/commands/decompose/capture.ts`, `src/decompose/` (capture, attribution, bundle, journeys)
- Explainer: [decompose-capture.md](../../decompose-capture.md)
- Tests: `src/decompose/__tests__/`
