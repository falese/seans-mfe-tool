# Spec: the `drift-audit` coder adaptor

**Status:** Draft · **Implements:** PDR-010, ADR-090 (against the ADR-089 ports) · **Owner repo of the artifact:** `falese/coder` · **Owner of this contract:** this repo

## Purpose

Give coder a **governance** capability: read a decision (an ADR clause) and the code that is
supposed to carry it, and emit a **typed drift finding** — a `HardenedCheck` (mechanizable) or a
`SemanticFinding` (real but not yet mechanizable). This is the governance instance of the same
contract the `intent-manifest` adaptor serves for generation (PDR-010): *a model reads wide, emits
a typed artifact, a deterministic floor executes it.* Here the artifact is a finding and the floor
is Sentinel's `HardenedCheckSchema` + `verify` (`packages/sentinel`), not `validateFull`.

> **This adaptor does NOT train.** Unlike `intent-manifest` (a LoRA fine-tune,
> `docs/coder-intent-manifest-adaptor-spec.md`), `drift-audit` is **inference-only**: a served,
> reasonably capable base model + a system prompt + a typed output contract + retrieval context.
> No corpus, no `train.jsonl`, no `adapter.safetensors`, no `coder adaptor train`. The reasons are
> in ADR-090 and were settled: *n* is tiny (dozens of `implemented_by` fixes, not thousands), and
> the corpus must stay **current** (new ADRs land weekly), so retrieval + judgment beats weights.
> Precision comes from the floor, not the model — see §6.

> **Runtime note.** Authored platform-side; runs in a coder environment (Bun; a served model via
> `coder serve` or `coder generate`). Nothing here runs in seans-mfe-tool CI. The *recall/precision*
> eval (§6b) runs platform-side against git history.

---

## 1. The seam is already built

The transport, both directions, exists in `packages/plugin-coder/src/coder-service.ts` and needs
**no change** — only a new adaptor name and a new oracle:

- **Input:** `coder generate <prompt> --adaptor drift-audit --system <sys> --context <file> …`
  (`buildGenerateArgs` already emits `--adaptor`, `--system`, repeatable `--context`), or the
  `coder serve` `/generate` endpoint. The SMT-side `Judge` adapter assembles the request.
- **Output:** the model's completion on stdout / the `serve` **`final`** channel (the `thought`
  channel of a reasoning model is already stripped by `parseServeBody` — reasoning scratch-work
  must never reach a finding, exactly as it must never reach a manifest).

What's new is entirely: (a) this adaptor pack, (b) the `drift-audit` system prompt + output
schema, (c) Sentinel's `Judge` port + a coder `Judge` adapter + a retrieval adapter, platform-side
(§7, separate work).

## 2. Pack layout — prompt-only

No `train-config.toml`, no `data/`, no `weights/`.

```
adaptors/drift-audit/
  manifest.json          # ManifestSchema — see §3 (the weightless-adaptor question)
  prompts/system.md      # the drift-audit contract + output schema + few-shot (§5)
  evals/eval_suite.ts    # bun test: schema-conformance smoke (§6a)
  fixtures/              # a handful of {bundle, expected-kind} audit units for the smoke eval
  README.md
```

## 3. `manifest.json` — and the one coder-side blocker

```json
{
  "name": "drift-audit",
  "version": "0.1.0",
  "domain": "governance-drift",
  "mode": "inference-only",
  "base_model": "<a capable served instruct/reasoning model>",
  "author": "",
  "description": "Read an ADR clause + its implementing code; emit a typed HardenedCheck | SemanticFinding drift finding"
}
```

**Open blocker for the coder session (§9-1):** coder's `ManifestSchema` (`src/adaptors/types.ts`)
was written for LoRA packs — it may require `lora_rank > 0`, `min_memory_gb`, `mlx_quant`,
`eval_pass_rate`. A prompt-only adaptor has none. **First task:** confirm coder supports a
weightless / `mode: "inference-only"` adaptor (system-prompt-only, base model, no `train`/`eval`
gate). If not, that support is the first PR in coder — do **not** fake a `lora_rank` to satisfy the
schema; a served-model adaptor is a real coder capability worth adding, and `intent-manifest` isn't
the only future consumer of it.

## 4. Input contract — the retrieval bundle (one ADR = one audit unit)

Audit **per decision**, not the whole library in one prompt: one `generate` call takes one ADR
clause and its evidence. This keeps context small, makes ranking per-ADR (then merged
platform-side), and bounds cost. The SMT-side retrieval adapter assembles each unit; coder just
receives it.

**`--system`:** `prompts/system.md` (§5) — task + output schema + few-shot. Static per run.

**`<prompt>` (positional):** the task directive naming the decision under audit, e.g.
`Audit decision ADR-017 for drift between its stated rule and the code that carries it.`

**`--context <file>` (repeatable):** the evidence bundle —
1. the **ADR clause** (the `## Decision` section text, id, title);
2. the **`implemented_by` code** (the files the ADR's frontmatter names, or the SMT `locateArtifacts`
   output — the code that is supposed to carry the decision);
3. **ADR-keyed provenance** — commit bodies / PR descriptions / issue threads that cite the ADR by
   number. **Durable artifacts only** (ADR-090 §3): never raw transcripts.

The model is told (§5) that `enforces` in any finding **must** be an ADR id present in this bundle —
it may not invent one.

## 5. `prompts/system.md` — the output contract IS the narrow waist

Must state, unambiguously:

- **Output only a JSON array of findings. No prose, no code fences, no commentary.** Bare JSON,
  same discipline as `intent-manifest`'s bare YAML.
- **Two variants, discriminated on `kind`:**

  ```jsonc
  // A HardenedCheck: a drift you can express as a source matcher.
  {
    "kind": "hardened",
    "id": "kebab-slug",              // stable; keys any future suppression
    "enforces": "ADR-017",           // MUST be an ADR id from the bundle
    "message": "what is wrong, in the developer's terms",
    "fix": "what to do instead — concrete, actionable without reading the ADR",
    "pattern": "\\bthrow\\s+new\\s+Error\\s*\\(",  // regex SOURCE string (not /…/)
    "exempt": "adr-lint-ignore",     // optional regex source
    "confidence": 0.0                // 0..1, for ranking
  }

  // A SemanticFinding: real drift you CANNOT reduce to a matcher.
  {
    "kind": "semantic",
    "enforces": "ADR-030",
    "message": "the decision says X; the implementation does Y",
    "where": "packages/…/file.ts (or a symbol)",
    "evidence": "a short quote or paraphrase grounding the claim",
    "confidence": 0.0
  }
  ```

- **The precision discipline (the whole point):** emit a `hardened` finding **only** if you can
  write a concrete regex that matches the offending code. If you cannot, and the drift is still
  real, emit a `semantic` finding. If it is neither expressible nor clearly real, **do not emit it.**
  A finding that fits neither variant is, by construction, not actionable.
- **Never certify clean.** Return your best *ranked suspects* (highest `confidence` first). "No
  drift" is not an allowed output — emit low-confidence suspects and let triage discard them
  (ADR-090 §4). An empty array is reserved for "bundle contained no auditable decision," not "looks
  fine."
- **`pattern`/`exempt` are regex source strings**, not `/…/` literals and not RegExp — the
  platform side compiles and validates them (§6).
- A compact schema restatement plus **2–3 in-context examples** (one `hardened` — e.g. the real
  `typed-errors` migration; one `semantic`; one showing correct restraint / a low-confidence
  suspect) belong in this file. These few-shots are load-bearing here the way the corpus is
  load-bearing for `intent-manifest`.

## 6. Eval — split ownership

coder's composite (`tsc*0.4 + eslint*0.3 + tests*0.3`) is meaningless for JSON findings; route real
signal through the **Tests** dimension, and note the *real* evaluation lives platform-side.

### 6a. coder-side (this pack) — schema-conformance smoke

`evals/eval_suite.ts` (bun test) over `fixtures/`: for each fixture bundle, run the model and assert
the output —
1. parses as a JSON array;
2. every element satisfies the `hardened` **or** `semantic` shape;
3. every `hardened.pattern` compiles as a `RegExp` (`new RegExp(pattern)` doesn't throw);
4. every `enforces` is an ADR id that appeared in that fixture's bundle (no invented decisions).

This proves the narrow-waist holds — it does **not** prove the findings are *right*. That's 6b.

### 6b. platform-side (Sentinel/SMT, ADR-090) — git-mined recall + precision

The real oracle, and it does not run in coder. For a known `implemented_by` fix, check out the
commit **before** it, assemble the bundle at that SHA, run the audit, and assert it emits a
`hardened` finding whose compiled `pattern` **`verify()`s to a non-empty hit** on the affected
artifact. Two numbers:
- **recall** on historical drift (did it resurface the known, since-fixed drift among top-k);
- **precision** on current HEAD (fraction of top-k suspects that survive human triage / that
  `verify` fires on).

This is built with Sentinel's `Judge` port + `HardenedCheckSchema` + `verify`; it is the ADR-090
build, tracked separately from this pack.

## 7. Invocation and the platform seam (separate work)

**Direct (coder):**
```
coder generate "Audit decision ADR-017 …" --adaptor drift-audit \
  --system adaptors/drift-audit/prompts/system.md \
  --context /tmp/adr-017.clause.md --context /tmp/adr-017.impl.ts --context /tmp/adr-017.provenance.md
```

**Platform seam (ADR-090, the step-4 build — NOT this pack):**
1. Add a fifth, auditor-only port to `packages/sentinel`: `Judge = (bundle) => Promise<string>`
   (raw model text). Kernel stays pure; `Judge` is injected, exactly like coder's own
   `CoderRunner`.
2. SMT `Judge` adapter wraps `compileIntent`/`CoderRunner` with `adaptor: "drift-audit"` and the
   bundle as `context.contextFiles`.
3. SMT **retrieval** adapter assembles bundles: ADR clauses via `@seans-mfe/plugin-adr`
   (`parseAdrDocument`), `implemented_by` files, ADR-keyed provenance.
4. The auditor orchestrates: retrieve → `Judge` → `JSON.parse` → for each `hardened`,
   `new RegExp(pattern)` then `HardenedCheckSchema.safeParse` then `verify` against the artifact →
   keep those that fire → rank. `semantic` findings are schema-checked and parked for a human,
   never auto-hardened.
5. **Trusting-Trust guardrail (PDR-010):** the model proposes candidates only. A `HardenedCheck`
   becomes a real gate **only** after a human accepts it and it lands as plain code (e.g. a
   `PLATFORM_MIGRATIONS` entry). coder plugs into the *proposal* step, never the floor.

## 8. End-to-end verification (in a coder-enabled env)

1. **Pack installs** as a weightless adaptor (or §9-1 is resolved first).
2. **Smoke (6a):** `coder adaptor eval drift-audit` (or `bun test evals/`) — 100% schema-valid JSON
   across fixtures; every `pattern` compiles; no invented `enforces`.
3. **One real loop:** feed the ADR-017 bundle at a pre-`typed-errors`-fix SHA; confirm the model
   emits a `hardened` finding whose `pattern` matches `throw new Error(` in the affected file — i.e.
   it rediscovers the `typed-errors` migration from scratch.
4. **Restraint check:** feed a decision with no drift at HEAD; confirm it returns ranked
   low-confidence suspects, **not** a fabricated high-confidence `hardened` finding and **not** an
   empty "clean."

## 9. Open items

1. **Weightless adaptor support in coder** — the gating question (§3). Prompt-only / `inference-only`
   mode, no `train`/`eval`-gate. Resolve first.
2. **Model choice** — a capable served instruct or reasoning model; exact pick is coder-side. The
   bar is "good enough to *propose*," because the floor (`verify`) supplies precision (§6, ADR-090).
   Record which model the few-shots were tuned against.
3. **Provenance retrieval shape** — how ADR-keyed commit/PR/issue text is gathered and truncated to
   fit context. Platform-side, but the pack's few-shots should assume a bounded snippet, not a full
   history.
4. **`confidence` calibration** — the model's self-reported score is a ranking hint, not truth;
   precision@k on the 6b eval is what matters. Don't gate on raw `confidence`.
5. **Ranking merge** — per-ADR audits produce per-ADR rankings; the platform side merges into one
   "N ranked suspected drifts" list. Decide the merge (global confidence sort vs. round-robin).
6. **Tracking** — add an `impl.refs`/issue to ADR-090 pointing at this spec as the build target for
   the auditor lane, mirroring #364 for `intent-manifest`.
