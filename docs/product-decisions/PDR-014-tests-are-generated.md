---
id: 0014
title: Tests are a generated platform artifact — SMT writes an MFE's functional, visual-regression and contract tests from what the running app was observed to do
status: Accepted
date: 2026-11-11
deciders: [sean]
supersedes: []
superseded-by: []
tags: [testing, regression, visual, contract, generation, decomposition, quality]
summary: SMT generates an MFE's tests the way it generates its code. From a capture of the app running — which states it reached, what each component showed there, which backend calls it made, what it looked like — it writes characterization tests that render each capability alone, a browser spec that replays every journey with per-capability visual baselines, and contract tests that hold each BFF to its specs and recorded traffic. Decomposition is the first caller; any MFE with a capture can use it.
---

# PDR-014: Tests are a generated platform artifact

## Problem space

SMT generates an MFE's code, build, BFF and composition from a manifest (PDR-001). It does not
generate the tests that say the MFE works, so every MFE starts with one placeholder per capability
and a developer writing the rest by hand, or not at all. That is the part teams skip under
deadline. It is also where they fall behind most visibly: a feature team can write unit tests, but
few keep visual-regression baselines, and almost nobody holds a BFF to the contract of the
backends it fronts.

Decomposition makes the gap concrete. meridian-monolith's own suite covers 29% of its lines, and
its answer key lists fourteen behaviours no test asserts (#412). PDR-013 then made each MFE's own
tests the only proof that a capability works in a shell that is not the monolith's. `decompose:verify`
already proves the composed app matches the monolith in a browser (ADR-113). Nothing proved that
each MFE, built and tested in its own CI, still does what it did.

The evidence to write those tests already exists. A capture (ADR-109) records, at every step,
what each component drew, the calls behind it, the console, and a screenshot. That is a
specification of the app's behaviour observed from outside, which is the only specification a
legacy app reliably has.

## Decision

SMT owns test generation as a core function, beside code generation. `test:generate` takes a
capture of a running app and an MFE, and writes the MFE's tests in four kinds:

- **alone:** each capability rendered by itself, with no host and no backend, at every state it
  was captured in. It must show what it showed, make the calls behind it, and log no new error.
- **journeys:** every captured journey replayed in a browser, step by step, with the same checks
  plus a visual baseline per capability per step.
- **contract:** each BFF operation held to its OpenAPI spec and the traffic recorded for it, at
  the demo fixtures and through the connector itself.
- **migrated:** for a decomposition, the monolith's tests triaged keep, moved with their code.

The tests are the MFE's own files, and a re-run never replaces one a developer has changed.
Decomposition is the first caller (#418): one command generates them for every MFE of a ported
fleet. Any MFE with a capture can use it.

## Why this over alternatives

- **Migrate the monolith's tests and fill gaps by hand.** Real suites are thin, coupled and partly
  skipped. Migrating them carries their gaps over, and filling gaps by hand does not scale past a
  reference app.
- **Only gate the composed app (`decompose:verify`).** It proves the composition once, in one
  shell. An MFE that is meant to compose anywhere (PDR-013) needs its behaviour proved in its own
  CI, without that shell.
- **Generate tests from the source (unit-test synthesis).** That asserts what the code does, which
  is circular. Observed behaviour asserts what users saw, and that is what parity means.

## Success signals

- Every MFE of meridian-monolith's fleet passes its generated tests with no hand edit, and the
  generated suite asserts behaviours the monolith's suite never did.
- The same journey spec passes against the monolith and the composed shell.
- A changed label, colour or dropped backend field fails a generated test in the owning MFE's CI,
  and names the capability.

## Consequences / trade-offs

- The tests specify what was captured, nothing more. Behaviour no journey reached is untested,
  and the report says so. Coverage depends on the journeys.
- Baselines encode one machine's rendering. Like any screenshot test, capture where the gate runs.
- A characterization test pins current behaviour, including bugs (the concourse's three-row cap).
  Changing behaviour on purpose means re-capturing or editing the test, visibly in the PR.
- Composes PDR-001 (generate, don't hand-write), PDR-011/013 (decomposition proves parity),
  PDR-003 (agent-operable: it is an MCP tool like every command).
