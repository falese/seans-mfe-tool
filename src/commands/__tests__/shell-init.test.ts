/**
 * shell:init Command Tests
 * Following TDD principles — testing issue #15 (orchestration service generation)
 * and issue #144 (shell:init command).
 */

import * as fs from 'fs-extra';
import * as path from 'path';

// Mock dependencies before importing command
jest.mock('fs-extra');
jest.mock('child_process');

// Mock chalk to return the string as-is
jest.mock('chalk', () => ({
  blue: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  gray: (s: string) => s,
  cyan: (s: string) => s,
}));

// Mock processTemplates (it does real file I/O we don't need in unit tests)
jest.mock('../../utils/templateProcessor', () => ({
  processTemplates: jest.fn().mockResolvedValue(undefined),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path to return predictable values
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((...args: string[]) => args.filter(Boolean).join('/')),
  join: jest.fn((...args: string[]) => args.filter(Boolean).join('/')),
  relative: jest.fn((from: string, to: string) => to.replace(from + '/', '')),
  basename: jest.fn((p: string) => p.split('/').pop() ?? p),
}));

let mockConsole: { log: jest.SpyInstance; error: jest.SpyInstance };

// Import after mocks
import { shellInitCommand } from '../shell/init';

describe('shell:init Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };

    // Default: target dir does not exist, template dir exists
    (mockFs.pathExists as unknown as jest.Mock).mockImplementation(async (p: string) => {
      // Template dir always exists; target dir does not by default
      return String(p).includes('templates');
    });
    (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
    (mockFs.copy as unknown as jest.Mock).mockResolvedValue(undefined);
    (mockFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (mockFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => false } as unknown as fs.Stats);

    jest.spyOn(process, 'cwd').mockReturnValue('/test/workspace');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Project Creation ──────────────────────────────────────────────────────

  describe('Project Creation', () => {
    it('should create orchestration-service directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('orchestration-service'),
      );
    });

    it('should create orchestration-service/registry directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('registry'),
      );
    });

    it('should create orchestration-service/api directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('api'),
      );
    });

    it('should create orchestration-service/websocket directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('websocket'),
      );
    });

    it('should create src/orchestration-runtime directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('orchestration-runtime'),
      );
    });

    it('should return correct name and ports', async () => {
      const result = await shellInitCommand('myapp', { port: 3000, orchPort: 3100, skipInstall: true });

      expect(result.name).toBe('myapp');
      expect(result.port).toBe(3000);
      expect(result.orchPort).toBe(3100);
      expect(result.dryRun).toBe(false);
    });

    it('should copy orchestration-service templates', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('orchestration-service'),
        expect.stringContaining('orchestration-service'),
      );
    });

    it('should copy shell runtime templates', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('orchestration-runtime'),
        expect.stringContaining('orchestration-runtime'),
      );
    });

    it('should copy docker-compose template', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose'),
        expect.stringContaining('docker-compose'),
      );
    });
  });

  // ── Default Values ────────────────────────────────────────────────────────

  describe('Default Values', () => {
    it('should default port to 3000', async () => {
      const result = await shellInitCommand('myapp', { skipInstall: true });
      expect(result.port).toBe(3000);
    });

    it('should default orchPort to 3100', async () => {
      const result = await shellInitCommand('myapp', { skipInstall: true });
      expect(result.orchPort).toBe(3100);
    });
  });

  // ── Directory Exists Handling ─────────────────────────────────────────────

  describe('Directory Exists Handling', () => {
    it('should throw error if directory exists without --force', async () => {
      (mockFs.pathExists as unknown as jest.Mock).mockImplementation(async () => true);

      await expect(shellInitCommand('myapp', { skipInstall: true }))
        .rejects.toThrow('Directory "myapp" already exists');
    });

    it('should proceed if directory exists with --force', async () => {
      (mockFs.pathExists as unknown as jest.Mock).mockImplementation(async () => true);

      await expect(
        shellInitCommand('myapp', { force: true, skipInstall: true }),
      ).resolves.not.toThrow();
    });
  });

  // ── Dry Run ───────────────────────────────────────────────────────────────

  describe('Dry Run', () => {
    it('should return dryRun: true without writing files', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.generatedFiles).toHaveLength(0);
      expect(mockFs.ensureDir).not.toHaveBeenCalled();
      expect(mockFs.copy).not.toHaveBeenCalled();
    });

    it('should include plannedChanges in dry run', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      expect(result.plannedChanges).toBeDefined();
      expect(result.plannedChanges!.length).toBeGreaterThan(0);
    });

    it('should list orchestration-service in planned changes', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      const targets = result.plannedChanges!.map((c) => c.target);
      expect(targets.some((t) => t.includes('orchestration-service'))).toBe(true);
    });

    it('should list docker-compose in planned changes', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      const targets = result.plannedChanges!.map((c) => c.target);
      expect(targets.some((t) => t.includes('docker-compose'))).toBe(true);
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should throw and log error when template dir is missing', async () => {
      (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(false);

      await expect(shellInitCommand('myapp', { skipInstall: true }))
        .rejects.toThrow(/template directory not found/);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Shell init failed'),
      );
    });

    it('should throw and log error on fs failure during dir creation', async () => {
      (mockFs.pathExists as unknown as jest.Mock).mockImplementation(async (p: string) =>
        String(p).includes('templates'),
      );
      (mockFs.ensureDir as unknown as jest.Mock).mockRejectedValue(new Error('disk full'));

      await expect(shellInitCommand('myapp', { skipInstall: true }))
        .rejects.toThrow(/Failed to create directory/);
    });
  });

  // ── Console Output ────────────────────────────────────────────────────────

  describe('Console Output', () => {
    it('should log shell creation message', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating shell app: myapp'),
      );
    });

    it('should log success message', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Shell + orchestration service generated!'),
      );
    });

    it('should log orchestration service URL', async () => {
      await shellInitCommand('myapp', { orchPort: 3100, skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3100'),
      );
    });

    it('should log REST API endpoints', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('/api/register'),
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('/api/discover'),
      );
    });
  });
});
