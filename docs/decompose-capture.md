# `decompose:capture` — what a running monolith does, on disk

The first stage of an agent-driven decomposition (PDR-011). `decompose:capture` drives a
running web app through journeys in headless Chromium and writes an **evidence bundle**: a
directory every later stage reads instead of the live app (ADR-109).

```bash
seans-mfe-tool decompose:capture http://localhost:5090                          # explore links
seans-mfe-tool decompose:capture http://localhost:5090 --journeys journeys.yaml # your journeys
seans-mfe-tool decompose:capture http://localhost:5090 --replay ./evidence --out ./evidence-2
```

Run it against a **React development build**: that is what lets the capture name the
component and source file behind each part of the screen. A production build still captures,
with regions per page landmark and no source files, and the command warns.

## What it records

For every journey step:

- **Regions:** each rendered instance of an app component, with its source file, the landmark
  it sits in (`main`, `nav`, `aside`, or a `data-layout-slot`), its rectangle, and the text it
  draws itself. Library components are attributed to the app component that used them, so a
  router `<Link>` belongs to the `Sidebar` that rendered it.
- **Requests:** every XHR and fetch, with the app source files on its call stack and the
  regions it feeds.
- **Navigations, console errors and warnings, page errors:** the baseline the parity gate
  compares against (ADR-113).
- **A screenshot.**

## How a request is tied to a region

Two signals, kept apart in `requests.json` (`via`):

| Signal | Means | Sees |
|---|---|---|
| `initiator` | an app file on the request's call stack (async parents included) is the file of a region on screen | the component that asked for the data |
| `data` | an identifying value from the response appears in the region's own text | the component that shows it, even when a global store fetched it |

On meridian-monolith the two disagree exactly where the answer key says the app is coupled:

- Every request on first load is initiated by `examples/meridian-monolith/src/store/AppContext.tsx`, the global store.
- The `data` signal then places those requests on the panels that render them:
  - dockings on `DockingBoard`, `TrafficLog`, `BerthTile`, `CargoManifest`, and on
    `ConcoursePage`'s inbound list;
  - modules on `ModuleStatus` and `LifeSupportPage`.

A value counts as identifying only when its field has mostly distinct values across rows. A
registry number does; a status or berth class does not, and would otherwise tie every status
chip to every request.

## The bundle

| File | Holds |
|---|---|
| `bundle.json` | app, viewport, frozen clock, journeys, stats (including source coverage) |
| `journeys.yaml` | the journeys that ran, explored steps included |
| `journeys/<name>.json` | per step: action, path, navigations, regions, request ids, console, screenshot |
| `requests.json` | every request and its attribution |
| `responses.json` | the first response per `METHOD url` |
| `screens/<step>.png` | screenshots |

## Journeys

```yaml
journeys:
  - name: home-to-docking
    steps:
      - goto: /
      - click: "nav >> text=Docking"     # any Playwright selector
      - fill: { selector: "#q", value: "VR" }
      - press: { selector: "#q", key: Enter }
      - wait: 250
```

Each journey runs in a fresh browser context. `--explore N` adds an `explore` journey that
follows in-app links breadth-first for up to `N` steps. It never presses buttons or submits
forms, so it cannot change the app's data.

## Replay and determinism

`--replay <bundle>` answers the app's API calls from that bundle's `responses.json`. It also
reuses the bundle's clock and `journeys.yaml`. Only XHR and fetch are intercepted; everything
else (scripts, the favicon) loads as it does live. The page clock is frozen, and JSON is
written with sorted keys and no wall-clock data. So two replays write identical files, and on
meridian-monolith a replay matches the live capture it came from. Screenshots are stored
beside the JSON but are not part of that guarantee.

## Limits

- Data a component uses without showing it — to filter or count — leaves no trace on screen,
  and a store-initiated request has no component on its stack. Those couplings
  (meridian-monolith's `HazardSummary` reading dockings) are found by `decompose:analyze` from
  the source's store reads ([`decompose-analyze.md`](./decompose-analyze.md)).
- Behavior no journey exercised is absent from the bundle, which means unknown, not unused.
- Re-running the app's own e2e specs as journeys is #437.
- Recorded responses become BFF `mocks.json` fixtures at scaffold time (#417), once field
  names exist.
- Recorded data is whatever the app returned; redaction is #424.
