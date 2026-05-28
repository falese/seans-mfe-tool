---
id: 0043
title: Manifest-Driven Code Generation Pipeline
status: Accepted
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [codegen, dsl, manifest, pipeline, templates, single-source-of-truth]
summary: The `mfe-manifest.yaml` DSL is the single source of truth for a generated MFE. `remote:generate` runs one pipeline — parse/validate (Zod) → resolve the framework/bundler template variant → extract manifest variables → render EJS templates → write files — with no framework branching in the generator logic itself.
rationale-summary: Centralizing generation in one manifest-driven pipeline keeps "generate, don't hand-write" (PDR-001) enforceable: the manifest declares intent, variant selection is data, and adding a framework is a new template directory rather than new generator code.
long-form: true
---

# ADR-043: Manifest-Driven Code Generation Pipeline

## Context

Several accepted ADRs describe *aspects* of code generation — language →
template selection (ADR-009), `generatedFrom` traceability (ADR-011), test
templates (ADR-013), pluggable bundler/framework variants (ADR-034), framework
plugins (ADR-036), and manifest-declared handler sources (ADR-040). But the
**foundational decision** they all rest on has no ADR of record: that a single
declarative manifest drives one generation pipeline, and that the generator
contains no per-framework branching.

The decision is implemented in
`src/codegen/UnifiedGenerator/unified-generator.ts` and exercised by
`remote:generate` / `remote:generate:capability`, but a contributor reading
the ADR set finds the pieces without the spine. This ADR records the spine.

## Decision

The **`mfe-manifest.yaml` DSL is the single source of truth** for a generated
MFE. `remote:generate` runs exactly one pipeline (`docs/spec.md#codegen-flow`):

```
mfe-manifest.yaml
      │
      ├─ Parse & validate manifest (Zod schema, src/dsl/schema.ts)
      ├─ Resolve codegen variant — framework + bundler → template variant
      │     via loadFrameworkPlugin() (ADR-036)
      ├─ Extract manifest variables for template rendering
      ├─ Render EJS templates from src/codegen/templates/<variant>/
      └─ Write files (skip if unchanged; --force to overwrite; --dry-run to preview)
```

Three rules make the pipeline framework-agnostic:

1. **The manifest declares intent; the generator reads it.** `framework`,
   `bundler`, `language`, capabilities, lifecycle hooks, handler sources, and
   data sources are all manifest fields. The generator never hardcodes them —
   it extracts them into template variables (`getTemplateVariables`,
   `unified-generator.ts:364-446`).

2. **Variant selection is data, not branches.** `framework` + `bundler`
   resolve through `loadFrameworkPlugin()` to a `templateVariant`
   (`react-rspack`, `angular-webpack`, …) — `unified-generator.ts:412-436`.
   The generator picks a template directory; it does not contain
   `if (framework === 'react')` logic. Unknown framework/bundler values are a
   plugin-resolution concern (ADR-036, open `z.string()` schema), not a
   pipeline rewrite.

3. **Templates are the only framework-specific surface.** Framework-specific
   code lives entirely under `src/codegen/templates/<variant>/` as EJS
   (`renderTemplate`, `unified-generator.ts:476-481`). Adding Vue/Svelte/etc.
   means publishing a framework plugin and adding a template directory — never
   editing the generator (ADR-034, ADR-036).

The generated `do*()` bodies and lifecycle stubs fill the `BaseMFE` contract
(ADR-041); orchestration, state, and dispatch are inherited and never
regenerated. Idempotence is part of the contract: a second `remote:generate`
with an unchanged manifest is a no-op, and every generated file is traceable
back to the manifest via `generatedFrom` (ADR-011).

## Consequences

- "Generate, don't hand-write" (PDR-001) is enforceable: intent lives in one
  reviewable YAML file, and regeneration is deterministic and idempotent.
- Adding a framework is additive (a plugin + a template directory) and touches
  no generator logic — the property ADR-034/036 promise, made structural here.
- The manifest is the audit surface: capabilities, lifecycle, handler sources,
  and data sources are all declared in one place and traced into output.
- Hand-editing generated files is discouraged by design — the path back to
  source is the manifest, and `--force` regeneration will overwrite drift.
- Validation failures (Zod) surface as `ValidationError` at the pipeline
  boundary before any file is written, so a bad manifest never half-generates.

## Alternatives Considered

- **Per-framework generator classes** — rejected. Branching the generator by
  framework is exactly the coupling this ADR forbids; it would re-fragment the
  contract ADR-036 unified and make every new framework a core change.
- **Imperative scaffolding scripts (copy + string-replace)** — rejected. They
  drift from the manifest, are not idempotent, and lose `generatedFrom`
  traceability.
- **Manifest as bootstrap-only (generate once, then own the code)** — rejected
  as the default. It breaks the single-source-of-truth property; the manifest
  must remain the regenerable source (`overwrite: true` for generated files,
  per ADR-040's bootstrap discussion). Hand-owned escape hatches are explicit
  (`source:` handlers, `do*()` overrides), not the norm.

## Traceability

- PDR-001: Generate, don't hand-write
- ADR-009: Language Field and Template Selection
- ADR-011: GeneratedFrom Traceability
- ADR-013: Generated MFE Test Templates
- ADR-034: Pluggable bundler + framework via codegen variants
- ADR-036: Framework plugin system (`loadFrameworkPlugin()`)
- ADR-040: Manifest-Declared Handler Sources
- ADR-041: BaseMFE contract (the shape generated `do*()` bodies fill)
- Files:
  - `src/codegen/UnifiedGenerator/unified-generator.ts` — pipeline,
    variant resolution (`:412-436`), variable extraction (`:364-446`),
    `renderTemplate` (`:476-481`), file writes (`:485+`)
  - `src/dsl/schema.ts` / `src/dsl/parser.ts` — manifest validation
  - `src/commands/remote/generate.ts`, `generate/capability.ts` — entry points
  - `src/codegen/templates/<variant>/` — the only framework-specific surface
