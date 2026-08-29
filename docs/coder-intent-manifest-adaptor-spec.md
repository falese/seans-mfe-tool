# Spec: the `intent-manifest` coder adaptor

**Status:** Draft · **Implements:** PDR-009, ADR-084, ADR-085 · **Owner repo of the artifact:** `falese/coder` · **Owner of this contract:** this repo (ADR-085)

## Purpose

Train a local open-weight LoRA adaptor that compiles a **natural-language business intent**
into a **valid `mfe-manifest.yaml`** for this platform's DSL. This is the intent→manifest lane
of ADR-084: the model's output is a *manifest*, never source, so the deterministic,
drift-gated codegen core downstream is untouched and CI is the acceptance oracle (ADR-086).

coder today ships a `react-ts` adaptor that generates React/TS *source* (0.92 eval pass). It
has **no manifest capability** — this adaptor fills that gap. It is a coder-repo artifact built
against the contract and corpus this repo owns; the spec below carries the full pack contents
so it can be dropped into `coder/adaptors/intent-manifest/` and `coder adaptor install`ed.

> **Runtime note.** Training and eval require the coder runtime (Bun + `mlx_lm`, ~18 GB,
> Apple-Silicon). This spec is authored platform-side; execution happens in a coder
> environment. Nothing here runs in the seans-mfe-tool CI.

---

## 1. Pack layout

Mirrors coder's adaptor pack contract (`src/adaptors/types.ts` `ManifestSchema`; `react-ts` as
the template). `coder adaptor install intent-manifest --from-git <url>` validates **only**
`manifest.json` on install.

```
adaptors/intent-manifest/
  manifest.json          # ManifestSchema (below)
  train-config.toml      # TrainConfigSchema (below)
  extract.json           # present but no-op — see §4
  prompts/system.md      # DSL-grammar system prompt (§5)
  evals/eval_suite.ts    # bun test; DSL validator is the oracle (§6)
  data/
    train.jsonl          # produced by `coder data split`
    valid.jsonl          # produced by `coder data split` (mlx_lm requires this name)
    eval.jsonl           # held-out intents for `coder adaptor eval`
  weights/               # LoRA adapters.safetensors — training output
  README.md
```

## 2. `manifest.json`

```json
{
  "name": "intent-manifest",
  "version": "0.1.0",
  "domain": "mfe-dsl",
  "base_model": "Qwen2.5-Coder-7B",
  "mlx_quant": "4bit",
  "lora_rank": 8,
  "min_memory_gb": 18,
  "author": "",
  "description": "Compile a business intent into a seans-mfe DSL mfe-manifest.yaml",
  "eval_pass_rate": 0,
  "baseline_pass_rate": 0
}
```

`eval_pass_rate` / `baseline_pass_rate` are overwritten by `coder adaptor eval`
(`updateManifestScore`). All other fields must satisfy `ManifestSchema` (required: name,
version, domain, base_model, mlx_quant, lora_rank>0, min_memory_gb>0, eval_pass_rate 0..1,
author, description).

## 3. `train-config.toml`

Copy `react-ts`'s and retarget. Parsed by `src/training/config.ts` (`TrainConfigSchema`,
`smol-toml`, `~` expanded); the runner spawns `python3 -m mlx_lm lora --train …`.

```toml
[model]
path = "~/.coder/models/mlx-community/Qwen2.5-Coder-7B-Instruct-4bit"

[lora]
rank = 8
target_modules = ["q_proj", "v_proj"]
iters = 200
batch_size = 2
learning_rate = 1e-4

[data]
dir = "adaptors/intent-manifest/data"     # must contain train.jsonl AND valid.jsonl

[output]
adaptor_dir = "adaptors/intent-manifest/weights"
manifest    = "adaptors/intent-manifest/manifest.json"
log_file    = "adaptors/intent-manifest/training.log"
```

Sane starting hyperparameters; tune `iters`/`learning_rate` after the first eval. The runner
aborts on divergence (`TrainingDivergedError`) and bumps the manifest patch version on success.

## 4. Data generation — the load-bearing step

**Record format** (coder's `JsonlRecord`, the `mlx_lm.lora` format): one JSON object per line,
`{ "prompt": "<NL business intent>", "completion": "<full mfe-manifest.yaml text>" }`.

**Bypass `coder data extract`.** Its rules are code-anchor only (`jsdoc → next_function`, etc.,
per `ExtractConfigSchema`); they cannot turn prose into YAML. Generate `{prompt, completion}`
pairs **directly**, then run them through the rest of the pipeline:

```
# after datagen writes pairs.jsonl:
coder data deduplicate < pairs.jsonl \
  | coder data validate \
  | coder data split --train-ratio 0.9 --seed 42 --output-dir adaptors/intent-manifest/data
```

`extract.json` must still exist for the pack layout — make it a minimal no-op:

```json
{ "rules": [ { "prompt": "line_comment", "completion": "next_block" } ] }
```

### 4a. Seed corpus (gold pairs)

The **21** committed manifests are the gold completions:
`examples/abc-kids/*/mfe-manifest.yaml` (14) + `examples/meridian-station/*/mfe-manifest.yaml` (7).
For each, hand- or model-write **1–3 business intents**; the completion is the manifest verbatim.
Worked example, from `examples/abc-kids/color-mixer/mfe-manifest.yaml`:

```json
{"prompt":"A kids' game MFE where children mix two paints to hit a target color. React, standalone remote, TypeScript. It needs to play the game, show a cover card, and expose game metadata (title, age range, description).","completion":"name: abc-kids-color-mixer\nversion: 1.0.0\ntype: remote\nlanguage: typescript\nframework: react\nbundler: rspack\ndescription: Color Mixer — mix two paints to make the target color!\nowner: abc-kids-team\ntags: [kids, game, colors, art]\ncategory: games\n\nendpoint: http://localhost:3008\nremoteEntry: http://localhost:3008/remoteEntry.js\ndiscovery: http://localhost:3008/.well-known/mfe-manifest.yaml\n\ncapabilities:\n  - PlayGame:\n      type: domain\n      description: Play the Color Mixer game\n  - ShowCover:\n      type: domain\n      description: Show the Color Mixer game cover card with title and art\n  - GetGameInfo:\n      type: domain\n      description: Return game metadata including title, age range, and description\n  - Load:\n      type: platform\n      lifecycle:\n        before: [{ onLoadBegin: { handler: onLoadBegin } }]\n        after: [{ onLoadComplete: { handler: onLoadComplete } }]\n        error: [{ onLoadError: { handler: onLoadError, contained: true } }]\n  - Render:\n      type: platform\n      lifecycle:\n        before: [{ onRenderBegin: { handler: onRenderBegin } }]\n        after: [{ onRenderComplete: { handler: onRenderComplete } }]\n        error: [{ onRenderError: { handler: onRenderError, contained: true } }]\n\ndependencies:\n  runtime:\n    react: ^18.2.0\n    react-dom: ^18.2.0\n  design-system:\n    '@mui/material': ^5.14.0\n"}
```

(Endpoints/ports may be templated or dropped from intents — they are deployment detail the
model should not be expected to invent; keep them in completions so the grammar stays complete,
but do not reference specific ports in the intent text.)

### 4b. Augmentation to ≥500 pairs (coder's quality bar)

21–60 gold pairs is far below coder's `data stats` target (≥500 pairs, dup <5%, prompt mean
<200 tok, completion mean <400 tok). Augment:

1. **Paraphrase** each intent 3–5 ways (same completion).
2. **Synthesize** new intent→manifest pairs spanning the DSL surface: vary `type`
   (tool/feature/remote/service/bff), `framework` (react/angular), `language`, capability sets,
   presence of a `data:` BFF block (see `meridian-cargo-ops`), and `providesSlots`.
3. **Self-label with the oracle.** Every synthetic completion **must pass `validateFull` before
   admission** — a pair whose YAML fails the DSL validator is discarded. This keeps the training
   set 100% schema-valid and makes augmentation safe.

Target a class balance that isn't dominated by the 14 abc-kids look-alikes (they share a shape);
weight meridian/BFF/angular/tool variety up so the adaptor generalizes beyond kids' games.

## 5. `prompts/system.md`

Encode the DSL contract from `packages/dsl/src/schema.ts` so generation stays on-grammar. Load
it at generate/eval time via `--system prompts/system.md`. It must state:

- **Output only a YAML `mfe-manifest.yaml`. No prose, no code fences, no commentary.**
- **Required top-level:** `name` (non-empty); `version` (semver `x.y.z`); `type` ∈
  `tool | agent | feature | service | remote | shell | bff`; `language` ∈
  `javascript | typescript | python | go | rust | java`; `capabilities` (array; may be empty).
- **Optional top-level:** `framework` (open string; default `react`), `bundler` (open string;
  default `rspack`), `description`, `owner`, `category`, `tags[]`, `endpoint`/`remoteEntry`/
  `discovery` (URLs), `dependencies.{runtime,design-system,mfes}`, `data` (GraphQL-mesh BFF),
  `providesSlots[]` (slot-id grammar), `performance`, `transforms`.
- **Capability shape:** `capabilities` is an **array of single-key maps** `Name → { type:
  platform | domain, description?, inputs?, outputs?, lifecycle? }`. Domain caps are the
  feature's own; platform caps (`Load`, `Render`, …) carry `lifecycle` with
  `before/main/after/error` arrays of `hookName → { handler, description?, contained?,
  mandatory?, source? }`.
- **Do not** name a platform wrapper method as a lifecycle handler (`.refine` rejects it).
- A compact grammar sketch plus 2–3 in-context examples (one minimal remote, one with a `data:`
  BFF) belong in this file.

## 6. Eval harness — the DSL validator is the oracle

coder's composite is `tsc*0.4 + eslint*0.3 + tests*0.3` (`src/eval/runner.ts`). tsc and eslint
are **meaningless for YAML**, so route the real signal through the **Tests** dimension.

- `data/eval.jsonl`: held-out representative intents (never in train/valid).
- `evals/eval_suite.ts` (bun test; reads the generated output path from `CODER_EVAL_OUTPUT`):
  1. read the generated text; strip any stray fences;
  2. `validateFull(yaml.load(text))` from `@seans-mfe/dsl` — or write it to a temp dir as
     `mfe-manifest.yaml` and call `parseAndValidateDirectory(tmpDir)`;
  3. assert `result.valid === true && result.errors.length === 0`;
  4. optional structural asserts: `type`/`language` in-enum, `capabilities` is an array,
     platform caps carry a `lifecycle`.

```ts
// evals/eval_suite.ts (sketch)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { load as parseYaml } from "js-yaml";
import { validateFull } from "@seans-mfe/dsl";

test("generated manifest is DSL-valid", () => {
  const out = readFileSync(process.env.CODER_EVAL_OUTPUT!, "utf8");
  const text = out.replace(/^```[a-z]*\n?|```$/gm, "").trim();
  const result = validateFull(parseYaml(text));
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
```

**Success criterion:** validator pass-rate, expressed as **lift ≥ +0.15** over the base model —
`eval_pass_rate − baseline_pass_rate` (coder's stated minimum acceptable lift). Record the
baseline first (`coder adaptor eval intent-manifest --baseline`, no weights), then the tuned run.
`@seans-mfe/dsl` must be resolvable from the eval sandbox (workspace link or published package).

## 7. Invocation and the platform seam

**Direct (coder):**
```
coder generate "<business intent>" --adaptor intent-manifest --system adaptors/intent-manifest/prompts/system.md
# or, against a running server:
coder serve --adaptor intent-manifest --model <mlx dir>
curl -N localhost:<port>/generate -d '{"prompt":"<intent>","system":"<...>"}'
```

**Platform seam (ADR-085 §2).** A `coder:*` wrapper command in *seans-mfe-tool* shells out to
the above, captures the YAML on stdout, writes it as `mfe-manifest.yaml`, then hands off to the
existing deterministic pipeline — `parseAndValidateDirectory` → `remote:generate` — the
intent→manifest lane of ADR-084. The wrapper returns a `CommandResult<T>` (AI-native profile,
PDR-003); coder stays an external service behind the contract. That wrapper is separate
implementation work, not part of this adaptor.

## 8. End-to-end verification (in a coder-enabled env)

1. **Data:** run datagen → `coder data deduplicate|validate|split` → `coder data stats` meets
   ≥500 / dup <5% / prompt mean <200 tok / completion mean <400 tok.
2. **Wiring:** `CODER_DRY_RUN=1 coder adaptor train --config adaptors/intent-manifest/train-config.toml`
   (stub weights, no mlx) proves the config resolves; then a real train run.
3. **Eval:** `coder adaptor eval intent-manifest --baseline` then `coder adaptor eval intent-manifest`;
   confirm lift ≥ +0.15 on the validator pass-rate.
4. **Loop:** `coder generate "<intent>" --adaptor intent-manifest` → pipe YAML through
   `parseAndValidateDirectory` in *seans-mfe-tool* → `remote:generate` → the fleet
   drift/compose gates. **Correct result:** a schema-valid manifest that generates a
   drift-clean MFE with no human edit to the DSL.

## 9. Open items

- **Corpus size.** 21 seed manifests is the real constraint; the adaptor's ceiling is set by how
  well augmentation (§4b) covers the DSL surface without overfitting the abc-kids shape.
- **Endpoints/ports.** Deployment detail the model shouldn't invent — decide whether the wrapper
  injects them post-generation or the grammar templates them.
- **`data:` BFF depth.** The meridian BFF blocks are the hardest completions (multi-source,
  transforms, joins). Consider a follow-on `intent-bff` adaptor if one adaptor underperforms on
  them.
- **Tracking.** If desired, add an `impl.refs`/issue to PDR-009 pointing at this spec as the
  build target for the intent→manifest lane.
