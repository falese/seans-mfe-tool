# `@seans-mfe/plugin-adr`

ADR library governance: the frontmatter schema, the drift rules, and the
`adr:validate` / `adr:status` commands.

## Why this is a plugin

ADR-075 put the decision record itself under drift control — frontmatter is the
single source of truth, the spec index and PDR↔ADR map are generated views under
a diff gate, and a rule set makes stale cross-references, one-way supersessions
and free-text statuses unrepresentable rather than merely noticeable.

None of that is about micro-frontends. It lived in the platform because that is
where it was written, not because it belonged there: the schema and rules sat in
`@seans-mfe/dsl`, the package that defines the **MFE manifest language**, where
only ADR tooling ever imported them.

## Use

```bash
seans-mfe-tool adr:validate            # gate the library; non-zero on any problem
seans-mfe-tool adr:status --json       # lifecycle rollup and outstanding decisions
```

This repo wires them as `npm run check:adr` and `npm run build:adr-index`. Those
wrappers stay in `scripts/` because they hardcode this repo's layout
(`docs/architecture-decisions`, `docs/spec.md`) — the same split as
`check-mfe-consistency.ts`, which is CI wiring around `mfe:validate` rather than
a second copy of it.

## The rules

| Rule | What it makes impossible |
|---|---|
| `implemented-by-exists` | An ADR claiming evidence that is not in the repo |
| `implemented-claims-evidence` | An `Implemented` ADR with nothing backing the claim |
| `code-cites-ratified-adr` | Code citing a Proposed or Superseded decision |
| `register-complete` | An ADR missing from the generated index |
| `accepted-work-is-tracked` | Accepted work with no issue reference |
| `finished-work-says-so` | Shipped work still marked deferred |

Every one of them fired during this plugin's own extraction: moving
`adr-schema.ts` and `adr-validation.ts` broke four of ADR-075's own
`implemented-by` and `verified-by` paths, and `check:adr` named all four.
