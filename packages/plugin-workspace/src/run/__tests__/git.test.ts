import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commitApproval } from '../git';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function repo(): { root: string; proposal: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'approve-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'Test');
  const proposal = path.join(root, 'ev', 'proposal');
  fs.mkdirSync(proposal, { recursive: true });
  fs.writeFileSync(path.join(proposal, 'decomposition.yaml'), 'version: 1\n');
  fs.writeFileSync(path.join(root, 'unrelated.txt'), 'not part of the proposal');
  return { root, proposal };
}

describe('commitApproval', () => {
  beforeEach(() => jest.useRealTimers());

  it('commits the proposal directory, and nothing else, naming who approved', async () => {
    const { root, proposal } = repo();
    const result = await commitApproval(proposal, 'sean');
    expect(result).toMatchObject({ committed: true });
    expect(git(root, 'log', '-1', '--format=%s')).toBe('decomposition: approved by sean');
    expect(git(root, 'show', '--name-only', '--format=', 'HEAD')).toBe('ev/proposal/decomposition.yaml');
    expect(git(root, 'status', '--porcelain')).toBe('?? unrelated.txt');
  });

  it('says why when there is nothing to commit, or no repository', async () => {
    const { proposal } = repo();
    await commitApproval(proposal, 'sean');
    expect(await commitApproval(proposal, 'sean')).toEqual({ committed: false, reason: 'nothing changed since the last commit' });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'no-repo-'));
    expect(await commitApproval(outside, 'sean')).toMatchObject({ committed: false, reason: expect.stringContaining('not in a git repository') });
  });

  it('says so when git ignores the proposal, rather than claiming nothing changed', async () => {
    const { root, proposal } = repo();
    fs.writeFileSync(path.join(root, '.gitignore'), 'ev/\n');
    expect(await commitApproval(proposal, 'sean')).toEqual({ committed: false, reason: 'git ignores the proposal directory — commit it by hand, or move it out of the ignored path' });
  });
});
