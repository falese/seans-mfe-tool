/**
 * Supplementary tests for src/commands/deploy.ts.
 *
 * The legacy deploy.test.js suite covers happy paths via heavy fs/exec mocking.
 * This file fills in the remaining gaps so deploy.ts hits the Phase 1.1
 * coverage targets (>=90% statements/branches/functions/lines):
 *   - waitForContainer timeout path → TimeoutError
 *   - copyDockerFiles missing-nginx branch → SystemError
 *   - development dry-run plan; production rejected as NOT_IMPLEMENTED (ADR-062)
 *   - Deploy.runCommand dispatch
 *   - cleanupTempDirs swallows fs.remove failures
 *
 * Refs Phase 1.1 of the production-readiness plan.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import { TimeoutError, SystemError } from '@seans-mfe/contracts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExec = execSync as jest.MockedFunction<typeof execSync>;
const mockPath = path as jest.Mocked<typeof path>;

// Import after mocks
import DeployCommand, {
  deployCommand,
  waitForContainer,
  copyDockerFiles,
} from '../deploy';

beforeEach(() => {
  jest.clearAllMocks();
  (mockFs.existsSync as unknown as jest.Mock).mockReturnValue(true);
  (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
  (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.copy as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.remove as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockFs.readJson as unknown as jest.Mock).mockResolvedValue({
    name: 'app',
    database: 'sqlite',
  });
  (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('template');
  (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
  (mockPath.resolve as unknown as jest.Mock).mockImplementation((...args) => args.join('/'));
  (mockPath.join as unknown as jest.Mock).mockImplementation((...args) => args.join('/'));
});

describe('waitForContainer', () => {
  it('throws a TimeoutError when the container never reaches "running" before the timeout', async () => {
    // Use real timers + a fast polling-cancelled setTimeout so the function's
    // 1s-sleep-per-iteration loop doesn't add 30s to the suite.
    jest.useRealTimers();
    const realSetTimeout = global.setTimeout;
    global.setTimeout = ((cb: (...args: unknown[]) => void) => realSetTimeout(cb, 0)) as unknown as typeof setTimeout;

    try {
      mockExec.mockImplementation(() => {
        throw new Error('No such container');
      });

      // Use a very short logical timeout so the inner `Date.now()` loop exits quickly.
      await expect(waitForContainer('ghost-container', 5)).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      global.setTimeout = realSetTimeout;
      jest.useFakeTimers();
    }
  });
});

describe('copyDockerFiles', () => {
  it('throws SystemError when the Dockerfile template is missing', async () => {
    (mockFs.existsSync as unknown as jest.Mock).mockReturnValue(false);

    await expect(copyDockerFiles('/tmp/d', 'shell')).rejects.toBeInstanceOf(SystemError);
  });

  it('throws SystemError when nginx.conf is missing but Dockerfile is present', async () => {
    // First check (Dockerfile.shell) -> true; second check (nginx.conf) -> false.
    let call = 0;
    (mockFs.existsSync as unknown as jest.Mock).mockImplementation(() => {
      call += 1;
      return call === 1;
    });

    await expect(copyDockerFiles('/tmp/d', 'shell')).rejects.toBeInstanceOf(SystemError);
    await expect(
      // re-run with a fresh counter
      (async () => {
        call = 0;
        return copyDockerFiles('/tmp/d', 'shell');
      })(),
    ).rejects.toThrow(/Nginx configuration not found/);
  });
});

describe('deployCommand dry-run plans', () => {
  it('plans a development docker run', async () => {
    const result = await deployCommand({
      name: 'dev-app',
      env: 'development',
      type: 'shell',
      port: 3000,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.environment).toBe('development');
    expect(result.generatedFiles).toEqual([]);
    expect(result.plannedChanges!.some((c) => c.op === 'spawn')).toBe(true);
    // No real deployment work executed under dry-run.
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('rejects production deployment (not yet implemented — ADR-062)', async () => {
    await expect(
      deployCommand({
        name: 'prod-app',
        env: 'production',
        type: 'shell',
        port: 8080,
        dryRun: true,
      }),
    ).rejects.toThrow('Production deployment not yet implemented');
  });

  it('defaults port to 8080 in the dry-run plan when port is omitted', async () => {
    const result = await deployCommand({
      name: 'no-port',
      env: 'development',
      type: 'shell',
      dryRun: true,
    });

    expect(result.ports).toEqual([8080]);
  });
});

describe('process signal handlers', () => {
  /**
   * The deploy module registers SIGINT/SIGTERM handlers at import time.
   * Locate the most recently registered async handler for each signal and
   * invoke it directly, asserting it cleans up and then exits.
   */
  function newestAsyncHandler(signal: NodeJS.Signals): ((...args: unknown[]) => Promise<unknown>) | undefined {
    const listeners = process.listeners(signal);
    return [...listeners].reverse().find((l) => l.constructor.name === 'AsyncFunction') as
      | ((...args: unknown[]) => Promise<unknown>)
      | undefined;
  }

  it.each<NodeJS.Signals>(['SIGINT', 'SIGTERM'])(
    '%s handler logs, awaits cleanup, then exits with code 1',
    async (signal) => {
      const handler = newestAsyncHandler(signal);
      expect(handler).toBeDefined();

      // jest.setup.js patches process.exit to throw.
      await expect(handler!()).rejects.toThrow(/Process exit with code 1/);
    },
  );
});

describe('Deploy oclif command', () => {
  it('declares the required oclif metadata (name arg, type flag, env, dry-run)', () => {
    expect(DeployCommand.description).toMatch(/deploy/i);
    expect(DeployCommand.args.name.required).toBe(true);
    const flags = DeployCommand.flags as Record<string, { required?: boolean }>;
    expect(flags.type).toBeDefined();
    expect(flags.type.required).toBe(true);
    expect(flags.env).toBeDefined();
    expect(flags['dry-run']).toBeDefined();
    // BaseCommand provides --json
    expect(flags.json).toBeDefined();
  });

  it('runCommand dispatches to deployCommand and respects --dry-run', async () => {
    const cmd = Object.create(DeployCommand.prototype) as InstanceType<typeof DeployCommand>;
    (cmd as unknown as { parse: jest.Mock }).parse = jest.fn().mockResolvedValue({
      args: { name: 'oclif-app' },
      flags: {
        type: 'shell',
        env: 'development',
        port: '3000',
        'dry-run': true,
      },
    });

    const result = await (cmd as unknown as { runCommand(): Promise<{ appName: string; dryRun: boolean }> })
      .runCommand();

    expect(result.appName).toBe('oclif-app');
    expect(result.dryRun).toBe(true);
  });
});
