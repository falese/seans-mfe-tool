# AI-Native Design Analysis & Readiness Scorecard

**Part of:** [Platform Design Review](./README.md) · DOCS-P1 (#214)
**Grounded in:** ADR-018, ADR-019, ADR-033 · [`README.md`](../../README.md) (MCP section) · `packages/contracts/src/envelope.ts`, `src/mcp/tool-registry.ts`, `src/commands/mcp/serve.ts`

> **AI-native** here means: the platform is designed so that an autonomous agent can operate it as a first-class user — not that it merely *uses* AI. The governing principle is ADR-033's "two-headed giant": one CLI serves an AI head and a human head without forking the tool surface.

---

## 1. Design analysis — the AI-native choices, with evidence

### 1.1 The CLI is the universal agent interface (ADR-033)

**Choice.** One CLI, two profiles. `--json --no-interactive` is the *agent profile*; colored prompts are the default *human profile*. The same commands work in both modes. Human-facing additions (`explain`, `system:map`, audit log, ownership markers) layer on without changing the agent profile.

**Why it's AI-native.** Agents operate in sandboxed, registry-blocked, TTY-less environments. Designing the agent profile as a first-class mode — rather than scraping human output — means the agent never has to interpret chalk-colored text or answer interactive prompts.

**Evidence.**
- ADR-033 `enforcer-config`: `cli-agent-profile-flags: [--json, --no-interactive, --dry-run]`; `exit-codes: [0, 2, 64, 65, 66, 69, 70, 77, 124]`; `ownership-markers: [GENERATED, DEVELOPER-OWNED]`.
- README documents `--json` on every command and `--dry-run` on every mutating command.

### 1.2 Structured output contract — `CommandResult<T>` (ADR-018)

**Choice.** Under `--json`, every command emits **exactly one** `CommandResult<T>` line on stdout; all progress/warnings/prompts go to stderr.

**Why it's AI-native.** An agent parses stdout with a single `JSON.parse()` — no regex, no partial-stream handling. The `success` flag plus typed `error.code`/`error.type` give the agent a branchable result without natural-language interpretation.

**Evidence.**
- `packages/contracts/src/envelope.ts` — `interface CommandResult<T> { success; data?; error?: { message; code; type }; meta?: { dryRun?; duration? } }`.
- ADR-018 rules enforced by `BaseCommand` (ADR-016): one `JSON.stringify(result)` line to stdout; `this.log`/`this.warn` to stderr even under `--json`.

### 1.3 Typed errors + sysexits exit codes (ADR-017, ADR-033)

**Choice.** No bare `throw new Error()`. Failures use `ValidationError` / `BusinessError` / `NetworkError` / `SystemError` / `TimeoutError` / `SecurityError`, mapped to sysexits-style exit codes.

**Why it's AI-native.** The agent can branch on *failure class* — retry a `NetworkError`, fix-and-retry a `ValidationError`, escalate a `SecurityError` — from the exit code or `error.type` alone, closing the "run → parse error → fix → re-run" loop without a human.

**Evidence.** `packages/contracts/src/errors/`, `packages/contracts/src/error-classifier.ts`; CLAUDE.md "Typed errors" constraint; ADR-033 exit-code set.

### 1.4 MCP child-process isolation (ADR-019)

**Choice.** Each MCP tool call spawns `seans-mfe-tool <cmd> --json` as a child process, parses stdout as `CommandResult<T>`, and maps it to the MCP response — never calling command logic in-process.

**Why it's AI-native.** It makes agent-initiated operations *safe and concurrent*: `process.exit` kills only the child, cwd mutations don't leak, and concurrent calls don't share oclif global state. The server always exercises the real CLI binary.

**Evidence.** `src/mcp/tool-registry.ts`, `src/commands/mcp/serve.ts`; ADR-019 consequences ("`process.exit()` kills only the child"; "each tool call fully isolated"). The spawned process inherits the *caller's* cwd so `remote:generate` runs in the agent's project dir.

### 1.5 Federated tool discovery

**Choice.** MCP tools come from three sources — local (`mfe:`, from bundled `schemas/*.json`), installed plugins (topic prefix, e.g. `daemon:`), and remote MCP servers (from `~/.config/seans-mfe/mcp.json`). Name collisions are a startup error.

**Why it's AI-native.** The agent's tool surface grows as the platform is extended, with no bespoke wiring; schemas are generated from command types so tool definitions don't drift from the CLI.

**Evidence.** README MCP section (three-source table, `mcp.json` example); `schemas/*.json` generated via `npm run build:schemas`.

### 1.6 Generation over hand-authoring + ownership markers (ADR-043, ADR-033)

**Choice.** The manifest is the source of truth; the CLI generates the project. Generated files carry `GENERATED` / `DEVELOPER-OWNED` markers.

**Why it's AI-native.** The agent can regenerate confidently and the human can audit exactly what the agent produced and where it is safe to take over — the "rationalize / take over / hand back" half of the two-headed model.

**Evidence.** ADR-043 pipeline; ADR-033 `ownership-markers`.

---

## 2. Weighted AI-Readiness Scorecard

Eight weighted dimensions. Each scored **0–5** against current `main`. **Weighted = (score/5) × weight.** Scores cite the evidence in §1.

| # | Dimension | Weight | Score (0–5) | Weighted | Evidence |
|---|---|:--:|:--:|:--:|---|
| D1 | Machine-readable output (single-line envelope) | 20% | 5 | 20.0% | ADR-018; `envelope.ts` |
| D2 | Structured, branchable errors + exit codes | 15% | 5 | 15.0% | ADR-017; `error-classifier.ts` |
| D3 | Non-interactive / sandbox operation (`--no-interactive`, `--dry-run`) | 15% | 5 | 15.0% | ADR-033 flags |
| D4 | Agent tool exposure (MCP server + isolation) | 15% | 4 | 12.0% | ADR-019; `tool-registry.ts` |
| D5 | Tool/schema discoverability (generated schemas, federation) | 10% | 4 | 8.0% | `schemas/*.json`; README MCP |
| D6 | Auditability for human takeover (ownership markers, `system:map`, audit log) | 10% | 2 | 4.0% | ADR-033 (`explain`/`system:map`/audit log are open enhancements #145–147) |
| D7 | Reproducibility / determinism of generation | 10% | 3 | 6.0% | ADR-043, ADR-011; codegen docs thin (Pillar 3) |
| D8 | Agent-facing documentation (playbooks, examples) | 5% | 2 | 1.0% | MCP playbook is open (#221); few agent examples |
| | **Total** | **100%** | | **81.0%** | |

**Overall AI-readiness: 81 / 100.**

**Reading the score.** The *contract* dimensions an agent depends on most (D1–D3, 50% of weight) are at ceiling — this is the platform's genuine strength. The drag is on **auditability for human takeover (D6)** and **agent-facing docs/examples (D8)**: the *mechanisms* exist or are specified, but the human-takeover affordances (`explain`, `system:map`, audit log) are still open feature issues, and there is no consolidated agent playbook yet.

---

## 3. Maturity model — current / near-term / target

A staged model per dimension. "Near-term" = next 90 days (aligns with the [Execution Roadmap](./execution-roadmap-90-day.md)); "Target" = the intended end-state.

| Dimension | Current (main) | Near-term (≤90 days) | Target |
|---|---|---|---|
| **D1 Output envelope** | One-line `CommandResult<T>` on every command (ADR-018) | Add conformance test asserting single stdout line per command | Contract test in CI gate; documented in CLI reference |
| **D2 Typed errors** | Full taxonomy + exit codes (ADR-017) | Publish complete exit-code table for consumers (#219) | Versioned error-code catalog agents can pin to |
| **D3 Non-interactive** | `--json/--no-interactive/--dry-run` everywhere | Document dry-run side-effect semantics per command (#219) | Guaranteed pure `--dry-run` (no writes) verified by test |
| **D4 MCP exposure** | Child-process isolation, 3-source federation (ADR-019) | MCP operating playbook (#221); collision/config docs | Streaming/batch optimization; documented perf profile |
| **D5 Discoverability** | Generated `schemas/*.json`; federation | Document schema-generation + federation in playbook | Published tool catalog; schema drift gated in CI (already partially: `git diff schemas/`) |
| **D6 Auditability** | Ownership markers defined (ADR-033) | Land `explain` / `system:map` / audit-log issues (#145–147) | Full audit trail + system map as first-class agent/human handoff |
| **D7 Reproducibility** | Manifest-driven, GeneratedFrom traceability | Author `architecture-codegen.md` (Pillar 3, top doc gap) | Deterministic regeneration documented + snapshot-tested |
| **D8 Agent docs** | README MCP section; ADRs | MCP + plugin playbooks (#221); agent-flow examples | Cookbook of agent recipes mapping intents → tool calls |

**Maturity stage summary.**
- **Current stage: "Agent-operable core."** An agent can reliably scaffold, generate, build, and parse results today.
- **Near-term stage: "Agent-operable + human-auditable."** Closing D6/D8 makes the human-takeover loop first-class.
- **Target stage: "Self-describing platform."** Conformance-tested contracts + published catalogs + reproducibility guarantees mean agents can pin to versioned contracts and humans can audit any artifact without reading source.

---

## 4. What this proves vs. what remains to prove

**Proves (evidence-backed today):**
- The output, error, and non-interactive contracts an agent depends on are implemented and enforced in code (D1–D3).
- Agents can safely invoke the platform concurrently via isolated MCP tool calls (D4).

**Remains to prove:**
- The human-takeover affordances (`explain`, `system:map`, audit log) — specified in ADR-033, still open as #145–147 (D6).
- Reproducibility/determinism of generation at the doc + test level (D7) — gated on the codegen reference doc.
- An agent-facing playbook with worked recipes (D8, #221).

See the [Documentation Gap Matrix](./documentation-gap-matrix.md) for the doc-side items and the [Execution Roadmap](./execution-roadmap-90-day.md) for sequencing.
