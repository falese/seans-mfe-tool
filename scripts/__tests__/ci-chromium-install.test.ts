/**
 * CI installs Chromium for Playwright in one place, with retries.
 *
 * `npx playwright install --with-deps` fetches system packages with apt, and a
 * runner whose DNS briefly fails turns that into a red job with no test run —
 * three jobs on PR #480 at once. Every workflow goes through
 * scripts/ci/install-chromium.sh, which retries; a bare install would bring
 * the flake back.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const SCRIPT = path.join(ROOT, 'scripts', 'ci', 'install-chromium.sh');

describe('CI Chromium install', () => {
  const workflows = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

  it('is never a bare `playwright install` in a workflow', () => {
    const bare = workflows.filter((f) => /playwright install/.test(fs.readFileSync(path.join(WORKFLOWS, f), 'utf8')));
    expect(bare).toEqual([]);
  });

  it('goes through the retrying script in every job that drives a browser', () => {
    const using = workflows.filter((f) => fs.readFileSync(path.join(WORKFLOWS, f), 'utf8').includes('scripts/ci/install-chromium.sh'));
    expect(using.sort()).toEqual(['composition.yml', 'test.yml']);
    expect(fs.readFileSync(path.join(WORKFLOWS, 'test.yml'), 'utf8').match(/scripts\/ci\/install-chromium\.sh/g)).toHaveLength(2);
  });

  it('retries a failing install, then fails loudly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromium-'));
    // A stand-in `npx` that fails twice, then succeeds; counts its calls.
    const npx = path.join(dir, 'npx');
    fs.writeFileSync(npx, `#!/usr/bin/env bash\nn=$(cat "${dir}/n" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/n"; [ $n -ge 3 ]\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CHROMIUM_INSTALL_DELAY: '0' };
    execFileSync('bash', [SCRIPT], { env, stdio: 'pipe' });
    expect(fs.readFileSync(path.join(dir, 'n'), 'utf8').trim()).toBe('3');

    // Always failing: gives up after the attempts allowed, with a non-zero exit.
    fs.writeFileSync(path.join(dir, 'n'), '-100');
    expect(() => execFileSync('bash', [SCRIPT], { env: { ...env, CHROMIUM_INSTALL_ATTEMPTS: '2' }, stdio: 'pipe' })).toThrow();
    expect(fs.readFileSync(path.join(dir, 'n'), 'utf8').trim()).toBe('-98');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
