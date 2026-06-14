# Link Hygiene & Cross-Reference Standards

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#222)
**Builds on:** the naming + cross-reference rules in [Information Architecture](./information-architecture.md#5-naming--cross-reference-standards). This doc is the **normative standard** plus a verification approach.

Purpose: make every internal reference resolvable, every claim traceable to a single owner, and every doc explicit about whether it is *normative* (binding) or *informative* (explanatory).

---

## 1. Internal link standard (normative)

1. **All internal links are relative** to the linking file. Never absolute paths, never `https://github.com/...` URLs for files in this repo.
   - From `docs/architecture-current-state.md` to a requirement: `./requirements/orchestration-requirements.md`.
   - From `docs/platform-design-review/X.md` up to a root doc: `../PROJECT-STATUS.md`.
2. **Link only to files that exist.** A planned doc is **not** hyperlinked — write it as plain text with a tracking tag, e.g. `Code Generation Architecture _(Coming Soon — G01)_`. (A link to a non-existent file is a defect, not a placeholder.)
3. **No links into `docs/archive/`** from active docs. Reference archived material as plain text with its path, e.g. ``design archived at `docs/archive/.../file.md` ``.
4. **Cite decisions by ID on first mention** in a doc, then link once: `ADR-036` → `[ADR-036](../architecture-decisions/ADR-036-<slug>.md)`. Subsequent mentions use the bare ID.
5. **Cite code by path + line range**, not by link: `src/runtime/base-mfe.ts:872–886`. Line-anchored URLs rot; path+range is greppable and stable enough for review.
6. **Anchor links** use the GitHub-slug of the heading (`#5-naming--cross-reference-standards`). Verify anchors after renaming headings.

---

## 2. Normative vs. informative tagging (normative)

Every document (or major section) declares its **status** so readers know what is binding:

| Tag | Meaning | Who may change it |
|---|---|---|
| **Normative** | Binding contract/decision. Conformance is required. | Only via ADR/PDR or the owning canonical doc |
| **Informative** | Explanation, guidance, examples. Helps understanding; not binding. | Any doc PR following this standard |

**Convention:**
- ADRs, PDRs, `PLATFORM-CONTRACT.md`, the DSL schema, and `cli-contract.md` are **Normative**.
- Narratives, runbooks, playbooks, cookbooks, scorecards, and this design-review program are **Informative** — they *summarize* normative sources and must not contradict them.
- Put the tag in the doc header or per-section, e.g. `*This runbook is informative; the normative sources are ADR-041/042 and the cited code.*` (as done in the [Runtime Runbook](./runtime-operational-runbook.md)).
- When informative and normative disagree, **normative wins**, and the drift is logged in the [Contract Alignment Pass](./contract-alignment-pass.md).

---

## 3. Cross-reference rules for ADR / REQ / architecture docs (normative)

- **One canonical owner per fact** (see the [ownership map](./information-architecture.md#4-source-of-truth-ownership-map)). Other docs link to the owner; they do not restate the fact.
- **Decisions** → cite `ADR-NNN` / `PDR-NNN`; never paraphrase a decision's rationale, link it.
- **Requirements** → cite `REQ-<AREA>-NNN`; link to the requirement doc under `docs/requirements/`.
- **Status/maturity** → always defer to `PROJECT-STATUS.md`; do not assert "complete/in-progress" independently.
- **Bidirectional where it matters:** an ADR that supersedes another links both ways (`Supersedes ADR-0xx` / `Superseded by ADR-0yy`).

---

## 4. Link-hygiene verification approach

A tiered approach — start informational, graduate to a gate.

### Tier 1 — Local relative-link check (now)

A path-existence check over Markdown links (excluding `http(s)://` and pure `#anchors`). Reference implementation used during this program:

```bash
# For each .md file, resolve every Markdown link target and assert the file exists.
# Fails the list of (file, link, resolved-path) that don't resolve.
```

This program ran exactly this check and fixed the drift it found in `architecture-current-state.md`:
- `./runtime-requirements.md` → `./architecture-runtime-platform.md` (no such requirements file; runtime REQs are documented there)
- `./orchestration|graphql-bff|dsl-contract|dsl-remote-requirements.md` → `./requirements/…` (wrong directory)
- `.github/agents/architecture-governance-agent.md` → archived; delinked
- four `architecture-*.md` "Coming Soon" links → delinked to plain text + gap tag (G01–G04)

### Tier 2 — Anchor + decision-ID check (next)

- Validate intra-doc anchors resolve to real headings.
- Validate every `ADR-NNN`/`REQ-…` referenced exists in the register (`docs/architecture-decisions/README.md`, `docs/requirements/`).

### Tier 3 — CI gate (target)

- Wire Tier 1+2 into CI as a **non-blocking report** first (so authors see breakage), then promote to a **required check** once the active-doc set is clean. Tracked as a KPI ("Dead internal links = 0") in the [KPI framework](./documentation-kpi-framework.md) and the [governance rubric](./governance-checklist-and-rubric.md).

### What "verified" means per PR

The per-PR checklist (governance rubric §1) requires: relative links only, no links to missing/archived files, decisions cited by ID, and the Tier-1 check clean for changed files.

---

## 5. Quick reference card

| Do | Don't |
|---|---|
| `./requirements/foo.md` (relative) | `/docs/requirements/foo.md` (absolute) |
| Plain text for unwritten docs + `(G0x)` | `[Foo](./not-yet-written.md)` (link to a missing file) |
| `src/file.ts:120–140` for code | deep-link to a line on the git host |
| Cite `ADR-036` then link once | restate the ADR's decision in prose |
| Tag doc Normative/Informative | leave bindingness ambiguous |
| Reference archive as plain-text path | hyperlink into `docs/archive/` |

---

*This document is **Normative** for documentation authoring; it governs how other docs link and tag. It is enforced through the [Governance Checklist & Rubric](./governance-checklist-and-rubric.md).*
