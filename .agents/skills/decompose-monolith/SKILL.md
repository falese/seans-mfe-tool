---
name: decompose-monolith
description: Decompose a running React monolith into SMT MFEs and BFFs with the decompose:* commands — capture, analyze, propose, shape, approve, scaffold, port, verify — with the human gates, naming rules, stop-and-ask conditions, and the recipes for the composed parity runs.
---

# Decompose a monolith (PDR-011, epic #410)

You are the operating agent. The CLI does everything deterministic; you make the
judgment calls (naming, merging, splitting) and you stop at every human gate. A
model never writes generator-owned files (ADR-084) — your hands are on
`decomposition.yaml` (through named edits only), developer-owned feature files,
and the monolith's own build.

**Lost? Run `seans-mfe-tool flow:status <evidence>`.** It derives where you are
from the files and prints the next command with its arguments filled in
(`flows/decompose.yaml`, ADR-119). Its order is this playbook's order.

## The stages

| # | Command | You check before going on |
|---|---|---|
| 1 | `decompose:capture <url> --out ./evidence --explore 20` (or `--journeys`) | Source coverage near 100% (needs a **development** build); every route visited |
| 2 | `decompose:analyze <app-dir> --evidence ./evidence` | `join:` line — every observed endpoint explained by source |
| 3 | `decompose:propose ./evidence` | `✓ every manifest, the composition and every spec validate` |
| — | Shape: `decompose:edit` / `decompose:workspace` / `decompose:ask` | Named edits only. Never hand-edit `decomposition.yaml` or anything derived from it |
| 4 | `decompose:present ./evidence/proposal` | Every domain appears on some captured screen |
| **Gate** | **A person approves** (workspace Approve tab, or an `approve` edit they ran) | `flow:status` shows `approved by <name>`. You do not approve |
| 5 | `decompose:scaffold ./evidence/proposal --app-dir <app-dir>` | No structural refusal; read every warning |
| 6 | Give the monolith its remote entry (`<fleet>/legacy-<app>/MONOLITH-FEDERATION.md`) | The patched monolith alone is still at parity: `decompose:verify ./evidence` |
| 7 | Run the fleet; `decompose:verify ./evidence --url http://localhost:5199` | The legacy wrapper alone is at parity: every step, every region, 0 console, 0 visual |
| 8 | `decompose:port ./evidence/proposal`, rebuild, re-register `rules.json` | Read every warning: duplicated files and couplings are your port work |
| 9 | `decompose:verify` again; fix what it lists, in developer-owned files only | At parity. State any `--max-diff-pixels` budget and why |
| **Gate** | **A person signs off** each parity report | — |

Scoring against an answer key (`decompose:score --answer-key`) is for reference
apps only. Never read an answer key while proposing.

## Naming rules

- Domain ids: lower-case kebab-case, named for the business capability, not the
  folder (`life-support`, not `pages-ls`).
- MFE names: `<namespace>-<domain>`. The legacy wrapper is `legacy-<app>`.
- Capabilities: PascalCase, the component's own name (`CargoManifest`). Rename
  with `rename-capability`, never by editing a file.
- Slots: kebab-case, named for the region (`main`, `status-rail`); repeated
  slots carry their key (`berth-tile.{id}`).
- State keys: `<namespace>.root`, `<namespace>.open.<domain>`.

## Stop and ask

Stop and put the question to a person — do not resolve it with an edit — when:

- **Low evidence agreement**: a feature domain's signals agree below 0.5
  (`low-evidence`). The boundary is a guess.
- **A component claimed by two domains**: the CLI refuses this outright
  (`file-claimed-twice`, `capability-claimed-twice`). Ask which owns it, or
  whether it belongs in `shared`.
- **A backend every domain calls** (`backend-everywhere`): a split by screen may
  not be a split by data.
- **A domain that owns no data** (`no-data-of-its-own`): merge it, or ask.
- A coupling (`couplings:` in the proposal) you would have to break to make a
  boundary hold.
- Parity fails after you changed nothing but composition.

The structural rules and the first three conditions are code:
`src/sentinel/decomposition.ts` (a Sentinel `ValidatePort`, ADR-089).
`decompose:scaffold` refuses on the structural ones and prints the rest.

## The first composed run (legacy wrapper only)

This is the proof that the fleet composes the monolith unchanged (ADR-111). It
was at parity on meridian-monolith: 7/7 steps, 153/153 regions.

1. **The monolith's build** — apply `MONOLITH-FEDERATION.md`: a `src/federation.tsx`
   exporting `mount(element)` that renders exactly what `src/index.tsx` renders;
   `ModuleFederationPlugin` with `exposes: { './mount': ... }` and **no
   `shared`**; `output.publicPath: 'auto'` with
   `HtmlWebpackPlugin({ publicPath: '/', excludeChunks: ['<scope>'] })`; and
   `devServer.headers['Access-Control-Allow-Origin'] = '*'`. Restart the dev
   server — webpack does not reload its own config.
2. **Control plane** — registry and daemon from `packages/control-plane`, then
   POST every entry of `<fleet>/control-plane/rules.json` (the fleet README has
   the loop). The registry is in memory: re-register after a restart.
3. **The legacy wrapper — production build, not `rspack serve`.** rspack's dev
   server lazily compiles dynamic imports, and a cross-origin shell waits on
   that forever. `npx rspack build && npx serve dist -l 5200 --cors`.
4. **The shell** — `npm install && npm run dev` in `<fleet>/shell` (:5199). It
   uses React's production build on purpose; a development react-dom shared
   with production remotes logs an error on every mount, and the parity gate
   counts it.
5. `decompose:verify ./evidence --url http://localhost:5199`.

If step 0 of the journey shows loading text, the page was recorded before it
finished assembling. Capture waits on `[data-composition="pending"]`,
`[data-slot-state="pending"]`, in-flight scripts and a busy main thread; a
wrapper of your own must mark itself the same way.

## The port (PDR-013, ADR-126)

There is no strangling: port every domain, compose the proposal directly, prove parity once.
`decompose:port` does the mechanical part. Then you:

1. **Build for the gate in development mode.** Capture maps regions through React's development
   metadata. `NODE_ENV=development npx rspack build --mode development` in each MFE (the
   generated config takes `NODE_ENV` from the environment), and run the shell with
   `SHELL_REACT_ENV=development` so its React matches.
2. **Re-register `rules.json`** after every port or composition change; the registry is in
   memory.
3. **Read the parity report as a work list.**
   - *Extra calls, each endpoint N times*: every MFE's copy of a shared store is loading it. On
     meridian the fix was to keep the store on `window` under one key, started by whichever MFE
     mounts first (`useSyncExternalStore`), in each copy of `src/store/AppContext.tsx`. Say in
     the PR that it is remaining coupling; the real fix is each domain loading its slice through
     its BFF.
   - *A screen's content still showing on the next screen*: a slot the new state does not fill.
     The composition places `EmptySlot` there; if it does not, re-derive.
   - *1–3 changed pixels on a panel's border*: antialiasing where a slot wrapper now sits. Budget
     it with `--max-diff-pixels`, and say so.
4. Never edit generator-owned files, and never re-run `decompose:port --force` over your edits —
   it keeps changed files by default and names them.

Strangling a monolith that must keep serving production (ADR-125) is deferred. Do not build on it.
