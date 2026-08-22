/**
 * `buildProduction` must turn a real failure into classified errors.
 *
 * Two regressions this pins, both of which shipped:
 *   1. The catch block read only `err.stderr`. rspack and tsc write
 *      diagnostics to STDOUT, so `stderr` was '' and every failing build
 *      reported one error with an empty message.
 *   2. Nothing classified. Every error was `category: 'unknown'` with no
 *      file, line, or suggestion.
 *
 * Refs #139 · #148 · ADR-036
 */

import { ReactRspackPlugin } from '../plugin';

jest.mock('child_process', () => ({ execSync: jest.fn() }));

const { execSync } = require('child_process') as { execSync: jest.Mock };

/** An execSync failure, shaped the way Node actually shapes it. */
function execFailure({ stdout = '', stderr = '' }): Error {
  const err = new Error('Command failed') as Error & {
    stdout: string;
    stderr: string;
    status: number;
  };
  err.stdout = stdout;
  err.stderr = stderr;
  err.status = 1;
  return err;
}

const plugin = new ReactRspackPlugin();
const opts = { cwd: '/project', outputDir: '/project/dist' };

beforeEach(() => jest.clearAllMocks());

describe('buildProduction failure reporting', () => {
  it('reads diagnostics from stdout — where the toolchain actually writes them', async () => {
    execSync.mockImplementation(() => {
      throw execFailure({
        stdout: "src/a.ts(3,15): error TS2339: Property 'gapY' does not exist on type 'Pipe'.",
        stderr: '',
      });
    });

    const result = await plugin.buildProduction({}, opts);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      file: 'src/a.ts',
      line: 3,
      column: 15,
      code: 'TS2339',
      category: 'type',
    });
    expect(result.errors[0].message).not.toBe('');
  });

  it('classifies an unresolved module and suggests the install', async () => {
    execSync.mockImplementation(() => {
      throw execFailure({
        stdout: [
          'ERROR in ./src/index.js 2:1-26',
          "  × Module not found: Can't resolve 'react' in '/project/src'",
          '',
          'Rspack compiled with 1 error in 24 ms',
        ].join('\n'),
      });
    });

    const [error] = (await plugin.buildProduction({}, opts)).errors;

    expect(error.category).toBe('dependency');
    expect(error.file).toBe('./src/index.js');
    expect(error.suggestion).toBe('Install the package: npm install react');
  });

  it('still reports something when stderr is the only populated stream', async () => {
    execSync.mockImplementation(() => {
      throw execFailure({ stdout: '', stderr: 'ERROR in ./src/x.js\n  × Module parse failed:\n' });
    });

    const { errors } = await plugin.buildProduction({}, opts);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).not.toBe('');
  });

  it('never reports a failure with no errors, or an error with an empty message', async () => {
    // The exact shipped bug: stdout and stderr both empty. Reporting
    // success:false with errors:[] would say "it broke" and nothing else.
    execSync.mockImplementation(() => {
      throw execFailure({ stdout: '', stderr: '' });
    });

    const { errors, success } = await plugin.buildProduction({}, opts);
    expect(success).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(error.message.trim()).not.toBe('');
  });

  it('reports success with no errors when the build passes', async () => {
    execSync.mockImplementation(() => 'Rspack compiled successfully in 412 ms');

    const result = await plugin.buildProduction({}, opts);
    expect(result).toMatchObject({ success: true, errors: [] });
    expect(result.artifacts).toEqual([opts.outputDir]);
  });
});
