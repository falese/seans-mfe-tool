---
marp: true
theme: default
class: invert
paginate: true
# To preview: install "Marp for VS Code" → Ctrl+Shift+P → "Marp: Open Preview"
# To export: Ctrl+Shift+P → "Marp: Export Slide Deck" → PDF or PPTX
style: |
  section {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background-color: #0d1117;
    color: #e6edf3;
    font-size: 21px;
  }
  section pre, section pre code { font-size: 0.82em; line-height: 1.35; }
  section table { font-size: 0.86em; }
  h1 { font-size: 1.9em; }
  section.lead {
    justify-content: center;
    text-align: center;
  }
  h1 {
    color: #58a6ff;
    border-bottom: 2px solid #21262d;
    padding-bottom: 0.3em;
  }
  h2 {
    color: #79c0ff;
  }
  h3 {
    color: #a5d6ff;
  }
  code {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #e6edf3;
  }
  pre {
    background: #161b22 !important;
    border: 1px solid #30363d;
    border-radius: 8px;
  }
  pre code {
    border: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    background: #161b22;
    color: #58a6ff;
    padding: 0.5em 1em;
  }
  td {
    padding: 0.4em 1em;
    border-bottom: 1px solid #21262d;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2em;
    align-items: start;
  }
  .pill {
    display: inline-block;
    background: #1f6feb;
    color: #e6edf3;
    border-radius: 12px;
    padding: 0.1em 0.6em;
    font-size: 0.75em;
    margin-left: 0.4em;
    vertical-align: middle;
  }
  .highlight {
    background: #1f2d3d;
    border-left: 3px solid #58a6ff;
    padding: 0.5em 1em;
    border-radius: 0 6px 6px 0;
    margin: 0.5em 0;
  }
---

<!-- _class: lead -->

# seans-mfe-tool

## A platform for delivering domain features as independently deployable units

*in any framework · any language · any federation pattern*

---

# The problem with micro-frontends today

<div class="columns">

<div>

**What teams do**

- Ship full pages as remotes
- Couple to one framework
- Hand-wire Module Federation
- Duplicate shell logic per team
- Invent their own lifecycle contracts

</div>

<div>

**What they get**

- Framework lock-in
- No polyglot story
- MFEs that know too much about the host
- Integration chaos at the shell layer
- No shared health, teardown, or error model

</div>

</div>

<br/>

<div class="highlight">

The unit of composition is a **domain capability**, not a page.

</div>

---

# Define once. Generate everything.

A team writes one YAML file. The CLI generates the project.

```yaml
name: abc-kids-animal-sounds
version: 1.0.0
type: remote
language: typescript
framework: react
bundler: rspack

capabilities:
  - PlayGame:
      type: domain
  - Load:
      type: platform
      lifecycle:
        before: [{ onLoadBegin: { handler: onLoadBegin } }]
```

`framework` and `bundler` are manifest fields. Changing them regenerates the project.

---

# What comes out

| Generated | File |
|---|---|
| Bundler config | `rspack.config.js` — Module Federation remote entry |
| MFE lifecycle | `src/platform/base-mfe/mfe.ts` — a `RemoteMFE` subclass |
| Slot contract | `src/slots.tsx` — when the manifest declares `providesSlots` |
| GraphQL BFF | `bff/` — when the manifest declares one |
| Container | `Dockerfile`, `nginx.conf`, `docker-compose.yaml` |

Files fall into two groups. Generator-owned files are re-stamped on every run, so a platform change reaches them by regenerating. Developer-owned files are seeded once and then left alone, and `--force` re-seeds scaffolding but never an implemented capability.

Across the two reference fleets: 21 MFEs, 435 files, 253 generator-owned and 182 developer-owned.

---

# One pattern, four layers

The same shape holds at every level.

| Layer | Abstract base | Concrete |
|---|---|---|
| MFE runtime | `BaseMFE` | `RemoteMFE`, `AngularRemoteMFE` |
| CLI commands | `BaseCommand` | every oclif command |
| Framework plugins | `BaseFrameworkPlugin` | `ReactRspackPlugin`, `AngularWebpackPlugin` |
| Host control plane | `BaseControlPlane` | the host supplies its own |

<br/>

<div class="highlight">

**Abstract base owns the shape. Concrete owns the how.**

</div>

`BaseControlPlane` is the host-side lifecycle: it starts the transport, the registry client and the `LayoutManager` in order, and stops them in reverse. A shell subclasses it. The repository ships the base and the services, not a concrete host.

---

# The control plane is two services and a manager

`packages/control-plane` is a registry and a daemon, each a GraphQL server in its own image. Neither imports anything from `packages/`.

```
registry                    daemon                     the shell
├─ serves rules.json        ├─ subscribes to registry   ├─ BaseControlPlane
├─ componentUpdate          ├─ fans out over            │   └─ LayoutManager
│  subscription             │   graphql-ws              │       ├─ slots
└─ register(describe        └─ sendMessage for          │       ├─ adaptors
   + routes)                   actions going up         │       └─ DaemonChannel
```

<div class="columns">

<div>

**The host does not touch**
- `LayoutManager`
- slots or adaptors
- the transport
- `DaemonChannel`

</div>

<div>

**The host reads**
- `status` — idle / starting / running / stopped / error
- `activeSlots` — what is mounted
- `uptime` — ms since `start()`

</div>

</div>

---

# Composition is authored, then compiled

A fleet writes one composition document. `compose:build` compiles it to the payload the registry serves (ADR-083).

```
control-plane.yaml          →   compose:build   →   control-plane/rules.json
one per fleet                                        generated, never hand-edited
```

Slot addresses are assigned names, never measured positions (ADR-066):

```
games.{gameId}      sidebar.status      header.profile
```

One grammar, in `packages/contracts/src/slot-grammar.ts`, is used twice: the DSL validates `providesSlots` against it at design time, and the runtime matcher compiles against it at run time. `compose:validate --check` fails when the committed payload no longer matches the source.

---

# Any MFE. Any framework. One shell.

Every MFE exposes a guaranteed mount. A host that shares the MFE's framework can opt into a native handle instead.

```
React Shell  (hostFramework: 'react')
│
├── Slot: main ──────► React MFE        → NativeComponentHandle
│                      PlayGame           shared store, router, providers
│
├── Slot: sidebar ───► Angular MFE      → ImperativeMountHandle
│                      ShowCover          isolated DOM island
│
└── Slot: header ────► Vue MFE          → ImperativeMountHandle
                       UserProfile        isolated DOM island
```

<div class="columns">

<div>

**ImperativeMountHandle** — mandatory
`mount(element, opts) → unmount`.
The host never needs to know the framework.

</div>

<div>

**NativeComponentHandle** — optional
`component: unknown`, tagged with its framework.
Tagged, never inspected.

</div>

</div>

---

# Why that works

Four links carry the polyglot property. None of them carries a framework name.

| # | Link | Where |
|---|---|---|
| 1 | A slot address is an assigned name | ADR-066 / ADR-069 |
| 2 | A rule binds experience to address as data | ADR-083 |
| 3 | The imperative mount is mandatory | ADR-056 |
| 4 | The native handle is tagged, not inspected | ADR-056 |

<br/>

`packages/runtime/src/__tests__/boundary.test.ts` parses import declarations across the neutral layers and fails on a framework import. The framework-specialized classes are exempt, because producing the native handle is what they do.

<div class="highlight">

A Vue MFE fills a React shell's slot because the shell only ever calls `mount(el)`.

</div>

---

# Adding a framework = publishing a package

No core change. The CLI resolves the framework plugin at run time (ADR-036).

```typescript
// @seans-mfe/framework-vue — a new package, not a core PR
class VueVitePlugin extends BaseFrameworkPlugin {
  readonly framework = 'vue';
  readonly bundler   = 'vite';

  async startDevServer(manifest, opts): Promise<DevServerHandle> { /* ... */ }
  async buildProduction(manifest, opts): Promise<BuildResult>    { /* ... */ }
  getDockerStrategy(manifest): DockerStrategy                    { /* ... */ }
}
```

**Commands that resolve the plugin rather than branching on a name:**

`build:dev` · `build:prod` · `build:docker` · `build:check` · `remote:init` · `deploy`

`framework` and `bundler` are open strings, not enums: an unknown value warns rather than failing validation.

---

# Types are not documentation. Types are the platform.

`@seans-mfe/contracts` is the shared vocabulary, and depends on nothing.

| Contract | Source of truth | Used by |
|---|---|---|
| CLI output envelope | `contracts/envelope.ts` | every command, every consumer |
| Error hierarchy | `contracts/errors/` | CLI, daemon, registry |
| Daemon wire protocol | `contracts/messages.ts` | daemon ↔ LayoutManager ↔ MFEs |
| Presentation handle | `contracts/presentation.ts` | MFEs, host-side providers |
| Framework plugin API | `contracts/framework-plugin.ts` | CLI commands, plugin authors |
| Lifecycle state machine | `contracts/platform-contract.ts` | runtime, DSL, codegen |
| Host control plane | `runtime/base-control-plane.ts` | host shells |

Schemas are generated from the code that enforces them, then committed and diffed in CI.

---

# The long game: a domain capability marketplace

<div class="columns">

<div>

**Act 1 — Now**

Teams use the CLI to generate and deploy domain-capability MFEs in their own repos.

A manifest defines capabilities. The platform handles the rest.

</div>

<div>

**Act 2 — Near**

Teams publish packages:

```
@acme/capabilities-commerce
@acme/capabilities-identity
@acme/capabilities-gaming
```

Any shell operator installs and composes them.

</div>

</div>

<br/>

**Act 3 — Long**

A community registry of domain-capability packs, installed the way you install a component library.

<div class="highlight">

Federation is the delivery mechanism. **Domain capability is the product.**

</div>

---

# Architecture at a glance

```
Host Shell
└── BaseControlPlane.start() / stop()
    ├── LayoutManager          ← desired-state slot composition
    │   ├── slots · adaptors   ← module-federation · html · json · custom
    │   └── DaemonChannel      ← per-slot virtual socket (ADR-057)
    └── transport              ← graphql-ws to the daemon

packages/control-plane          ← registry + daemon, two GraphQL services

MFE (any framework)
└── BaseMFE                    ← ten capabilities, one middleware pipeline
    └── PresentationHandles
        ├── ImperativeMountHandle   ← mandatory
        └── NativeComponentHandle[] ← optional, tagged

@seans-mfe/contracts            ← shared vocabulary, depends on nothing
BaseFrameworkPlugin             ← build time: scaffold · codegen · build · docker
```

Drawn in full: `docs/cli-architecture.html`, `docs/runtime-architecture.html`.

---

<!-- _class: lead -->

# Thank you

**Repo:** `falese/seans-mfe-tool`

**Docs:**
`docs/cli-architecture.html` — how the tooling is built
`docs/runtime-architecture.html` — what runs after the CLI exits
`docs/architecture-whitepaper.md` — the full technical white paper
`docs/architecture-decisions/` — every architecture decision, with an index in `docs/spec.md`

*Abstract base owns the shape. Concrete owns the how.*
