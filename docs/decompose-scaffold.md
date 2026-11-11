# `decompose:scaffold` — from an approved proposal to a fleet

Once a person has approved `decomposition.yaml`, `decompose:scaffold` builds what it describes
(#417, ADR-111). It generates every MFE with the same generator `remote:generate` uses, so the
fleet answers to every gate a hand-made one does.

```bash
seans-mfe-tool decompose:scaffold ./evidence/proposal --app-dir /abs/path/to/the/monolith
```

## What it refuses

- **A proposal nobody approved, or one changed since** (`PROPOSAL_NOT_APPROVED`). The approval
  records a hash of what was approved (ADR-116 §5); scaffold builds only that.
- **A proposal that breaks the playbook's structural rules**: a file or capability claimed by two
  domains, a placement naming a capability or slot that does not exist, two shells. These are a
  Sentinel `ValidatePort` (`src/sentinel/decomposition.ts`, ADR-089).
- **A non-empty output directory** without `--force`. With `--force`, developer-owned files are
  kept, as with `remote:generate`.

It also prints the playbook's stop-and-ask conditions (weak evidence for a boundary, a backend
every domain calls, a domain that owns no data) as warnings. See the
[playbook skill](../.agents/skills/decompose-monolith/SKILL.md).

## What it writes

```
fleet/
  <namespace>-<domain>/           one generated MFE per domain
    mfe-manifest.yaml             now the MFE's own source
    specs/<backend>.yaml          the operations it calls, from the proposal (ADR-112)
    src/platform/bff/mocks.json   the responses capture recorded, as demo fixtures (ADR-052)
  legacy-<app>/                   the monolith, whole, as one generated MFE (ADR-111 §1)
    src/features/Legacy<App>/     loads the monolith's remote entry and calls mount(element)
    MONOLITH-FEDERATION.md        the two changes the monolith's own build needs
  shell/                          a generic LayoutManager host with nothing of its own on screen
  control-plane/
    control-plane.yaml            the monolith in the root, for every state key (ADR-111 §3)
    rules.json                    compiled from it (ADR-083)
    target.yaml                   the approved proposal's own composition, which decompose:port composes
  README.md                       how to run it
```

and `proposal/scaffold.json`, which tells `flow:status` the step is done and which approved
version it was built from.

The **shell** shows no text of its own, so the parity gate sees only what the MFEs draw. It copies
the monolith's page styles from `public/index.html` (`--app-dir`), starts in `<namespace>.root`
once the control plane connects, and forwards the monolith's API paths to it.

The **legacy wrapper** draws nothing either. It marks itself `data-composition="pending"` until
the monolith has mounted, which is what `decompose:capture` waits on.

## Running it

The fleet's `README.md` has the commands. In order: give the monolith its remote entry, start
the control plane and register `rules.json`, build and serve the legacy wrapper (a production
build — rspack's dev server compiles dynamic imports lazily, and a cross-origin shell waits on
that forever), start the shell, then:

```bash
seans-mfe-tool decompose:verify ./evidence --url http://localhost:5199
```

## On meridian-monolith

| Candidate | Steps at parity | Regions at parity | New console errors | Visual failures |
|---|---|---|---|---|
| the monolith with its remote entry added, alone | 7 / 7 | 153 / 153 | 0 | 0 |
| the composed shell, legacy wrapper only | 7 / 7 | 153 / 153 | 0 | 0 |

Getting the second row took three fixes outside scaffold, each now in the code:

- The shell's one control-plane call goes through its own origin, and capture neither records
  nor replays it: it is the composition's plumbing, not the app's data.
- Capture waits while a composition is assembling, while scripts are loading, and while the
  page's main thread is too busy to answer. The monolith's first render inside the shell blocked
  for ~800 ms before its first request, which looked like quiet.
- The shell uses React's production build. A development react-dom shared with production
  remotes logs an error on every mount.

## Limits

- **There is no strangling.** The next step ports every domain and composes the proposal
  directly ([decompose-port](./decompose-port.md), PDR-013). Strangling a monolith that must keep
  serving production is deferred (ADR-125).
- **The monolith's build change is the agent's.** Scaffold writes what to change, not the change:
  a monolith's bundler config is its own code.
- **The Figma component library per MFE** waits on the `design:export` rework (#421).
