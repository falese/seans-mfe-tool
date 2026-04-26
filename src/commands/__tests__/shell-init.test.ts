/**
 * shell:init Command Tests
 * TDD for daemon-native shell generation (ADR-016, ADR-017).
 *
 * The shell:init command generates a four-tier control plane:
 *   orchestration/registry — MFERegistry rules engine
 *   orchestration/daemon   — ShellDaemon (DaemonService protocol)
 *   src/shell              — Browser: MFEOrchestrator + MFERenderer
 *   docker-compose.yml     — All four services
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
    it('should create orchestration/daemon directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('daemon'),
      );
    });

    it('should create orchestration/registry directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('registry'),
      );
    });

    it('should create src/shell directory', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('shell'),
      );
    });

    it('should return correct name and ports', async () => {
      const result = await shellInitCommand('myapp', { port: 3000, daemonPort: 3001, registryPort: 4000, skipInstall: true });

      expect(result.name).toBe('myapp');
      expect(result.port).toBe(3000);
      expect(result.daemonPort).toBe(3001);
      expect(result.registryPort).toBe(4000);
      expect(result.dryRun).toBe(false);
    });

    it('should copy daemon templates', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('daemon'),
        expect.stringContaining('daemon'),
      );
    });

    it('should copy registry templates', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('registry'),
        expect.stringContaining('registry'),
      );
    });

    it('should copy shell src templates', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('shell'),
        expect.stringContaining('shell'),
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

    it('should default daemonPort to 3001', async () => {
      const result = await shellInitCommand('myapp', { skipInstall: true });
      expect(result.daemonPort).toBe(3001);
    });

    it('should default registryPort to 4000', async () => {
      const result = await shellInitCommand('myapp', { skipInstall: true });
      expect(result.registryPort).toBe(4000);
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

    it('should list orchestration/daemon in planned changes', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      const targets = result.plannedChanges!.map((c) => c.target);
      expect(targets.some((t) => t.includes('daemon'))).toBe(true);
    });

    it('should list orchestration/registry in planned changes', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      const targets = result.plannedChanges!.map((c) => c.target);
      expect(targets.some((t) => t.includes('registry'))).toBe(true);
    });

    it('should list docker-compose in planned changes', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true });

      const targets = result.plannedChanges!.map((c) => c.target);
      expect(targets.some((t) => t.includes('docker-compose'))).toBe(true);
    });

    it('should include daemonPort and registryPort in dry run result', async () => {
      const result = await shellInitCommand('myapp', { dryRun: true, daemonPort: 3001, registryPort: 4000 });

      expect(result.daemonPort).toBe(3001);
      expect(result.registryPort).toBe(4000);
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
        expect.stringContaining('Shell + daemon-native control plane generated!'),
      );
    });

    it('should log daemon endpoint URL', async () => {
      await shellInitCommand('myapp', { daemonPort: 3001, skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('ws://localhost:3001'),
      );
    });

    it('should log registry endpoint URL', async () => {
      await shellInitCommand('myapp', { registryPort: 4000, skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4000'),
      );
    });

    it('should mention docker-compose up next step', async () => {
      await shellInitCommand('myapp', { skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose up -d'),
      );
    });
  });
});
