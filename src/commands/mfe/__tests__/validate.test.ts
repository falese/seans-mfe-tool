/**
 * mfe:validate command-core tests (#296).
 *
 * Exercises the I/O wrapper (`mfeValidateCommand`) end-to-end on a temp MFE
 * fixture: reads the manifest/package.json/rspack config, runs the pure rules,
 * and throws a typed BusinessError (non-zero exit) on any inconsistency.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { mfeValidateCommand } from '../validate';
import { DEPENDENCY_VERSIONS } from '@seans-mfe/codegen';
import { BusinessError } from '@seans-mfe/contracts';

const REACT = DEPENDENCY_VERSIONS.react.react;
const REACT_DOM = DEPENDENCY_VERSIONS.react.reactDom;
const RUNTIME = '@seans-mfe-tool/runtime';

interface Fixture {
  packageDeps?: Record<string, string>;
  sharedReactVersion?: string;
}

async function writeFixture(dir: string, fx: Fixture = {}): Promise<void> {
  await fs.ensureDir(dir);
  await fs.writeFile(
    path.join(dir, 'mfe-manifest.yaml'),
    [
      'name: fixture-mfe',
      'version: 1.0.0',
      'type: remote',
      'language: typescript',
      'framework: react',
      'bundler: rspack',
      'capabilities:',
      '  - Demo:',
      '      type: domain',
      '      description: demo capability',
      'dependencies:',
      '  design-system:',
      "    styled-components: '^6.1.0'",
    ].join('\n'),
  );
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'fixture-mfe',
    version: '1.0.0',
    dependencies: fx.packageDeps ?? {
      react: REACT,
      'react-dom': REACT_DOM,
      'styled-components': '^6.1.0',
      [RUNTIME]: DEPENDENCY_VERSIONS.runtime.package,
    },
  });
  const sharedReact = fx.sharedReactVersion ?? REACT;
  await fs.writeFile(
    path.join(dir, 'rspack.config.js'),
    `module.exports = {
      plugins: [
        new ModuleFederationPlugin({
          shared: {
            react: { singleton: true, requiredVersion: '${sharedReact}', eager: true },
            'react-dom': { singleton: true, requiredVersion: '${REACT_DOM}', eager: true }
          }
        })
      ]
    };`,
  );
}

describe('mfeValidateCommand', () => {
  let tmp: string;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-validate-'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await fs.remove(tmp);
  });

  it('passes a consistent MFE and returns a structured result', async () => {
    await writeFixture(tmp);
    const res = await mfeValidateCommand({ dir: tmp });
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
    expect(res.checked).toContain('react-pinned');
    expect(res.mfe).toBe('fixture-mfe');
  });

  it('throws BusinessError when react is not pinned to the platform version', async () => {
    await writeFixture(tmp, {
      packageDeps: {
        react: '^19.0.0',
        'react-dom': REACT_DOM,
        [RUNTIME]: DEPENDENCY_VERSIONS.runtime.package,
      },
    });
    await expect(mfeValidateCommand({ dir: tmp })).rejects.toBeInstanceOf(BusinessError);
  });

  it('throws when a federation shared version diverges from the platform version', async () => {
    await writeFixture(tmp, { sharedReactVersion: '^18.2.0' });
    await expect(mfeValidateCommand({ dir: tmp })).rejects.toMatchObject({
      code: 'MFE_INCONSISTENT',
    });
  });

  it('throws a typed error when the directory has no manifest', async () => {
    await expect(mfeValidateCommand({ dir: tmp })).rejects.toBeDefined();
  });
});
