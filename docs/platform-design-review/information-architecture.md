# Information Architecture Redesign & Canonical TOC

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#218)
**Depends on:** #217 (Documentation Gap Matrix)

This document defines the target information architecture (IA) for SMT documentation: a canonical top-level navigation, a merge/split/deprecate plan for existing files, a source-of-truth ownership map, and naming + cross-reference standards.

---

## 1. Problems this IA solves

From the [Gap Matrix](./documentation-gap-matrix.md) (G16–G19, G31, G35):

- `docs/README.md` documents an "Agent System", not a docs index — the natural entry point misleads readers.
- There is no canonical TOC; readers discover docs by `find`.
- No ownership map → the same fact (e.g. project status) appears in multiple files and drifts.
- No naming/numbering or cross-reference standard.
- `archive/` content is still linked from active docs.

---

## 2. Canonical top-level navigation (TOC)

The intended reader-facing structure. Bold entries are **canonical** (single source of truth for their topic); others are supporting.

```
docs/
├── README.md ........................ Canonical docs index + this TOC  (RENAME/REPURPOSE)
│
├── 1. Start here
│   ├── ../README.md ................. Project overview + quick start (root)
│   ├── PROJECT-STATUS.md ............ ★ Canonical: what's shipped/active/deferred
│   └── platform-design-review/ ...... ★ Architecture review program (this set)
│       ├── README.md ................ Program index
│       ├── executive-architecture-narrative.md
│       ├── architecture-pillar-model.md
│       ├── ai-native-readiness-scorecard.md
│       ├── documentation-gap-matrix.md
│       ├── information-architecture.md  (this file)
│       ├── contract-alignment-pass.md
│       ├── execution-roadmap-90-day.md
│       ├── communication-pack.md
│       └── governance-checklist-and-rubric.md
│
├── 2. Architecture (the "what" and "how")
│   ├── architecture-current-state.md  ★ Canonical: system architecture
│   ├── architecture-runtime-platform.md
│   ├── architecture-codegen.md ...... (TO AUTHOR — G01)
│   ├── architecture-dsl.md .......... (TO AUTHOR — G02)
│   ├── architecture-bff.md .......... (TO AUTHOR — G03)
│   └── architecture-api-generator.md  (TO AUTHOR — G04)
│
├── 3. Contracts & references (the integration surface)
│   ├── ../PLATFORM-CONTRACT.md ...... ★ Canonical: 10-capability runtime contract
│   ├── ../PLUGIN-CONTRACT.md ........ ★ Canonical: third-party plugin contract
│   ├── DSL/dsl-schema-reference.md .. ★ Canonical: manifest schema
│   └── cli-contract.md .............. (TO AUTHOR — G05/G33; envelope + exit codes)
│
├── 4. Decisions (the "why")
│   ├── architecture-decisions/ ...... ★ Canonical: ADRs (register in README.md)
│   └── product-decisions/ ........... ★ Canonical: PDRs (register in README.md)
│
├── 5. Requirements & traceability
│   └── requirements/ ................ ★ Canonical: REQ-* + TRACEABILITY.md
│
├── 6. Guides & playbooks (the "how do I…")
│   ├── framework-plugin-authoring.md  ★ Canonical: author a framework plugin
│   ├── mcp-integration-playbook.md .. (TO AUTHOR — G09/#221)
│   ├── runtime-operational-runbook.md (TO AUTHOR — #220)
│   └── getting-started-shell-operator.md (TO AUTHOR — G27)
│
├── 7. Process & governance
│   ├── ../CLAUDE.md ................. ★ Canonical: coding conventions/agent guidance
│   └── platform-design-review/governance-checklist-and-rubric.md
│
└── archive/ ......................... Historical only — NOT linked from active docs (G35)
```

★ = single source of truth. "TO AUTHOR" = tracked in the Gap Matrix / roadmap.

---

## 3. Merge / split / deprecate map

| Action | Doc(s) | Plan | Gap |
|--------|--------|------|-----|
| **Repurpose** | `docs/README.md` | Convert from "Agent System" page into the canonical docs index/TOC above. Move agent-system content to `docs/archive/agent-system-design/` (where its companions already live). | G16 |
| **Author** | `architecture-codegen.md`, `architecture-dsl.md`, `architecture-bff.md`, `architecture-api-generator.md` | Replace the four "Coming Soon" stubs with real subsystem docs. | G01–G04 |
| **Author** | `cli-contract.md` | New canonical CLI contract reference (envelope, stdout/stderr, exit codes). | G05, G33 |
| **Author** | `mcp-integration-playbook.md`, `runtime-operational-runbook.md`, `getting-started-shell-operator.md` | New guides. | G09, #220, G27 |
| **Split** | Control-plane/daemon content (currently implicit in runtime) | Promote ADR-054–058 material into a dedicated `architecture-control-plane.md` (or a clearly delimited section). Decision: **split** once ≥2 control-plane capabilities ship. | G12 |
| **Merge** | Scattered status statements (root README, CLAUDE.md "Current state", architecture-current-state) | Keep dated summaries but make `PROJECT-STATUS.md` the single source; others link to it rather than restating. | G20, G32, G34 |
| **Deprecate** | `docs/archive/planning/*`, `docs/archive/sessions/*`, `docs/archive/tdd-reports/*` | Keep for history; add an archive banner; remove links to them from active docs. | G35 |
| **Reconcile** | `MERGE-PLAN.md` | Update phase statuses to match shipped work; link from PROJECT-STATUS Deferred section. | G34 |
| **Keep as-is** | ADRs, PDRs, requirements, acceptance-criteria, `PLATFORM-CONTRACT.md`, `PLUGIN-CONTRACT.md` | Canonical and healthy; only add a status dashboard for ADRs (G26). | G26 |

---

## 4. Source-of-truth ownership map

For each topic, exactly **one** canonical owner. Everything else links to it; restating a fact elsewhere is a review smell (enforced by the [Governance Rubric](./governance-checklist-and-rubric.md)).

| Topic / fact | Canonical source | Everyone else must… |
|---|---|---|
| What's shipped / active / deferred | `docs/PROJECT-STATUS.md` | link, not restate |
| System architecture (current) | `docs/architecture-current-state.md` | link |
| Runtime platform contract (10 capabilities) | `PLATFORM-CONTRACT.md` + ADR-041 | link |
| Lifecycle state machine | ADR-042 | link |
| CLI envelope + exit codes | `cli-contract.md` (to author) + ADR-018 | link |
| Manifest / DSL schema | `docs/DSL/dsl-schema-reference.md` + `src/dsl/schema.ts` | generate from schema, then link |
| Architectural decisions ("why technical") | `docs/architecture-decisions/` (register) | reference ADR-NNN |
| Product decisions ("why product") | `docs/product-decisions/` (register) | reference PDR-NNN |
| Requirements + traceability | `docs/requirements/` (`TRACEABILITY.md`) | reference REQ-* |
| Framework plugin authoring | `docs/framework-plugin-authoring.md` + ADR-036 | link |
| MCP operation | `docs/mcp-integration-playbook.md` (to author) | link |
| Coding conventions / agent rules | `CLAUDE.md` | link |
| Plugin contract | `PLUGIN-CONTRACT.md` | link |

---

## 5. Naming & cross-reference standards

### 5.1 File naming

- **ADRs:** `ADR-NNN-short-slug.md` (zero-padded 3-digit, kebab-case slug). New ADRs increment from the register; never reuse a number. *(Existing convention — formalized here.)*
- **PDRs:** `PDR-NNN-short-slug.md`.
- **Requirements:** `REQ-<AREA>-NNN` identifiers inside `docs/requirements/`; the area prefix (`RUNTIME`, `BFF`, `REMOTE`, `MESH-*`) is fixed per the existing sets.
- **Architecture docs:** `architecture-<subsystem>.md` (kebab-case subsystem).
- **Guides/playbooks:** `<topic>-<guide|playbook|runbook>.md`.
- **Program docs:** live under `docs/platform-design-review/` with kebab-case topic names.

### 5.2 Headings & front matter

- One H1 per file, matching the file's purpose.
- ADRs keep their YAML front matter (`id`, `title`, `status`, `date`, `deciders`, `tags`, …) — required for the ADR status dashboard (G26).
- Architecture/program docs start with a short context block (audience, "part of", "grounded in").

### 5.3 Cross-references

- **Internal links are relative** (`../PROJECT-STATUS.md`, `./architecture-pillar-model.md`) so they survive moves and work on GitHub.
- **Cite decisions by ID** (`ADR-018`, `PDR-003`, `REQ-RUNTIME-002`), linking to the file on first mention in a doc.
- **Cite code by path** (`packages/contracts/src/envelope.ts`), optionally `path:line`.
- **No links into `docs/archive/`** from active docs.
- A link is "dead" if its target doesn't exist; dead internal links fail the link audit (G15, #222).

### 5.4 Status vocabulary (shared)

Use a single vocabulary across docs and ADR front matter: `Proposed` → `Accepted` → `Implemented`; plus `Deferred` and `Superseded`. Mirror feature status with `📋 Planned` / `🟡 In Progress` / `✅ Complete` (as already used in PROJECT-STATUS).

---

## 6. Acceptance criteria mapping (#218)

| Acceptance criterion | Where satisfied |
|---|---|
| New docs TOC published | §2 Canonical top-level navigation |
| Merge/split/deprecate plan published | §3 |
| Source-of-truth ownership map published | §4 |
| Naming and cross-reference standards documented | §5 |
