# Reverse-engineering apps nobody here wrote — the RealWorld corpus

meridian-monolith was written for the toolchain, and its answer key was in view while the rules
were tuned. So its scores show agreement with us. The RealWorld corpus (#442) asks a different
question: from a running app and its source alone, does the toolchain rebuild a model of the app
that holds up?

RealWorld ("Conduit") is one product built in dozens of frontends against one published API
spec. That gives two checks no hand-written answer key is needed for:

- **Convergence:** the same product should decompose into roughly the same domains, whatever
  codebase it is built in.
- **Contract truth:** every inferred OpenAPI document is scored against the published spec.

## Running it

```
npm run build
node scripts/corpus/realworld/run.mjs [--work <dir>] [--only <app>]
```

[`scripts/corpus/realworld/corpus.yaml`](../scripts/corpus/realworld/corpus.yaml) pins each app,
the spec and the reference backend to a commit; all are MIT. The script then:

1. clones each repo and builds the Go backend;
2. seeds the backend with a small, fixed dataset
   ([`seed.mjs`](../scripts/corpus/realworld/seed.mjs));
3. starts each app;
4. runs capture → analyze → propose → propose `--spec` → verify, using the journeys in
   [`journeys.yaml`](../scripts/corpus/realworld/journeys.yaml), which are written once for every
   implementation;
5. writes `summary.md`.

It needs git, Go, Node and a Chromium. The public demo API is gone, so the reference backend
runs locally. Each app gets one change, recorded in the manifest: its API root points at `/api`
through the dev server's proxy, because the backend sends no CORS headers.

## Result

| | react-redux | ts-redux-react |
|---|---|---|
| Stack | React 16, React Router 4 (browser history), Redux, superagent, JavaScript | React 17, React Router 5 (hash history), Redux Toolkit, axios, TypeScript |
| Steps captured (2 journeys + exploration) | 27 | 27 |
| Visible elements mapped to source | 97% | 98% |
| Observed calls explained by source | 19 / 19 | 19 / 19 |
| **Domains** | **shell, article, editor, home, login, profile, register, settings** | **shell, article, editor, home, login, profile, register, settings** |
| Inferred operations, all valid OpenAPI 3 | 19 | 17 |
| Matching the published spec | 19 / 19 | 17 / 17 |
| Inferred, not in the published spec | 0 | 0 |
| Parity with its own capture (`decompose:verify`) | 27 / 27 | 27 / 27 |

**The two codebases converge.** They differ in language, router, state library, HTTP client and
routing style, yet produce the same eight domains, named as the product names them. No agent
judgment pass was applied.

**The inferred specs are a correct lower bound.** Every inferred operation exists in the published
spec. The difference report shows two kinds of gap:

- **Write operations have no response shape.** The journeys are read-mostly, so operations seen
  only in source carry no recorded response.
- **The spec has drifted from the backend.** The backend returns `body` in article lists, which
  the published spec no longer declares.

## What the corpus found in the toolchain

The first run found almost nothing in app 1's source, and in app 2 it found routes and endpoints
but neither assigned screens nor joined to traffic. Each line below is a gap found on code nobody
here wrote, fixed test-first. meridian-monolith is unchanged throughout: clustering F1 0.963,
backends, slots and tests 1.000, and still at parity with its original baseline.

| Stage | Gap | Fix |
|---|---|---|
| capture | React 16 keeps fibers under `__reactInternalInstance$`: 0% of elements mapped | read both keys |
| capture | under a hash router every step's path was `/` | the hash route is the path |
| capture | one explored link that was gone aborted the whole capture | an explored link is best-effort, reached by its `href` |
| capture | the dev server's socket (`/sockjs-node`) counted as app traffic, then failed on replay | left out of bundles, passed through on replay |
| analyze | JSX in `.js` files did not parse | `.js` parses as JSX |
| analyze | `component={X}`, `<Route><X/></Route>` and `<GuestOnlyRoute path>` were not routes | all three read |
| analyze | `superagent` and object-literal API methods (`agent.Articles.all()`) were invisible | clients made from HTTP libraries; dotted calls resolved across modules |
| analyze | relative URLs under `axios.defaults.baseURL` never joined to traffic | resolved against the base the traffic shows |
| analyze | `export default connect(...)(Article)` resolved to `<expression>` | higher-order wrappers unwrapped |
| analyze | `<Route path="/" component={App}/>` around the app made every file part of `/` | a route to the route table is the frame |
| analyze | a store registering every slice made every slice shared | screens reach a registry, not through it |
| analyze | a query in a template (`/articles?${q}`) never matched | templates compared without their query |
| propose | every top-level resource became its own backend (`tags`, `user`, …) | one API vs gateway judged per app (`app.gateway`) |
| propose | `/editor` and `/editor/:slug` split a component in two; `/@:username` slugged to `--username` | route families; ids from the page name; parameter-named state keys |
| propose | a `<Switch>` inside a plain `<div>` had no primary area | only side landmarks disqualify |
| specs | response `$ref`s and OpenAPI 3.1 `type: [string, 'null']` were not compared | both read |

## Still open

- **Tests in Create React App projects are not run.** `react-scripts test` is not driven, so
  app 2's 18 test files are triaged statically (7 keep, 10 rewrite). App 1 has no unit tests.
- **Exploration is anonymous.** Signed-in screens are reached only by the written journey.
  Writes (publish, comment, follow) are exercised by no journey, so their response shapes are
  unknown.
- **Shared presentation is large in app 2** (19 files). The article list, the preview and the
  page container really are used by several screens; whether to duplicate them or extract a
  library is the judgment ADR-110 leaves to the agent and the reviewer.
- **External CSS fails to load** in sandboxes whose proxy certificate the browser rejects. It
  fails the same way on every run, so it is part of the baseline, not a difference.
- **Two apps.** Next: more React implementations, then other open-source SPAs.
