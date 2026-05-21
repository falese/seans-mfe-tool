/**
 * remote:init-angular Command Tests
 *
 * Parallel to remote-init.test.ts — same mocking strategy. Asserts the
 * Angular variant writes a manifest tagged framework: 'angular' +
 * bundler: 'webpack' and defaults to port 3101.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

jest.mock('fs-extra');
jest.mock('child_process');

jest.mock('chalk', () => ({
  blue: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  gray: (s: string) => s,
  cyan: (s: string) => s,
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((...args: string[]) => args.filter((a) => a).join('/')),
  join: jest.fn((...args: string[]) => args.filter((a) => a).join('/')),
}));

let mockConsole: { log: jest.SpyInstance; error: jest.SpyInstance };

import { remoteInitAngularCommand } from '../remote-init-angular';

describe('remote:init-angular Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(false);
    (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
    (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    mockExecSync.mockReturnValue(Buffer.from(''));
    jest.spyOn(process, 'cwd').mockReturnValue('/test/workspace');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Project Creation', () => {
    it('creates the Angular-flavored directory layout (incl. src/app)', async () => {
      await remoteInitAngularCommand('my-ng-feature', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-ng-feature/src')
      );
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-ng-feature/src/features')
      );
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-ng-feature/src/app')
      );
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-ng-feature/public')
      );
    });

    it('writes a manifest tagged framework: angular and bundler: webpack', async () => {
      await remoteInitAngularCommand('my-ng-feature', { skipInstall: true });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mfe-manifest.yaml'),
        expect.stringMatching(/framework:\s*angular/),
        'utf8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mfe-manifest.yaml'),
        expect.stringMatching(/bundler:\s*webpack/),
        'utf8'
      );
    });

    it('defaults to port 3101 (different from React remote 3001)', async () => {
      const result = await remoteInitAngularCommand('my-ng-feature', { skipInstall: true });
      expect(result.port).toBe(3101);

      // Manifest YAML should reference port 3101 in the generated endpoints.
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls.find((c: any[]) =>
        String(c[0]).includes('mfe-manifest.yaml')
      );
      expect(String(writeCall?.[1])).toContain('3101');
    });

    it('honors --port override', async () => {
      const result = await remoteInitAngularCommand('my-ng-feature', {
        port: 3205,
        skipInstall: true,
      });
      expect(result.port).toBe(3205);
      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls.find((c: any[]) =>
        String(c[0]).includes('mfe-manifest.yaml')
      );
      expect(String(writeCall?.[1])).toContain('3205');
    });
  });

  describe('Directory Exists Handling', () => {
    it('throws when directory exists without --force', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      await expect(
        remoteInitAngularCommand('my-ng-feature', { skipInstall: true })
      ).rejects.toThrow(/already exists/);
    });

    it('proceeds when directory exists with --force', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);
      await expect(
        remoteInitAngularCommand('my-ng-feature', { force: true, skipInstall: true })
      ).resolves.not.toThrow();
      expect(mockFs.ensureDir).toHaveBeenCalled();
    });
  });

  describe('Dry Run', () => {
    it('reports planned changes without writing files', async () => {
      const result = await remoteInitAngularCommand('my-ng-feature', { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.generatedFiles).toEqual([]);
      expect(result.plannedChanges?.length).toBeGreaterThan(0);
      expect(result.plannedChanges?.some((c) => c.target.includes('mfe-manifest.yaml'))).toBe(true);
      expect(mockFs.ensureDir).not.toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('Console Output', () => {
    it('logs Angular-specific creation message', async () => {
      await remoteInitAngularCommand('my-ng-feature', { skipInstall: true });
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Angular + webpack remote MFE')
      );
    });

    it('tells the user to run remote:generate next', async () => {
      await remoteInitAngularCommand('my-ng-feature', { skipInstall: true });
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('seans-mfe-tool remote:generate')
      );
    });
  });
});
