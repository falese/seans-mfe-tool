/**
 * Posts a one-time comment on each migration issue (#90–#115) linking to the
 * session prompt. Idempotent: skips issues that already have the marker comment.
 *
 * Auth: relies on GH_TOKEN or GITHUB_TOKEN in env with `issues:write` scope on
 * falese/seans-mfe-tool.
 */
import { Octokit } from "@octokit/rest";

const OWNER = "falese";
const REPO = "seans-mfe-tool";
const START = 90;
const END = 115;
const MARKER = "<!-- agent-prompt-link -->";
const PROMPT_PATH = ".github/agent-prompts/execute-issue.md";

async function main() {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Set GH_TOKEN or GITHUB_TOKEN");
  const octokit = new Octokit({ auth: token });

  for (let n = START; n <= END; n++) {
    const { data: comments } = await octokit.issues.listComments({
      owner: OWNER, repo: REPO, issue_number: n, per_page: 100,
    });
    if (comments.some(c => c.body?.includes(MARKER))) {
      console.log(`#${n} already linked; skipping.`);
      continue;
    }
    const body = [
      MARKER,
      `## Execute this issue with Claude Code`,
      ``,
      `Start a Claude Code session with the prompt at [\`${PROMPT_PATH}\`](https://github.com/${OWNER}/${REPO}/blob/main/${PROMPT_PATH}) and substitute \`$ISSUE=${n}\`.`,
      ``,
      `Required reads (enforced by the prompt): \`CLAUDE.md\`, \`.github/copilot-instructions.md\`, \`docs/agent-plans/oclif-migration.md\`, this issue, and any issues under "Blocked by".`,
    ].join("\n");
    await octokit.issues.createComment({
      owner: OWNER, repo: REPO, issue_number: n, body,
    });
    console.log(`Posted prompt link on #${n}.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
