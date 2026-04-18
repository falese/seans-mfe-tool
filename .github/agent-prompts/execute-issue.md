# Execute Issue — Claude Code Session Prompt

Paste this prompt into a fresh Claude Code session. Substitute `$ISSUE` with the target issue number (e.g., `92`).

---

You are executing GitHub issue **#$ISSUE** in `falese/seans-mfe-tool`. Your output is a single PR that satisfies every acceptance criterion in the issue.

## Required reads — in this order, before writing any code

1. `CLAUDE.md` (repo root) — migration context and locked decisions.
2. `.github/copilot-instructions.md` — baseline repo conventions.
3. `docs/agent-plans/oclif-migration.md` — the parent plan.
4. The issue itself: use `mcp__github__issue_read` for issue #$ISSUE.
5. Every issue listed under the issue's **Blocked by** section: use `mcp__github__issue_read`. **If any blocker is still open, stop and report — do not proceed.**
6. Every file listed under the issue's **Files** section.

## Pre-flight

- Confirm you are on `main` with a clean working tree.
- Create branch `claude/issue-$ISSUE-<short-slug>`.
- Run `npm install`, `npm run lint`, `npm run typecheck`, `npm test` to establish a green baseline. If baseline is red, stop and report.

## Implementation loop

For each acceptance criterion:

1. Write or update a test that encodes the criterion.
2. Make the smallest change that turns the test green.
3. Run `npm test -- <focused path>` to confirm.
4. Move to the next criterion.

Prefer editing existing files over creating new ones. Use utilities the repo already has — check `src/runtime/`, `src/utils/`, `src/oclif/` before adding helpers.

## Full verification before push

Run in order; do not push if any fail:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test` (or `npm run test:ci` if you touched `src/runtime/`)
4. `npm run build`
5. Post-B5 issues: `npm run build:schemas && git diff --exit-code schemas/`

## Commits

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Every commit body ends with `Refs #$ISSUE`.
- The final commit of the PR ends with `Closes #$ISSUE`.
- No `--no-verify`, no `--amend` on pushed commits.

## PR body template

```markdown
Closes #$ISSUE

## What changed
- <bulleted summary>

## Acceptance criteria verification
- [ ] <criterion 1> — verified by: <test name or command>
- [ ] <criterion 2> — ...

## Verification gates
- [ ] npm run lint
- [ ] npm run typecheck
- [ ] npm test
- [ ] npm run build
- [ ] npm run build:schemas (if applicable)

## Files touched
- <list>

## Decisions and deviations
<None, or note any with reasoning>
```

## Safety rails — non-negotiable

- Do not edit the following files unless this issue explicitly owns them (these are touched by multiple in-flight issues — check for open PRs first):
  - `package.json` `oclif` section — modified by A1, A7, A8, A9, A10.
  - `src/oclif/BaseCommand.ts` — modified by A2, B2, then moved in C3.
  - `src/oclif/envelope.ts` — created in B1, moved in C1.
  - `src/commands/**/*.ts` — B3, B4, B8 touch all of them.
  - `schemas/` — generated only; never hand-edit.
  - `pnpm-workspace.yaml`, `turbo.json` — only C1, C3, C6 touch these.
- Do not skip hooks (`--no-verify`, `--no-gpg-sign`).
- Do not `git push --force` to `main`, ever.
- Do not add dependencies beyond what the issue enumerates. If a dep is required and not listed, stop and ask the user.
- Do not delete `.github/copilot-instructions.md` or existing ADRs.
- Do not hand-edit `schemas/` — regenerate via `npm run build:schemas`.
- If a test fails in a way that reveals an unrelated pre-existing bug, DO NOT fix it here. Open a follow-up issue and link it from the PR body.

## When to stop and ask the user

Stop and surface the question rather than guessing:

- An acceptance criterion is ambiguous.
- A blocker issue is still open.
- Another open PR already touches the same file.
- You need to deviate from a locked decision in `CLAUDE.md`.
- A required file or tool is missing from the environment.

## Tooling hints for Claude Code

- For broad codebase exploration, use the `Explore` subagent — don't saturate the main context.
- Use `Grep`/`Glob` for targeted lookups; prefer over shelling out to `grep`/`find`.
- Use `mcp__github__issue_read` and `mcp__github__add_issue_comment` for GitHub interaction — do not shell out to `gh`.
