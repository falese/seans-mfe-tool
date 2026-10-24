# `decompose:analyze` — what a monolith's source says, joined to what it did

The second stage of an agent-driven decomposition (PDR-011). `decompose:capture` records what
the running app does ([`decompose-capture.md`](./decompose-capture.md)). `decompose:analyze`
reads the app's source into a **source graph** and joins the two, so runtime and source
evidence vote on the same files (ADR-109 §3).

```bash
seans-mfe-tool decompose:analyze examples/meridian-monolith --evidence ./evidence
seans-mfe-tool decompose:analyze ./app --no-run-tests --out ./analysis
```

v1 reads React apps written in TypeScript or JavaScript. It writes `graph.json`, `tests.json`,
`history.json` and, with `--evidence`, `join.json`. The output goes into `<evidence>/source/`
by default.

## What it finds

| Signal | How |
|---|---|
| **Routes** | React Router `<Route path element>`, `component={X}` (v4/v5), a child component (`<Route path><X /></Route>`), route wrappers (`<PrivateRoute path>`), and object configs, with the landmark (`main`, `aside`) each `<Routes>` renders into, resolved through barrels, re-exports and higher-order wrappers (`connect(...)(X)`, `withRouter(X)`) to the component's file. A route to the component that declares the routes is the router's frame, not a screen. JSX in `.js` files is read |
| **Import graph** | every local import resolved to a file; packages listed separately |
| **Endpoints** | `fetch`, `axios`, `superagent`, and clients made from them (`axios.create()`, `wrap(superagent)`), with URLs folded from constants and followed through wrapper functions — object-literal methods and default-exported objects included, so `agent.Articles.all()` reaches `requests.get` and `superagent.get`: `getBerths = () => hm('/berths')`, with `hm(path)` calling `` http.get(`${BASE.harbormaster}${path}`) ``, is `GET /api/harbormaster/berths`. A URL relative to a client's `baseURL` (`axios.get('tags')`) is resolved against the base the traffic shows |
| **Store reads** | a store that loads fields (`const [a, b] = await Promise.all([fa(), fb()])`) and consumers that read them (`const { a } = useStore()`) give consumer → field → endpoint |
| **Assignment** | each file's owners are the route roots that reach it: **screen** (one), **shared** (several), **shell** (only the entry), **unreached** (none). Routes under one first segment (`/editor`, `/editor/:slug`) are one screen family. A screen reaches a store that registers every page's slice, but not every slice through it |
| **Tests** | per test file: imports, mocks, snapshots, skips, structural selectors, fixed waits; the Jest suite is run for per-test results, and tests the project's config excludes are marked |
| **History** | co-change pairs from `git log` (sweeping commits ignored) and CODEOWNERS owners |
| **Join** | each observed endpoint matched to the client that defines it, the files that call it, and the files that read it from a store; endpoints in source that no journey hit; what the capture saw of each file |

## On meridian-monolith

- **Assignment:** 27 source files, none unreached. They split into 16 screen files, 6 shared
  and 5 shell, and agree with the answer key wherever imports can tell.
- **Two files are left for the proposal stage,** which weighs signals together:
  - `BerthTile` is shell, because only the always-on berth strip imports it. Its store reads
    point to docking.
  - `ModuleStatus` is the `/` screen's status rail. Its reads point to life-support.
- **Endpoints:** 13 endpoints, all in the one API client, and all 13 observed endpoints are
  explained by source.
- **Store reads find a coupling the capture cannot see.** `HazardSummary` reads `dockings`
  only to filter, so nothing about it shows on screen. `ConcoursePage` (inbound supplies) and
  `Sidebar` (the life-support badge, from `telemetry`) are found the same way.
- **Tests:** 18 passed and 1 skipped. `ConcoursePage.test.tsx` is marked excluded, because
  the project's Jest config ignores it. The answer key discards it for that reason.

## Limits

- **Endpoint resolution is static.** A URL built at runtime from data, or a client method
  called on an instance (`api.getX()`), stays a `{?}` template or is missed. The join reports
  observed endpoints that nothing in source explains.
- **Store reads follow one pattern:** destructured hook reads, and `Promise.all` or single
  `await` loads. Redux selectors and other stores are not read yet.
- **Routes:** React Router only. File-based routing (Next.js, Remix) is not read.
- **History is only as good as the repository's.** A monolith imported in one commit has no
  co-change signal.
