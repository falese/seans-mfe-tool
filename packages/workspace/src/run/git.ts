/**
 * An approval lands on the proposal PR (ADR-116 §5): the proposal directory is
 * committed to whatever branch the repository is on, the proposal branch when
 * the workspace runs from one. Only that directory is staged, so nothing else
 * in the developer's working tree is swept in.
 */

import { execFile } from 'child_process';

export type CommitResult = { committed: true; commit: string } | { committed: false; reason: string };

function git(cwd: string, args: string[], env: Record<string, string>): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as NodeJS.ErrnoException & { code?: unknown }).code === 'number' ? Number((err as { code: number }).code) : 1) : 0;
      resolve({ code, out: `${stdout}${stderr}`.trim() });
    });
  });
}

/** `env` is merged into git's environment: the command's `TRACEPARENT` (ADR-081). */
export async function commitApproval(proposalDir: string, by: string, env: Record<string, string> = {}): Promise<CommitResult> {
  const inside = await git(proposalDir, ['rev-parse', '--is-inside-work-tree'], env);
  if (inside.code !== 0) return { committed: false, reason: `${proposalDir} is not in a git repository` };
  if ((await git(proposalDir, ['check-ignore', '-q', 'decomposition.yaml'], env)).code === 0) {
    return { committed: false, reason: 'git ignores the proposal directory — commit it by hand, or move it out of the ignored path' };
  }
  const add = await git(proposalDir, ['add', '-A', '--', '.'], env);
  if (add.code !== 0) return { committed: false, reason: `git add failed: ${add.out}` };
  const staged = await git(proposalDir, ['diff', '--cached', '--quiet', '--', '.'], env);
  if (staged.code === 0) return { committed: false, reason: 'nothing changed since the last commit' };
  const commit = await git(proposalDir, ['commit', '-q', '-m', `decomposition: approved by ${by}`, '--', '.'], env);
  if (commit.code !== 0) return { committed: false, reason: `git commit failed: ${commit.out}` };
  const head = await git(proposalDir, ['rev-parse', '--short', 'HEAD'], env);
  return { committed: true, commit: head.out };
}
