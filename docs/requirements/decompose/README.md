# Decompose: business requirements

These requirements state what the decompose feature set must do, in business terms. The reasons come from the product decisions (PDR-011, PDR-012), the architecture decisions (ADR-109 to ADR-120), the command behavior and its tests, and epic #410.

Each epic has its own file. Each requirement has an ID, a statement of what the business needs, and an acceptance test that a stakeholder can see.

## The business problem

The decompose feature set helps a team break a monolith into independently deployable domain features. The work is short, it uses evidence, and a team can reverse it. The platform could already generate a feature from a manifest. It assumed that someone knew where the domain boundaries are. In a real migration, that knowledge is the expensive part. It is usually missing.

Problems it removes:

- The boundaries are not written down. They are in which screen calls which backend, which parts change together, and which team owns which folder. A workshop to find them takes weeks.
- The existing tests cannot define correct behavior. A real suite is thin and uneven, and it depends on implementation details. "Keep the tests green" is not a safety net.
- Migrations stop halfway. Big-bang rewrites fail. Step-by-step work slows down, because each step is manual work with no proof that it changed nothing.
- Teams build the supporting parts by hand for each feature, if at all. These parts are the backends-for-frontends, the composition, the design assets and the regression tests.

## Outcomes

| Outcome | How a stakeholder checks it |
| --- | --- |
| Proposed boundaries that a product owner can trust | Each boundary shows its evidence. On the reference app, the proposal scores at least 0.8 F1 against a known answer |
| Human agreement before anything is built | A named person approved the exact proposal that the tools generate from |
| Proof that the split app behaves like the original | A parity report compares regions, backend calls, errors and pixels with a captured baseline |
| Steady progress that a team can reverse | The platform shows where a migration stands and what to run next, from the files on disk |
| Use on code that the team did not write | The same tools run on external real-world apps with no change to the tools |

## Who uses it

The product owner is the primary user. The product owner gives agreement on the domain boundaries. A pull request full of YAML is an engineer's tool, not a tool for the product owner. Engineers use the command line. An AI agent uses the same tools over MCP.

| Role | What they do with it | What they need from it |
| --- | --- | --- |
| Product owner | Reviews the proposed domains on the screens of the app. Merges, splits and renames domains. Asks the agent. Approves. | To decide without reading YAML, to see the evidence for each boundary, and to know exactly what they approved |
| Migration engineer | Runs capture, analysis and proposal. Edits from the command line. Builds and switches over. | Repeatable commands, a clear next step, and failures that say what to fix |
| Domain or team lead | Receives one of the resulting domains. | Boundaries that follow data ownership and code ownership, with the reasons in writing |
| Engineering leadership | Funds and follows the migration. | To know where it stands, and to see proof that nothing broke |
| Designer | Uses the exported screens and the boundary overlay. | Editable design pages that match what renders |
| AI agent | Operates the tools and suggests edits. | Typed tools, one sequence to follow, and a check that rejects invalid suggestions |
| Platform owner | Runs this as part of the wider platform. | Output that works with the generator, the control plane and the governance checks |

## The journey

Eight steps take a running app to independently deployable features. A person approves the plan in step 4. A person signs off the result in step 8.

1. Capture: record the live app.
2. Analyze: read the source.
3. Propose: draft the domains.
4. People approve: review on real screens, then approve the plan.
5. Build the pieces: an empty piece per area, plus the monolith.
6. Move the code: screens and good tests move into the new pieces.
7. Switch over: one area at a time, from the monolith to the new piece.
8. Prove parity: replay the journeys. A person signs off.

## Epics

| Epic | Requirement IDs | Journey step | File |
| --- | --- | --- | --- |
| 1. Evidence: see what the running app does | E-1 to E-9 | 1 | [01-evidence.md](./01-evidence.md) |
| 2. Source: understand how the app is built | S-1 to S-6 | 2 | [02-source.md](./02-source.md) |
| 3. Proposal: suggest how to split the app | P-1 to P-10 | 3 | [03-proposal.md](./03-proposal.md) |
| 4. Agreement: review, shape and approve | A-1 to A-10 | 4 | [04-agreement.md](./04-agreement.md) |
| 5. Proof: show that the split app behaves like the original | V-1 to V-10 | 8 | [05-proof.md](./05-proof.md) |
| 6. Guidance and design handoff | G-1 to G-6, D-1, D-2 | All steps | [06-guidance-and-design.md](./06-guidance-and-design.md) |
| 7. Build, move and switch over | M-1 to M-11 | 5 to 7 | [07-build-and-switch-over.md](./07-build-and-switch-over.md) |
| 8. Trust, safety and operation | X-1 to X-9 | All steps | [08-trust-and-safety.md](./08-trust-and-safety.md) |

## Limits and assumptions

| Limit | What it means |
| --- | --- |
| Source analysis reads React single-page apps | Other stacks need their own source analysis. Runtime capture works for any web app. |
| Evidence of generality is two apps of one product | Two React implementations of one product (RealWorld) give the same eight domains. They match their published API 19 of 19 and 17 of 17. This needed 16 fixes to the tools. A new app can need more. |
| Test quality is judged by reading for some projects | The tools read the test suites of Create React App projects. They do not run them. |
| Write behavior is not seen | Exploration is anonymous and mostly reads. Write operations have no response shapes. |
| A baseline belongs to one machine | Fonts and rendering differ between machines. Capture the baseline where the gate runs. |
| An inferred API description is a lower bound | It covers only what the app was seen or written to call. It has no request bodies. |
| Without a development build, evidence is weaker | A production build gives regions by page landmark and no source files. |

Assumptions:

- The monolith runs locally with a development build and seeded data, so that journeys are repeatable.
- The journeys use the behavior that matters. Behavior that no journey reaches is invisible to each later step.
- A product owner is available to review and approve. A pull request is an acceptable place to record the approval.
- The baseline is captured on the machine that runs the gate.

## Related documents

- Step-by-step guide: [decompose-runbook.md](../../decompose-runbook.md)
- Product decisions: [docs/product-decisions](../../product-decisions/)
- Architecture decisions: [docs/architecture-decisions](../../architecture-decisions/)
