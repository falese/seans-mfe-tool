/**
 * `remote:generate` warns when `data:` implies package.json dependencies an
 * already-existing, skipped package.json doesn't have (use case 2 of
 * docs/platform-design-review/core-ideas-demo-runbook.md).
 *
 * package.json.ejs already renders the correct Mesh dependency set on every
 * run, but package.json is developer-owned, so `writeGeneratedFiles` always
 * skips it once it exists — discarding that correctly-rendered content
 * silently. `reportMissingBffDependencies` is the one place that loss becomes
 * visible.
 *
 * Uses a real temp dir and a real package.json on disk (not a mocked `fs`) —
 * the function under test reads the skipped file's real content via plain
 * `fs`, so a stubbed read would test nothing.
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

jest.mock('@seans-mfe/dsl', () => ({
  parseAndValidateDirectory: jest.fn(),
  formatErrorsForCLI: jest.fn(() => ''),
}));

jest.mock('@seans-mfe/codegen', () => {
  const actual = jest.requireActual('@seans-mfe/codegen');
  return { ...actual, generateAllFiles: jest.fn(), writeGeneratedFiles: jest.fn() };
});

jest.mock('../../framework/loader', () => ({
  resolveFrameworkVariant: jest.fn(() => undefined),
}));

import { remoteGenerateCommand } from '../remote-generate';
import { parseAndValidateDirectory } from '@seans-mfe/dsl';
import { generateAllFiles, writeGeneratedFiles } from '@seans-mfe/codegen';

const mockParse = parseAndValidateDirectory as jest.MockedFunction<typeof parseAndValidateDirectory>;
const mockGenerate = generateAllFiles as jest.MockedFunction<typeof generateAllFiles>;
const mockWrite = writeGeneratedFiles as jest.MockedFunction<typeof writeGeneratedFiles>;

describe('remote:generate warns about missing BFF dependencies (data:)', () => {
  let tmp: string;
  let cwdSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  const manifestWithData = {
    name: 'demo-widget',
    version: '1.0.0',
    capabilities: [],
    data: { sources: [{ name: 'WidgetAPI', handler: { openapi: { source: './specs/widget-api.yaml' } } }] },
  };

  const writePackageJson = (deps: Record<string, string> = {}, devDeps: Record<string, string> = {}) => {
    const full = realPath.join(tmp, 'package.json');
    realFs.writeFileSync(full, JSON.stringify({ name: 'demo-widget', dependencies: deps, devDependencies: devDeps }), 'utf8');
    return full;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tmp = realFs.mkdtempSync(realPath.join(os.tmpdir(), 'smt-bffdeps-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmp);
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockGenerate.mockResolvedValue({ files: [], preservedCapabilities: [] } as never);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    jest.restoreAllMocks();
    realFs.rmSync(tmp, { recursive: true, force: true });
  });

  it('lists the missing Mesh dependencies when package.json was skipped and data: is present', async () => {
    const pkgPath = writePackageJson({ react: '~18.2.0' });
    mockParse.mockResolvedValue({ valid: true, manifest: manifestWithData, errors: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('package.json is missing');
    expect(logged).toContain('@graphql-mesh/serve-runtime');
    expect(logged).toContain('express');
    expect(logged).toContain('developer-owned, so `data:` did not add these for you');
  });

  it('says nothing once every expected dependency is already declared', async () => {
    const { resolveBffDependencies } = jest.requireActual('@seans-mfe/codegen');
    const { dependencies, devDependencies } = resolveBffDependencies(manifestWithData);
    const pkgPath = writePackageJson(dependencies, devDependencies);
    mockParse.mockResolvedValue({ valid: true, manifest: manifestWithData, errors: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('is missing');
  });

  it('says nothing when the manifest has no data: section, regardless of what package.json is missing', async () => {
    const pkgPath = writePackageJson({});
    const manifestNoData = { name: 'demo-widget', version: '1.0.0', capabilities: [] };
    mockParse.mockResolvedValue({ valid: true, manifest: manifestNoData, errors: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('is missing');
  });

  it('says nothing when package.json was not among the skipped files', async () => {
    mockParse.mockResolvedValue({ valid: true, manifest: manifestWithData, errors: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('is missing');
  });
});
