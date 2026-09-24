# Execute Issue — Claude Code Session Prompt

Paste this prompt into a fresh Claude Code session. Substitute `$ISSUE` with the target issue number (e.g., `92`).

---

You are executing GitHub issue **#$ISSUE** in `falese/seans-mfe-tool`. Your output is a single PR that satisfies every acceptance criterion in the issue.

## Required reads — in this order, before writing any code

1. `CLAUDE.md` (repo root) — project memory, locked decisions, architecture constraints.
2. `docs/spec.md` — full platform spec (CLI surface, codegen flow, runtime lifecycle, ADR index).
3. The issue itself: use `mcp__github__issue_read` for issue #$ISSUE.
4. Every issue listed under the issue's **Blocked by** section: use `mcp__github__issue_read`. **If any blocker is still open, stop and report — do not proceed.**
5. Every file listed under the issue's **Files** section.

## Pre-flight

- Confirm you are on `main` with a clean working tree.
- Create branch `claude/issue-$ISSUE-<short-slug>`.
- Run `npm install`, `npm run lint`, `npm run typecheck`, `npm test` to establish a green baseline. If baseline is red, stop and report.

## ADR check — before writing any code

Look up the acceptance criteria in the issue. For every decision the implementation will make (bundler integration, lifecycle change, new platform contract, BFF layer change, codegen variant):

1. Check `docs/architecture-decisions/` for a matching ADR.
2. If a relevant ADR exists: note it — you will reference it in commits and the PR body.
3. **If no ADR governs the decision: stop and ask the human before implementing.** Do not invent architecture. A new ADR must be written or the human must explicitly waive it.

## Implementation loop

For each acceptance criterion:

1. Write or update a test that encodes the criterion.
2. Make the smallest change that turns the test green.
3. Run `npm test -- <focused path>` to confirm.
4. Move to the next criterion.

Prefer editing existing files over creating new ones. Use utilities the repo already has — check `packages/runtime/src/`, `packages/oclif-base/src/` and `packages/contracts/src/` before adding helpers.

## Full verification before push

Run the gates in `CLAUDE.md` → **Verification gates before push**, in order; do not push if any fail. That list is the single source — it includes the conditional gates (drift, consistency, ADR index, API docs) this prompt used to omit.

## Commits

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Every commit body ends with `Refs #$ISSUE`.
- The final commit of the PR ends with `Closes #$ISSUE`.
- Reference governing ADRs in the commit body: `ADR-NNN`.
- No `--no-verify`, no `--amend` on pushed commits.

## PR body template

```markdown
Closes #$ISSUE

## What changed
- <bulleted summary>

## Acceptance criteria verification
- [ ] <criterion 1> — verified by: <test name or command>
- [ ] <criterion 2> — ...

## ADR references
- ADR-NNN: <title> — governs <area>
<!-- If no ADR governs a decision made in this PR, explain the waiver here -->

## Verification gates
- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm test
- [ ] npm run build
- [ ] conditional gates from CLAUDE.md that apply (list them)

## Files touched
- <list>

## Decisions and deviations
<None, or note any with reasoning and ADR reference>
```

## Safety rails — non-negotiable

- Do not edit `schemas/` by hand — regenerate via `npm run build:schemas`.
- Do not delete existing ADRs or `.github/copilot-instructions.md`.
- Do not `git push --force` to `main`.
- Do not skip hooks (`--no-verify`, `--no-gpg-sign`).
- Do not add dependencies beyond what the issue enumerates. If a dep is required and not listed, stop and ask.
- If a test fails in a way that reveals an unrelated pre-existing bug: do NOT fix it here. Open a follow-up issue and link it from the PR body.
- Never `throw new Error(...)` in command code — use typed errors from `@seans-mfe/contracts`.
- Never implement `run()` directly in an oclif command — implement `runCommand()` and let `BaseCommand.run()` own the envelope.

## When to stop and ask the user

Stop and surface the question rather than guessing:

- An acceptance criterion is ambiguous.
- A blocker issue is still open.
- Another open PR already touches the same file.
- You need to deviate from a locked decision in `CLAUDE.md`.
- A required file or tool is missing from the environment.
- **A decision is needed and no existing ADR governs it** — a new ADR must be written or the human must explicitly waive it before you proceed.
