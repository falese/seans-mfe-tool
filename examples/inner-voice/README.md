# inner-voice

A no-send-button thinking interface, delivered as a domain-capability MFE. You
think out loud in the left panel; after a beat of silence the local LLM
(`coder serve`) streams a response into the right panel and the model's concept
threads radiate from the center. Clicking a thread folds it back into your
thought and the loop continues. It is the **human input layer for the agentic
delivery loop**.

This directory is structured as a **manifest-driven drop-in**: the domain
functionality (`src/`) and the manifest (`mfe-manifest.yaml`) are authored here,
and the platform scaffold (`src/platform/**`, `rspack.config.js`, `package.json`,
etc.) is produced by the SMT generator. Regenerate the scaffold, drop the
manifest + `src/` on top, and you have a running MFE.

---

## What's here vs. what the generator produces

| Authored here (domain functionality + manifest) | Produced by `remote:generate` (platform scaffold) |
|---|---|
| `mfe-manifest.yaml` | `src/platform/base-mfe/{mfe,bootstrap,types}.ts` |
| `src/features/InnerVoice/*` (the capability component) | `src/remote.tsx`, `src/App.tsx`, `src/index.tsx` |
| `src/hooks/*`, `src/lib/*` | `rspack.config.js`, `package.json`, `tsconfig.json` |
| `tests/*` (pure-logic unit tests) | Docker/nginx, jest config |
| `demo/*` (standalone Vite demo) + deploy workflow | — |

`demo/` is deliberately a **separate** Vite app so `remote:generate --force`
(which overwrites the rspack scaffold) never clobbers the GitHub Pages build.

---

## Build it (local, federated)

```bash
# 1. Start the local inference server (falese/coder)
coder serve                         # http://localhost:3991  (uses default_model)
#   or, for a no-model smoke test:
CODER_DRY_RUN=1 coder serve

# 2. Scaffold the platform code from the manifest (from the seans-mfe-tool root)
bun bin/dev.ts remote:init inner-voice --port 3009 --framework react
#    -> then copy this directory's mfe-manifest.yaml + src/ over the scaffold
bun bin/dev.ts remote:generate       # run inside examples/inner-voice

# 3. Run the MFE dev server
bun bin/dev.ts build:dev             # serves remoteEntry.js on :3009
```

Load it in a shell by pointing the shell at
`http://localhost:3009/remoteEntry.js` and rendering the `InnerVoice` capability,
exactly as with any other generated remote.

### Two integration edits to the generated `src/platform/base-mfe/mfe.ts`

The generator emits a stub component resolver; point it at the real component
and inject the manifest `config:` block as props so `describe()`'s config flows
into the UI (the component also has hardcoded fallbacks, so this is optional):

```ts
// resolve the domain component
protected async loadDomainComponent(name: string): Promise<unknown> {
  if (name === 'InnerVoice') {
    return import('../../features/InnerVoice/InnerVoice').then(
      (m) => m.InnerVoice ?? m.default,
    );
  }
  return super.loadDomainComponent(name);
}

// pass manifest config -> component props
protected async doRender(context: Context): Promise<RenderResult> {
  context.inputs = {
    ...context.inputs,
    props: { config: this.manifest.config, ...(context.inputs?.props ?? {}) },
  };
  return super.doRender(context);
}
```

`onLoadError` is declared `contained: true` in the manifest, so a failed load is
logged via the platform handler and isolated rather than crashing the shell.

---

## Run the demo (standalone, Anthropic API)

The GitHub Pages demo can't reach `coder serve`, so it streams from the
Anthropic API directly (browser, demo only).

```bash
cd examples/inner-voice/demo
npm install
VITE_DEMO_MODE=true VITE_ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Pushing to `main` (touching `examples/inner-voice/**`) runs
`.github/workflows/deploy-inner-voice.yml`, which builds `demo/` with
`VITE_DEMO_MODE=true` and publishes to GitHub Pages at:

> https://falese.github.io/seans-mfe-tool/inner-voice/

The repo secret `ANTHROPIC_API_KEY` must be set. Demo model defaults to
`claude-sonnet-4-6` (low latency for an interactive thinking partner); override
with `VITE_ANTHROPIC_MODEL`.

Without `VITE_DEMO_MODE`, the same component targets `coder serve` at
`coderServeUrl` (default `http://localhost:3991`).

---

## Configuration

All values come from the manifest `config:` block and have hardcoded fallbacks
in `src/lib/config.ts`, so the MFE runs with no manifest:

| Key | Default | Meaning |
|---|---|---|
| `coderServeUrl` | `http://localhost:3991` | local SSE inference endpoint |
| `pauseMs` | `2200` | silence before a response triggers |
| `minChars` | `12` | minimum thought length to trigger |
| `maxHistoryTurns` | `6` | prior responses retained (faded) |
| `maxThreads` | `12` | unique session threads retained |
| `maxTokens` | `1024` | token budget per generation (headroom for reasoning models) |
| `systemPrompt` | built-in | the persona/instructions sent every request — override to retune behavior |

The persona lives in `src/lib/systemPrompt.ts` (`SYSTEM_PROMPT`) and is the single
source of every behavioral constraint (length, "thinking partner" framing, the
`<threads>` block). Override it per-deployment via the manifest `systemPrompt`
config — but **keep the `<threads>{...}</threads>` instruction**, or the center
thread web stops populating.

### Dual-voice (reasoning models)

`coder serve` is channel-aware: it splits a model's reasoning from its answer and
tags each streamed token `thought` or `final`. The UI renders the **thought**
channel as a second inner voice (italic, accent-tinted, indented) braided above
the crystallized **final** answer — so a reasoning model's thinking becomes part
of the experience rather than noise. Threads are pulled from the final answer,
falling back to the reasoning. Instruct models (no reasoning) are unaffected —
everything is `final`. Supported reasoning formats: DeepSeek `<think>…</think>`
and Harmony `<|channel|>analysis/final`.

---

## Tests

The runtime-agnostic core (thread parsing, SSE parsing, radial layout, config
resolution, thread accumulation) is unit-tested and runs without React:

```bash
cd examples/inner-voice
bun test tests/      # 23 tests
```

Component/hook behavior is exercised once the platform scaffold is generated
(jest, via `remote:generate`).

---

## Layout

```
mfe-manifest.yaml                     # capabilities + config + lifecycle
src/
  features/InnerVoice/
    InnerVoice.tsx                    # root: layout, CSS, wires hooks
    ThoughtPanel.tsx                  # left: textarea + countdown bar
    ThreadWeb.tsx                     # center: pulse + radial nodes
    ThreadNode.tsx                    # one radial concept node
    PulseRing.tsx                     # center pulse + rings
    ResponsePanel.tsx                 # right: streaming text + thread history
    index.ts
  hooks/
    usePauseTimer.ts                  # debounced silence trigger
    useCoderStream.ts                 # streaming state machine
    useThreads.ts                     # thread accumulation
  lib/
    streamCoder.ts                    # coder serve SSE client
    streamClaude.ts                   # Anthropic API SSE client (demo)
    runStream.ts                      # backend dispatch (local vs demo)
    sse.ts                            # incremental SSE parser
    parseThreads.ts                   # <threads> extraction + strip
    threads.ts                        # dedupe/cap accumulation
    threadLayout.ts                   # radial trigonometry
    config.ts                         # config resolution + defaults
    systemPrompt.ts                   # shared system prompt
    env.ts                            # Vite env accessors
tests/                               # bun unit tests for lib/
demo/                                # standalone Vite app for GitHub Pages
```
