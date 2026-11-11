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

  /**
   * A stand-in `npx` that logs each call's arguments. `--with-deps` succeeds on
   * attempt `depsOkAt` (never when 0); the plain browser install succeeds unless
   * `browserFails`.
   */
  function fakeNpx(depsOkAt: number, browserFails = false): { env: NodeJS.ProcessEnv; calls: () => string[]; done: () => void } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromium-'));
    const log = path.join(dir, 'calls');
    fs.writeFileSync(
      path.join(dir, 'npx'),
      `#!/usr/bin/env bash
echo "$*" >> "${log}"
if [[ "$*" == *--with-deps* ]]; then
  n=$(grep -c -- --with-deps "${log}")
  [ ${depsOkAt} -gt 0 ] && [ "$n" -ge ${depsOkAt} ]
else
  [ ${browserFails ? 1 : 0} -eq 0 ]
fi
`,
      { mode: 0o755 }
    );
    return {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, CHROMIUM_INSTALL_DELAY: '0', CHROMIUM_VERIFY: 'true' },
      calls: () => fs.readFileSync(log, 'utf8').trim().split('\n'),
      done: () => fs.rmSync(dir, { recursive: true, force: true }),
    };
  }

  it('retries the full install with system packages', () => {
    const npx = fakeNpx(3);
    execFileSync('bash', [SCRIPT], { env: npx.env, stdio: 'pipe' });
    expect(npx.calls()).toEqual(Array(3).fill('playwright install --with-deps chromium'));
    npx.done();
  });

  it('falls back to the browser alone when apt stays unreachable, and checks it launches', () => {
    // The packages --with-deps adds on a GitHub runner are fonts; the libraries Chromium needs
    // are already on the image, and no job compares screenshots.
    const npx = fakeNpx(0);
    const out = execFileSync('bash', [SCRIPT], { env: { ...npx.env, CHROMIUM_INSTALL_ATTEMPTS: '2' }, stdio: 'pipe' }).toString();
    expect(npx.calls()).toEqual(['playwright install --with-deps chromium', 'playwright install --with-deps chromium', 'playwright install chromium']);
    expect(out).toMatch(/::warning::.*without its system packages/);
    npx.done();
  });

  it('fails loudly when the browser itself cannot be installed or does not launch', () => {
    const noBrowser = fakeNpx(0, true);
    expect(() => execFileSync('bash', [SCRIPT], { env: { ...noBrowser.env, CHROMIUM_INSTALL_ATTEMPTS: '1' }, stdio: 'pipe' })).toThrow();
    noBrowser.done();
    const noLaunch = fakeNpx(0);
    expect(() => execFileSync('bash', [SCRIPT], { env: { ...noLaunch.env, CHROMIUM_INSTALL_ATTEMPTS: '1', CHROMIUM_VERIFY: 'false' }, stdio: 'pipe' })).toThrow();
    noLaunch.done();
  });
});
