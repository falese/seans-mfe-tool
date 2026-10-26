# Decompose: epics at a glance

Eight epics take a running app to independently deployable features. A person approves the plan in step 4 and signs off the result in step 8. The full requirements, 73 in all, are in the Business Requirements document.

| # | Epic | What the business gets | Step | Requirements | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | Evidence | A repeatable recording of what the running app does, tied to code and to backend calls | 1 | E-1 to E-9 | A capture of a development build completes with no app change, and a replay writes identical files |
| 2 | Source | A map of the code, joined to the recording, with hidden couplings and test quality | 2 | S-1 to S-6 | On the reference app, all 13 endpoints are found and explained |
| 3 | Proposal | The same draft of domains each time, with evidence, couplings and an API description for each backend | 3 | P-1 to P-10 | The draft puts 26 of 27 files in the correct domain (F1 0.963) |
| 4 | Agreement | One place where people review, discuss, shape and approve. The agent suggests and people decide | 4 | A-1 to A-10 | An approval names the exact version, and nothing is built before it |
| 5 | Proof | Proof that the split app behaves like the original | 8 | V-1 to V-10 | The unchanged original passes 11 of 11 steps, and a one-colour change fails every step |
| 6 | Guidance and design | The state of the migration and the next command, and editable designs of running screens | All | G-1 to G-6, D-1, D-2 | The state comes from the files, and people and agents get the same answer |
| 7 | Build and switch over | A fleet generated from the plan, the monolith kept running inside it, and one placement switched at a time | 5 to 7 | M-1 to M-11 | The same journeys pass on the composed shell after the last switch |
| 8 | Trust and safety | Agent output checked before use, a record of each decision, and reproducible results | All | X-1 to X-9 | Each agent edit is validated on a copy before anyone sees it |
