---
id: 0094
title: >-
  The generator is a library — it returns diagnostics instead of printing, and receives file
  contributions instead of reaching across packages for them
status: Implemented
date: 2026-09-11
deciders: [sean]
area: Codegen / packaging / DX
enforcement: code
tags: [codegen, plugins, dx, packaging, diagnostics]
relates-to: [18, 22, 27, 77, 82, 93]
supersedes: []
superseded-by: []
implements-pdr: [1, 4]
implemented-by:
  - packages/codegen/src/file-plan.ts
  - packages/codegen/src/contributors.ts
  - packages/codegen/src/manifest-validation.ts
  - packages/codegen/src/unified-generator.ts
  - packages/plugin-bff/src/codegen.ts
  - src/commands/remote/generate.ts
  - eslint.config.js
verified-by:
  - packages/codegen/src/__tests__/diagnostics.test.ts
  - src/__tests__/package-templates-shipped.test.ts
  - build:codegen-snapshot:check
tracked-by: []
summary: >-
  @seans-mfe/codegen stops writing to stdout and stderr and returns a GeneratorDiagnostic[] on
  its result instead, with no-console enforced across the three extraction packages; and it
  stops resolving another package's templates by relative path, accepting FileContributors that
  bring their own template root — which is how the BFF's eleven specs moved into
  @seans-mfe/plugin-bff and the codegen↔plugin-bff cycle disappeared.
rationale-summary: >-
  Both halves are the same property: a library does not reach out of itself, in either
  direction — printing reaches out to a stream it does not own, and a relative path into a
  sibling package reaches out to a filesystem layout it cannot guarantee; each worked only
  because everything so far has run from a monorepo checkout, and each broke the moment the
  package was published or embedded.
long-form: true
---

## Context

Two defects with one shape, both invisible from inside the repository.

**The generator printed.** Eight `console.*` calls in `@seans-mfe/codegen` —
missing-template warnings, a `Preserved (already implemented)` line, and
manifest validation's emoji headings plus a `✅ Manifest validation passed`
summary on every successful run. Consequences, in order of how much they cost:

- Under `--json` stdout must carry exactly one `CommandResult` line (ADR-018).
  A library writing to it corrupts the envelope.
- Every consumer had to muzzle it. `scripts/codegen-characterization.ts` saves
  and restores three console methods for no reason except this.
- It duplicated output the CLI already produced. `remote:generate` renders
  `preservedCapabilities` from the returned value, so a run that preserved
  anything printed the line twice — visible in the `--force` end-to-end check
  during ADR-091's work and mistaken for cosmetic noise at the time.

**The generator reached into a sibling package.** `renderFiles` resolved
`../../../packages/plugin-bff/templates` to emit BFF files. That escaped
codegen's package root, was undeclared in its `package.json`, and pointed at a
package that depends on codegen — a cycle npm cannot see. A published
`@seans-mfe/codegen` could not generate a BFF at all, and a published
`@seans-mfe/plugin-bff` could not either, because it omitted `templates` from
its `files` array (`npm pack` produced a tarball with zero template files).

The second was originally filed as *"move the BFF templates into codegen"*.
That was wrong: BFF is a plugin (PDR-004, ADR-022), and moving its templates
into core would have fixed a packaging symptom by contradicting the
architecture. The cause was that a plugin had no way to contribute to the
generation plan — the same cause as the framework branches ADR-093 removed.
ADR-093 built the plan; this uses it.

## Decision

### 1. The generator reports; the caller renders

`GenerateAllFilesResult` carries `diagnostics: GeneratorDiagnostic[]` —
`{ severity, code, message, target?, fix? }`, the same shape wherever it comes
from, so a caller renders one list rather than learning three conventions.
`validateManifestConfiguration` returns `{ ok, diagnostics }` rather than
printing and throwing.

**Reporting differently is not permitting.** `generateAllFiles` still throws
`ValidationError` when configuration validation fails. ADR-027's point stands:
generating from a misclassified manifest and discovering it at runtime inside
a container is the outcome worth preventing.

`no-console` is `error` for `packages/{contracts,dsl,codegen}/src/**` —
verified by planting a `console.log` and watching lint fail.

### 2. A plugin contributes files; core does not fetch them

A `FileContributor` is `{ id, templateRoot, specs }`. `templateRoot` is
absolute and resolved **inside the contributing package**, so the generator
never needs to know where that package lives. Registration is a side effect of
importing the contributor's module, so a host opts in with one import rather
than threading a parameter through seven call sites.

The BFF's eleven specs — including `.meshrc.yaml`, because Mesh configuration
is the BFF's domain and composing it there is what stops core knowing about
Mesh at all — now live in `packages/plugin-bff/src/codegen.ts`. No file under
`packages/codegen/src/` names `plugin-bff` in code.

**A caller that forgets to register fails loudly.** `check:mfe-drift` compares
against a maximal generation, so files a missing contributor would have
produced surface as orphaned rather than silently vanishing.

### 3. The escape allow-list must shrink when the escape does

`src/__tests__/package-templates-shipped.test.ts` asserts that every package
carrying `templates/` ships it, and that no runtime template resolution names
another package by path. Its `KNOWN_ESCAPES` list is paired with a second test
asserting **every entry still escapes**, so an exception cannot outlive the
defect it excused. That pair did its job on first use: when §2 removed the
escape, the honesty test failed on the now-stale allowance and forced its
deletion. The list is empty.

## Boundaries

**This closes a boundary ADR-093 declared open.** ADR-093's Boundaries section
says *"The BFF path escape is still there"* and describes the specs as living
in `codegen/src/variants/shared.ts`. That was accurate when written and was
resolved by §2 here, in the same phase. ADR-093 is left as written, per the
rule that decision records are not edited after the fact; this is the
correction.

**Sections of ADR-093 cited as "§6" mean §2 of this ADR.** Code comments
written during the work referenced a section number ADR-093 does not have —
the contributor mechanism was implemented before it was recorded. The
citations now point here.

**Three codegen tests reach across the monorepo.** `cross-framework-contract`,
`generated-typed-errors` and `unified-generator` assert BFF output and
register the contribution by relative path into `plugin-bff/src`. The escape
gate permits it (it scans `src/`, not `__tests__/`), but it is a test-graph
cycle. The tidier end state is those cases living in `plugin-bff` beside the
specs they cover.

**Diagnostics are not yet in the JSON envelope.** `remote:generate` renders
them to the terminal; `RemoteGenerateResult` does not carry them, so an agent
over MCP still sees only files, skips and errors. Adding the field changes a
published schema and is a separate decision.

**`dsl` and `contracts` were already silent.** The `no-console` rule covers
all three packages, but only `codegen` had anything to remove.

## Consequences

**Better.** `@seans-mfe/codegen` can be embedded: it writes nothing, and its
consumers stop muzzling it. The duplicate `Preserved` line is gone. The
package cycle is gone, and both packages can now be published and actually
work — which was the single thing most likely to break on day one of
extraction. A capability plugin has a supported way to add generated files,
which is the mechanism the marketplace ambition needs.

**Worse.** Generation now depends on a registration that is easy to omit: six
call sites carry a side-effect import, and a seventh added later would silently
generate no BFF until the drift gate caught it. Side-effect imports are also
the kind of line a well-meaning tidy-up deletes, since nothing in the file
appears to use it — the comment on each one says so, which is weaker than a
type would be. And diagnostics returned but not rendered by some caller are
diagnostics nobody reads; the CLI renders them, the MCP path does not yet.

**The trade-off accepted.** Registration by import over an explicit
`contributors` parameter. The parameter would be type-safe and impossible to
forget, at the cost of threading it through seven call sites including three
CI gates — and a gate that forgets fails loudly here anyway, which makes the
safer-looking option mostly ceremony.

## References

- ADR-018 — the JSON envelope reserves stdout for one `CommandResult` line;
  §1 is what stops a library corrupting it.
- ADR-022 — plugin-first architecture; §2 is why the BFF's templates stayed in
  the plugin rather than moving into core.
- ADR-027 — the Mesh plugin/transform split whose validation §1 changes from
  printing to returning, without changing that it refuses.
- ADR-082 — the platform reports what it cannot fix; the same posture applied
  to the generator's own findings.
- ADR-093 — made the emit set a list of file specs; this adds the contributor
  that lets something outside the package supply some of them.
