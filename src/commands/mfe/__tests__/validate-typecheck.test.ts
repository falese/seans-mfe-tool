/**
 * mfe:validate --typecheck must check the tsconfig each framework's real build
 * actually reads (#281).
 *
 * Angular's app build reads `tsconfig.app.json` (see `angular.json`'s
 * `tsConfig`); the root `tsconfig.json` is the CommonJS config for the
 * generated Mesh BFF, not the app build. Checking only the root config would
 * have missed the DX punch-list #8 regression (a `"//"` comment key in
 * `tsconfig.app.json.ejs` that broke every fresh Angular build) even with
 * `--typecheck` on. `spawnSync` is mocked so this stays a fast, hermetic
 * assertion on which file gets passed to `tsc -p`, not a real compile.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { spawnSync } from 'child_process';

jest.mock('child_process');

const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

import { mfeValidateCommand } from '../validate';

async function writeMinimalManifest(dir: string, framework: string): Promise<void> {
  await fs.ensureDir(dir);
  await fs.writeFile(
    path.join(dir, 'mfe-manifest.yaml'),
    [
      'name: fixture-mfe',
      'version: 1.0.0',
      'type: remote',
      'language: typescript',
      `framework: ${framework}`,
      `bundler: ${framework === 'angular' ? 'webpack' : 'rspack'}`,
      'capabilities:',
      '  - Demo:',
      '      type: domain',
      '      description: demo capability',
    ].join('\n'),
  );
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'fixture-mfe',
    version: '1.0.0',
    dependencies: {},
  });
}

describe('mfeValidateCommand --typecheck (per-framework tsconfig)', () => {
  let tmp: string;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-validate-typecheck-'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockSpawnSync.mockReset();
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: '',
      stderr: '',
    } as ReturnType<typeof spawnSync>);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await fs.remove(tmp);
  });

  it('checks tsconfig.app.json for an Angular MFE, not the root tsconfig.json', async () => {
    await writeMinimalManifest(tmp, 'angular');
    await fs.writeFile(path.join(tmp, 'tsconfig.json'), '{"compilerOptions":{"module":"commonjs"}}');
    await fs.writeFile(path.join(tmp, 'tsconfig.app.json'), '{"extends":"./tsconfig.json"}');

    await mfeValidateCommand({ dir: tmp, typecheck: true }).catch(() => undefined);

    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    const [, args] = mockSpawnSync.mock.calls[0];
    expect(args).toEqual(['tsc', '--noEmit', '-p', 'tsconfig.app.json']);
  });

  it('falls back to tsconfig.json for Angular when no tsconfig.app.json exists', async () => {
    await writeMinimalManifest(tmp, 'angular');
    await fs.writeFile(path.join(tmp, 'tsconfig.json'), '{"compilerOptions":{}}');

    await mfeValidateCommand({ dir: tmp, typecheck: true }).catch(() => undefined);

    const [, args] = mockSpawnSync.mock.calls[0];
    expect(args).toEqual(['tsc', '--noEmit', '-p', 'tsconfig.json']);
  });

  it('checks the root tsconfig.json for a React MFE', async () => {
    await writeMinimalManifest(tmp, 'react');
    await fs.writeFile(path.join(tmp, 'tsconfig.json'), '{"compilerOptions":{}}');

    await mfeValidateCommand({ dir: tmp, typecheck: true }).catch(() => undefined);

    const [, args] = mockSpawnSync.mock.calls[0];
    expect(args).toEqual(['tsc', '--noEmit', '-p', 'tsconfig.json']);
  });

  it('does not run typecheck when no tsconfig exists', async () => {
    await writeMinimalManifest(tmp, 'react');

    const result = await mfeValidateCommand({ dir: tmp, typecheck: true }).catch((e) => e.details);

    expect(mockSpawnSync).not.toHaveBeenCalled();
    expect(result.typecheck).toEqual({ ran: false, ok: true });
  });
});
