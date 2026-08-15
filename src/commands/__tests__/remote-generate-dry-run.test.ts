/**
 * `remote:generate --dry-run` describes what the writer will actually do (#340).
 *
 * The planner and the writer are separate code paths, and they disagreed. The
 * writer's rule (`unified-generator.ts`) has three cases:
 *
 *   !exists            → write it        (create)
 *   exists, overwrite  → re-stamp it     (overwrite)
 *   exists, !overwrite → **skip it**     ← developer-owned, never touched
 *
 * The planner derived the op from `overwrite` alone, so the third case was
 * announced as `create` — a dry run promising to create a file that exists,
 * that the developer owns, and that the writer will not touch. Meridian
 * punch-list item 21 fixed exactly this conflation for the post-run hint; this
 * is the same bug in the pre-run plan.
 *
 * These tests use **real files in a temp dir** rather than a mocked `fs`. The
 * defect was a missing existence check, so a test that stubs existence tests
 * nothing.
 */

import * as os from 'os';
import * as realFs from 'fs';
import * as realPath from 'path';

jest.mock('chalk', () => ({
  blue: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  gray: (s: string) => s,
  cyan: (s: string) => s,
}));

jest.mock('@falese/smt-dsl', () => ({
  parseAndValidateDirectory: jest.fn(),
  formatErrorsForCLI: jest.fn(() => ''),
}));

jest.mock('@falese/smt-codegen', () => {
  const actual = jest.requireActual('@falese/smt-codegen');
  return { ...actual, generateAllFiles: jest.fn(), writeGeneratedFiles: jest.fn() };
});

jest.mock('../../framework/loader', () => ({
  resolveFrameworkVariant: jest.fn(() => undefined),
}));

import { remoteGenerateCommand } from '../remote-generate';
import { parseAndValidateDirectory } from '@falese/smt-dsl';
import { generateAllFiles } from '@falese/smt-codegen';

const mockParse = parseAndValidateDirectory as jest.MockedFunction<typeof parseAndValidateDirectory>;
const mockGenerate = generateAllFiles as jest.MockedFunction<typeof generateAllFiles>;

describe('remote:generate --dry-run plans what the writer will do (#340)', () => {
  let tmp: string;
  let cwdSpy: jest.SpyInstance;

  const manifest = { name: 'plan-test', version: '1.0.0', capabilities: [] };

  /** Declare a generated file, optionally materialising it on disk first. */
  const file = (rel: string, overwrite: boolean, existsOnDisk: boolean) => {
    const full = realPath.join(tmp, rel);
    if (existsOnDisk) {
      realFs.mkdirSync(realPath.dirname(full), { recursive: true });
      realFs.writeFileSync(full, '// pre-existing content\n', 'utf8');
    }
    return { path: full, content: '// freshly generated\n', overwrite };
  };

  const planFor = async (
    files: Array<{ path: string; content: string; overwrite: boolean }>,
  ) => {
    mockGenerate.mockResolvedValue({ files, preservedCapabilities: [] } as never);
    const result = await remoteGenerateCommand({ dryRun: true });
    return result.plannedChanges ?? [];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tmp = realFs.mkdtempSync(realPath.join(os.tmpdir(), 'smt-dryrun-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmp);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockParse.mockResolvedValue({ valid: true, manifest, errors: [] } as never);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    jest.restoreAllMocks();
    realFs.rmSync(tmp, { recursive: true, force: true });
  });

  it('plans "skip" for a developer-owned file that already exists', async () => {
    // The regression. This is `src/index.tsx` in every MFE the drill touched.
    const plan = await planFor([file('src/index.tsx', false, true)]);

    expect(plan).toEqual([{ op: 'skip', target: 'src/index.tsx' }]);
  });

  it('plans "create" for the same file when it does not exist yet', async () => {
    // Ownership alone must not decide the op — first init genuinely creates it.
    const plan = await planFor([file('src/index.tsx', false, false)]);

    expect(plan).toEqual([{ op: 'create', target: 'src/index.tsx' }]);
  });

  it('plans "overwrite" for a generator-owned file that exists', async () => {
    const plan = await planFor([file('platform/base-mfe/mfe.ts', true, true)]);

    expect(plan).toEqual([{ op: 'overwrite', target: 'platform/base-mfe/mfe.ts' }]);
  });

  it('plans "create" for a generator-owned file that does not exist yet', async () => {
    const plan = await planFor([file('platform/base-mfe/mfe.ts', true, false)]);

    expect(plan).toEqual([{ op: 'create', target: 'platform/base-mfe/mfe.ts' }]);
  });

  it('classifies a realistic mixed run the way the writer would', async () => {
    const plan = await planFor([
      file('platform/base-mfe/mfe.ts', true, true), // re-stamped
      file('src/index.tsx', false, true), // yours — untouched
      file('src/App.tsx', false, false), // seeded now
      file('public/index.html', true, false), // new generated asset
    ]);

    expect(plan).toEqual([
      { op: 'overwrite', target: 'platform/base-mfe/mfe.ts' },
      { op: 'skip', target: 'src/index.tsx' },
      { op: 'create', target: 'src/App.tsx' },
      { op: 'create', target: 'public/index.html' },
    ]);
  });

  it('says "skip" in the human output too, not only the envelope', async () => {
    const logs: string[] = [];
    (console.log as jest.Mock).mockImplementation((...args: unknown[]) =>
      logs.push(args.join(' ')),
    );

    await planFor([file('src/index.tsx', false, true)]);

    const line = logs.find((l) => l.includes('src/index.tsx'));
    // `(new)` was the old label, and it was the visible half of the lie — the
    // human output is what a developer actually reads before deciding to run it.
    expect(line).toBeDefined();
    expect(line).not.toContain('(new)');
    expect(line).toMatch(/skip/i);
  });

  it('writes nothing — a dry run that touches the disk is not a dry run', async () => {
    const target = realPath.join(tmp, 'src/index.tsx');
    await planFor([file('src/index.tsx', false, true)]);

    expect(realFs.readFileSync(target, 'utf8')).toBe('// pre-existing content\n');
  });
});
