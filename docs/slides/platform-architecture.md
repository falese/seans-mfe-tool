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
  }
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

The unit of composition should be a **domain capability** — not a page.

</div>

---

# Define once. Generate everything.

A team writes one YAML file. The CLI generates the entire project.

```yaml
name: play-game
type: remote
framework: react
capabilities:
  - name: PlayGame
    inputs: { gameId: id! }
  - name: ShowCover
    inputs: { gameId: id! }
```

**What gets generated from this manifest →**

| Artifact | Description |
|---|---|
| Bundler config | `rspack.config.ts` — Module Federation remote entry |
| MFE lifecycle | `BaseMFE` subclass with `load()`, `render()`, `health()` |
| GraphQL BFF | Resolvers + schema wired to capability handlers |
| Dockerfile | Multi-stage, framework-specific, production-ready |

`framework` and `bundler` are manifest fields. Changing them regenerates the whole project.

---

# One pattern. Four layers.

The same abstraction holds at every level of the platform.

| Layer | Abstract base | Concrete implementations |
|---|---|---|
| MFE runtime | `BaseMFE` | `RemoteMFE`, `AngularRemoteMFE` |
| CLI commands | `BaseCommand` | every oclif command |
| Framework plugins | `BaseFrameworkPlugin` | `ReactRspackPlugin`, `AngularWebpackPlugin` |
| **Control plane** <span class="pill">new</span> | **`BaseControlPlane`** | **`NodeControlPlane`, `RustControlPlane`** |

<br/>

<div class="highlight">

**Abstract base owns the shape. Concrete owns the how.**
Swap any implementation — Node daemon ↔ Rust daemon ↔ mock — without touching the host.

</div>

---

# The control plane in three lines

`BaseControlPlane` bundles daemon + registry + LayoutManager into one lifecycle unit.

```typescript
const cp = new NodeControlPlane({
  container:    document.getElementById('app'),
  session:      { sessionId, user, jwt },
  daemonUrl:    'ws://localhost:3001/graphql',
});

await cp.start();   // daemon → registry → LayoutManager, wired in order
await cp.stop();    // LayoutManager → registry → daemon, reversed
```

<div class="columns">

<div>

**The host never touches:**
- `LayoutManager`
- slots or adaptors
- the transport
- DaemonChannels

</div>

<div>

**The host gets:**
- `status` — idle / starting / running / stopped / error
- `activeSlots` — what's mounted right now
- `uptime` — ms since start()

</div>

</div>

---

# Any MFE. Any framework. One shell.

Every MFE exposes a guaranteed polyglot floor. React MFEs can opt in to in-tree composition.

```
React Shell  (hostFramework: 'react')
│
├── Slot: main ──────► React MFE        → NativeComponentHandle
│                      PlayGame           shared Redux store, Router, ThemeProvider
│
├── Slot: sidebar ───► Angular MFE      → ImperativeMountHandle
│                      ShowCover          isolated DOM island · bootstrapped in place
│
└── Slot: header ────► Vue MFE          → ImperativeMountHandle
                       UserProfile        isolated DOM island · mounted in place
```

<div class="columns">

<div>

**ImperativeMountHandle** — guaranteed
Every MFE exposes exactly one.
Polyglot. Always safe. Always available.

</div>

<div>

**NativeComponentHandle** — opt-in
`hostFramework: 'react'` activates it.
Shared context. In-tree. Framework-native.

</div>

</div>

---

# Adding a framework = publishing a package

Zero core changes required. The CLI resolves the framework plugin at runtime.

```typescript
// @seans-mfe/framework-vue — a new package, not a core PR
class VueVitePlugin extends BaseFrameworkPlugin {
  readonly framework = 'vue';
  readonly bundler   = 'vite';
  readonly defaultPort = 5173;

  async startDevServer(manifest, opts): Promise<DevServerHandle> { /* ... */ }
  async buildProduction(manifest, opts): Promise<BuildResult>    { /* ... */ }
  getDockerStrategy(manifest): DockerStrategy                    { /* ... */ }
}
```

<br/>

**Commands that Just Work™ for any plugin:**

`build:dev` · `build:prod` · `build:docker` · `build:check` · `remote:init` · `deploy`

<div class="highlight">

Want Vite support? Publish `@seans-mfe/framework-vue-vite`. Done.

</div>

---

# Types are not documentation. Types are the platform.

`@seans-mfe/contracts` is the shared vocabulary across every layer.

| Contract | Source of truth | Used by |
|---|---|---|
| CLI output envelope | `envelope.ts` | every command, every consumer |
| Error hierarchy | `errors/` | CLI, daemon, registry |
| Daemon wire protocol | `messages.ts` | daemon ↔ LayoutManager ↔ MFEs |
| Presentation handle | `presentation.ts` | MFEs, host-side providers |
| Framework plugin API | `framework-plugin.ts` | CLI commands, plugin authors |
| Control plane API | `base-control-plane.ts` | host shells, concrete CP impls |

<br/>

Every boundary is **validated at runtime** (Zod at ingress).
Every contract is **versioned** and **published**.
Prose docs are derived from types — **never the other way around**.

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

A community registry of domain-capability packs. Install `PlayGame`, `Checkout`, `UserProfile` the same way you install a React component library.

<div class="highlight">

Federation is the delivery mechanism. **Domain capability is the product.**

</div>

---

# Architecture at a glance

```
Host Shell
└── BaseControlPlane.start() / stop()
    │
    ├── LayoutManager          ← daemon-driven slot composition
    │   ├── slots              ← one DOM section per experience
    │   ├── adaptors           ← module-federation · html · json · custom
    │   └── DaemonChannel      ← per-slot virtual WebSocket (ADR-057)
    │
    └── Daemon + Registry      ← action → resolution → experience
        └── DaemonTransport    ← WebSocket / GraphQL subscription

MFE (any framework)
└── BaseMFE.load() → render() → health()
    └── PresentationHandles
        ├── ImperativeMountHandle   ← guaranteed polyglot floor
        └── NativeComponentHandle[] ← opt-in framework-native upgrade

@seans-mfe/contracts            ← shared type vocabulary for all of the above

BaseFrameworkPlugin             ← build-time: scaffold · codegen · build · docker
```

<br/>

Full reference: `docs/architecture-whitepaper.md` · ADRs: `docs/architecture-decisions/`

---

<!-- _class: lead -->

# Thank you

**Repo:** `falese/seans-mfe-tool`

**Docs:**
`docs/architecture-whitepaper.md` — full technical white paper
`docs/schemas/` — every platform type contract
`docs/architecture-decisions/` — ADR-001 through ADR-059

*Abstract base owns the shape. Concrete owns the how.*
