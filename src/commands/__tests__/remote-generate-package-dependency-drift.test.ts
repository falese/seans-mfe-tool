/**
 * `remote:generate` warns when an already-existing, skipped `package.json`
 * disagrees with what the template would render right now — generically,
 * across any dependency the template controls (framework version pins,
 * design-system deps, BFF/Mesh deps, build tooling), not one category of it
 * (use case 2 of docs/platform-design-review/core-ideas-demo-runbook.md).
 *
 * `package.json.ejs` already renders the correct content on every run, but
 * `package.json` is developer-owned, so `writeGeneratedFiles` always skips it
 * once it exists — discarding that correctly-rendered content silently.
 * `reportPackageDependencyDrift` diffs the real render (already computed as
 * `allFiles`, `writeGeneratedFiles`'s own input) against the real on-disk
 * content, so it can never drift from what the template actually produces.
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

describe('remote:generate warns when package.json drifts from the template render', () => {
  let tmp: string;
  let cwdSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  const manifest = { name: 'demo-widget', version: '1.0.0', capabilities: [] };

  const writePackageJson = (dependencies: Record<string, string> = {}, devDependencies: Record<string, string> = {}) => {
    const full = realPath.join(tmp, 'package.json');
    realFs.writeFileSync(full, JSON.stringify({ name: 'demo-widget', dependencies, devDependencies }), 'utf8');
    return full;
  };

  /** What `package.json.ejs` would render, mixing a framework-pin dep and a BFF-only dep — deliberately not all BFF, to prove genericity. */
  const renderedPackageJson = (pkgPath: string) => ({
    path: pkgPath,
    content: JSON.stringify({
      name: 'demo-widget',
      dependencies: { react: '~18.2.0', 'react-dom': '~18.2.0', express: '^4.18.2' },
      devDependencies: { '@rspack/cli': '^1.7.0', '@graphql-mesh/cli': '^0.100.21' },
    }),
    overwrite: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tmp = realFs.mkdtempSync(realPath.join(os.tmpdir(), 'smt-pkgdrift-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmp);
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockParse.mockResolvedValue({ valid: true, manifest, errors: [] } as never);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    jest.restoreAllMocks();
    realFs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reports a missing non-BFF dependency (framework pin), not just BFF ones', async () => {
    const pkgPath = writePackageJson({ express: '^4.18.2' }, { '@graphql-mesh/cli': '^0.100.21' });
    mockGenerate.mockResolvedValue({ files: [renderedPackageJson(pkgPath)], preservedCapabilities: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('out of date');
    expect(logged).toContain('missing    dependencies."react"');
    expect(logged).toContain('missing    dependencies."react-dom"');
  });

  it('reports a version mismatch, not just an absent dependency', async () => {
    const pkgPath = writePackageJson(
      { react: '^18.0.0', 'react-dom': '~18.2.0', express: '^4.18.2' },
      { '@rspack/cli': '^1.7.0', '@graphql-mesh/cli': '^0.100.21' },
    );
    mockGenerate.mockResolvedValue({ files: [renderedPackageJson(pkgPath)], preservedCapabilities: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('mismatched dependencies."react": "^18.0.0" → "~18.2.0"');
  });

  it('reports a missing BFF dependency alongside non-BFF ones in the same run', async () => {
    const pkgPath = writePackageJson({ react: '~18.2.0', 'react-dom': '~18.2.0' }, { '@rspack/cli': '^1.7.0' });
    mockGenerate.mockResolvedValue({ files: [renderedPackageJson(pkgPath)], preservedCapabilities: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('missing    dependencies."express"');
    expect(logged).toContain('missing    devDependencies."@graphql-mesh/cli"');
  });

  it('says nothing once package.json matches the render exactly', async () => {
    const pkgPath = writePackageJson(
      { react: '~18.2.0', 'react-dom': '~18.2.0', express: '^4.18.2' },
      { '@rspack/cli': '^1.7.0', '@graphql-mesh/cli': '^0.100.21' },
    );
    mockGenerate.mockResolvedValue({ files: [renderedPackageJson(pkgPath)], preservedCapabilities: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('out of date');
  });

  it('does not flag an extra dependency the developer added that the render does not know about', async () => {
    const pkgPath = writePackageJson(
      { react: '~18.2.0', 'react-dom': '~18.2.0', express: '^4.18.2', lodash: '^4.17.21' },
      { '@rspack/cli': '^1.7.0', '@graphql-mesh/cli': '^0.100.21' },
    );
    mockGenerate.mockResolvedValue({ files: [renderedPackageJson(pkgPath)], preservedCapabilities: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [pkgPath], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('out of date');
    expect(logged).not.toContain('lodash');
  });

  it('says nothing when package.json was not among the skipped files', async () => {
    const pkgPath = writePackageJson({});
    mockGenerate.mockResolvedValue({ files: [renderedPackageJson(pkgPath)], preservedCapabilities: [] } as never);
    mockWrite.mockResolvedValue({ files: [], skipped: [], errors: [] });

    await remoteGenerateCommand();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('out of date');
  });
});
