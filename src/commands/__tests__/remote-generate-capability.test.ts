/**
 * remote:generate:capability Command Tests
 * Following TDD principles - testing REQ-REMOTE-003 (single-capability generation)
 */

jest.mock('fs-extra');

jest.mock('chalk', () => ({
  blue: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  gray: (s: string) => s,
  cyan: (s: string) => s
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((...args: string[]) => args.filter(a => a).join('/')),
  join: jest.fn((...args: string[]) => args.filter(a => a).join('/')),
  relative: jest.fn((from: string, to: string) => to.replace(from + '/', ''))
}));

jest.mock('@seans-mfe/dsl', () => ({
  parseAndValidateDirectory: jest.fn(),
  formatErrorsForCLI: jest.fn((errors: any[]) => errors.map((e: any) => e.message).join('\n'))
}));

jest.mock('@seans-mfe/codegen', () => ({
  generateAllFiles: jest.fn(),
  writeGeneratedFiles: jest.fn(),
  // Real, not a stub: resolveFrameworkVariant delegates the framework-NAME
  // rule here rather than restating it (ADR-092), and a mock returning
  // undefined would make this suite assert against a variant the platform
  // never produces. It is deliberately not `deriveBuiltinVariant`: that one
  // answers "which built-in trio" and collapses every third-party framework
  // to react, which is the wrong question at a plugin-resolution call site.
  resolveFrameworkName: jest.requireActual('@seans-mfe/codegen').resolveFrameworkName,
  // The BFF registers its file contribution on import (ADR-094 §2); a stubbed
  // registry would throw before the command under test ever runs.
  registerFileContributor: jest.fn(),
}));

import { remoteGenerateCapabilityCommand } from '../remote/generate/capability';
import { parseAndValidateDirectory } from '@seans-mfe/dsl';
import { generateAllFiles, writeGeneratedFiles } from '@seans-mfe/codegen';

const mockParseAndValidate = parseAndValidateDirectory as jest.MockedFunction<typeof parseAndValidateDirectory>;
const mockGenerateAllFiles = generateAllFiles as jest.MockedFunction<typeof generateAllFiles>;
const mockWriteGeneratedFiles = writeGeneratedFiles as jest.MockedFunction<typeof writeGeneratedFiles>;

const baseManifest = {
  name: 'my-remote',
  version: '1.0.0',
  type: 'remote' as const,
  capabilities: [
    { UserProfile: { inputs: [], outputs: [] } },
    { Dashboard: { inputs: [], outputs: [] } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParseAndValidate.mockResolvedValue({ valid: true, manifest: baseManifest as any, errors: [] });
  mockGenerateAllFiles.mockResolvedValue({
    files: [{ path: '/cwd/src/features/UserProfile/index.ts', content: '', overwrite: false }],
    preservedCapabilities: [], diagnostics: [],
  });
  mockWriteGeneratedFiles.mockResolvedValue({ files: [{ path: '/cwd/src/features/UserProfile/index.ts' }], skipped: [], reseeded: [], errors: [] } as any);
});

describe('remoteGenerateCapabilityCommand', () => {
  it('generates only the matching capability', async () => {
    await remoteGenerateCapabilityCommand('UserProfile');

    expect(mockGenerateAllFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: [{ UserProfile: { inputs: [], outputs: [] } }],
      }),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('is case-insensitive when matching capability name', async () => {
    await remoteGenerateCapabilityCommand('userprofile');

    expect(mockGenerateAllFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: [{ UserProfile: { inputs: [], outputs: [] } }],
      }),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('throws a descriptive error when capability is not found', async () => {
    await expect(remoteGenerateCapabilityCommand('NotExist')).rejects.toThrow(
      /not found in manifest/
    );
  });

  it('lists available capabilities in the error message', async () => {
    await expect(remoteGenerateCapabilityCommand('NotExist')).rejects.toThrow(
      /UserProfile.*Dashboard|Dashboard.*UserProfile/
    );
  });

  it('respects --dry-run: calls generateAllFiles but not writeGeneratedFiles', async () => {
    await remoteGenerateCapabilityCommand('UserProfile', { dryRun: true });

    expect(mockGenerateAllFiles).toHaveBeenCalled();
    expect(mockWriteGeneratedFiles).not.toHaveBeenCalled();
  });

  it('passes --force to writeGeneratedFiles', async () => {
    await remoteGenerateCapabilityCommand('UserProfile', { force: true });

    expect(mockWriteGeneratedFiles).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ force: true })
    );
  });
});
