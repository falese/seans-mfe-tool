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
| `pairs.jsonl` | The full corpus (500 pairs). |
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

Regenerate (after `npm run build:packages`):

```
node docs/corpus/intent-manifest/generate.mjs
```

It **exits non-zero** unless ≥500 pairs, prompt mean <200 tok, completion mean <400 tok,
and record-level near-dup <5%. Redundancy is measured per *record* (prompt + normalized
completion): the same manifest paired with different intents is intentional
phrase-robustness augmentation, not a duplicate.

## Into the coder adaptor

Copy `train.jsonl`, `valid.jsonl`, `eval.jsonl` into
`coder/adaptors/intent-manifest/data/` (spec §1). The adaptor's eval suite uses the same
oracle this corpus is gated by — `@seans-mfe/dsl` `validateFull` / `parseAndValidateDirectory`.

## Honest limits

- The **synthetic majority (437/500) is templated** — its intent realism is below the
  hand-authored 63-pair seed. It exists to reach coder's ≥500 bar; the first quality
  improvement is an LLM pass rewriting synthetic intents into more natural, varied asks
  (and adding under-represented shapes — `data:` BFF and slot-provider manifests, which
  the synthetic lane deliberately does **not** invent to avoid fabricating mesh configs;
  those patterns are represented only by the real seeds today).
- Synthetic manifests omit `dependencies` and use minimal lifecycle — valid, but simpler
  than a hand-written MFE. Coder's own `data deduplicate|validate` can be run over
  `pairs.jsonl` as a second pass before training.
