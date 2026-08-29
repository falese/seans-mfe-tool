# intent→manifest training corpus

Training data for the `intent-manifest` coder adaptor (issue #364, spec
`docs/coder-intent-manifest-adaptor-spec.md`). Each record is a
`{prompt: "<business intent>", completion: "<mfe-manifest.yaml>"}` pair — coder's
`JsonlRecord`/`mlx_lm.lora` format.

**The insight this corpus is built on:** the 21 committed `examples/**/mfe-manifest.yaml`
files are already the gold *completions*. The corpus work is authoring the *intents*
(prompts) and pairing them. Producing and validating pairs needs only `@seans-mfe/dsl`
(no coder/MLX runtime) — so the dataset is built and gated here; only the LoRA training
happens later in coder.

## Files

| File | What |
|---|---|
| `seed-intents.json` | Hand-authored intents (≈3 per manifest) — the **high-realism** core. |
| `generate.mjs` | Deterministic (seed 42) generator: seed pairs + synthetic reskins, validator-gated. |
| `pairs.jsonl` | The full corpus (660 pairs: 437 plain + 120 data + 40 slot + 63 seed). |
| `train.jsonl` / `valid.jsonl` | 0.9/0.1 split for `mlx_lm.lora` (coder requires `valid.jsonl`). |
| `eval.jsonl` | Held-out slice for `coder adaptor eval`. |
| `stats.json` | Generated stats (counts, token means, dedup). |

## How it's generated

Two lanes:

1. **Seed** — the 21 real manifests × the hand-written intents in `seed-intents.json`
   (63 pairs). Intents are **realism-guarded**: product-ask phrasing that does *not*
   restate manifest fields (no `type`, `framework`, capability names, or lifecycle), so
   the model learns to *infer* platform detail rather than transliterate. A few carry a
   light framework hint (e.g. "the Angular team owns this") to teach conditioning.
2. **Synthetic** — real structural skeletons "reskinned" onto a 58-domain bank across
   verticals (commerce, finance, health, logistics, travel, media, HR, IoT, …), with
   `framework` (react/angular), `language` (ts/js), and `type` (remote/feature/service)
   varied. **Every candidate is gated by `validateFull`** — the set is schema-valid by
   construction. Synthetic manifests use lean platform caps (lifecycle is optional) to
   stay compact. A diversity cap (one pair per `caps|framework|language|type` key) forces
   spread over domains rather than near-identical repeats.
   Synthetic **intents** are composed from a per-domain `noun` + business `why`
   (hand-authored in `EXTRAS`) and a bank of mixed-voice templates (PM one-liner, user
   story, Slack ask, stakeholder request). The realism guardrail is **enforced**: the
   generator counts and fails on any intent that leaks a capability name, never states the
   MFE `type`, and carries a framework signal on ~30% (reported as `synth_realism` in
   `stats.json`).
3. **Data-BFF lane** (~120) — validator-gated `data:` blocks across four complexity tiers
   (A single minimal source → D multi-source with per-source + top-level `transforms`,
   `plugins`, `serve`, `mockSwitch`, `generatedFrom`). `source` is just a string, so
   plausible spec paths validate without real files; transform/plugin keys stay on the
   correct side of the `KNOWN_TRANSFORMS`/`KNOWN_PLUGINS` split. Intents signal the
   backend/join (and mock/cache) naturally — `data_signal_frac` in `stats.json`.
4. **Slot-provider lane** (~40) — validator-gated `providesSlots` with valid dot-segment
   ids (including `{param}` placeholders), host/shell-flavored intents.

`stats.json` reports the mix as `shape_pairs: { plain, data, slot, seed }`.

Regenerate (after `npm run build:packages`):

```
node docs/corpus/intent-manifest/generate.mjs
```

It **exits non-zero** unless ≥660 pairs (with ≥120 data and ≥40 slot), 0 capability-name
leaks, prompt mean <200 tok, completion mean <400 tok, and record-level near-dup <5%. Redundancy is measured per *record* (prompt + normalized
completion): the same manifest paired with different intents is intentional
phrase-robustness augmentation, not a duplicate.

## Into the coder adaptor

Copy `train.jsonl`, `valid.jsonl`, `eval.jsonl` into
`coder/adaptors/intent-manifest/data/` (spec §1). The adaptor's eval suite uses the same
oracle this corpus is gated by — `@seans-mfe/dsl` `validateFull` / `parseAndValidateDirectory`.

## Honest limits

- The **synthetic majority (597/660) is templated.** A refinement pass gave it mixed
  voice, per-domain business context, and a leak-guarded guardrail, so it reads far more
  naturally than raw Mad-Libs — but it is still generated from ~10 templates, not authored
  per example. The next lift is a per-example LLM rewrite for maximum phrasing diversity.
- **Data / slot realism:** the synthetic `data:` and `providesSlots` shapes are
  structurally valid and validator-gated, but their *contents* are plausible placeholders —
  `source` paths point at `./specs/*.yaml` files that don't exist, and slot ids are generic.
  They teach the model the shape and when to emit it, not real mesh wiring. The real seeds
  remain the ground truth for genuine BFF/slot semantics.
- Synthetic manifests omit `dependencies` and use minimal lifecycle — valid, but simpler
  than a hand-written MFE. Coder's own `data deduplicate|validate` can be run over
  `pairs.jsonl` as a second pass before training.
