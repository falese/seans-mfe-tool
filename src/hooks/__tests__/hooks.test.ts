/**
 * Tests for oclif lifecycle hooks (issue #97 / A8)
 */

// Mock crypto before imports
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

import initHook from '../init';
import prerunHook from '../prerun';
import postrunHook from '../postrun';
import commandNotFoundHook from '../command-not-found';
import { exitCodeFor } from '@seans-mfe/contracts';

// Minimal hook context mock
const ctx = {
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  exit: jest.fn(),
} as any;

const makeCommand = (id = 'deploy') => ({ id } as any);

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SEANS_MFE_CORRELATION_ID;
  delete process.env.SEANS_MFE_CMD_START;
});

// ── init hook ────────────────────────────────────────────────────────────────

describe('init hook', () => {
  it('sets SEANS_MFE_CORRELATION_ID on process.env', async () => {
    await initHook.call(ctx, { id: 'deploy', argv: [] } as any, {} as any);
    expect(process.env.SEANS_MFE_CORRELATION_ID).toBe('test-uuid-1234');
  });

  it('calls debug with the correlation ID', async () => {
    await initHook.call(ctx, { id: 'deploy', argv: [] } as any, {} as any);
    expect(ctx.debug).toHaveBeenCalledWith(expect.stringContaining('test-uuid-1234'));
  });
});

// ── prerun hook ───────────────────────────────────────────────────────────────

describe('prerun hook', () => {
  it('sets SEANS_MFE_CMD_START to a numeric timestamp string', async () => {
    const before = Date.now();
    await prerunHook.call(ctx, { Command: makeCommand(), argv: [] } as any, {} as any);
    const after = Date.now();
    const start = parseInt(process.env.SEANS_MFE_CMD_START!, 10);
    expect(start).toBeGreaterThanOrEqual(before);
    expect(start).toBeLessThanOrEqual(after);
  });

  it('calls debug with the command id', async () => {
    await prerunHook.call(ctx, { Command: makeCommand('api'), argv: [] } as any, {} as any);
    expect(ctx.debug).toHaveBeenCalledWith(expect.stringContaining('api'));
  });
});

// ── postrun hook ──────────────────────────────────────────────────────────────
// The C4 rewrite emits telemetry to the daemon; debug-duration logging was
// removed. Without SEANS_MFE_DAEMON_URL set, the hook is a no-op.
// Detailed telemetry behaviour is covered by postrun.test.ts.

describe('postrun hook', () => {
  it('resolves without throwing when SEANS_MFE_DAEMON_URL is not set', async () => {
    process.env.SEANS_MFE_CMD_START = String(Date.now() - 42);
    await expect(
      postrunHook.call(ctx, { Command: makeCommand('deploy'), argv: [], result: undefined } as any, {} as any)
    ).resolves.not.toThrow();
  });

  it('handles missing start timestamp gracefully', async () => {
    delete process.env.SEANS_MFE_CMD_START;
    await expect(
      postrunHook.call(ctx, { Command: makeCommand('deploy'), argv: [], result: undefined } as any, {} as any)
    ).resolves.not.toThrow();
  });
});

// ── command-not-found hook ────────────────────────────────────────────────────

describe('command-not-found hook', () => {
  let originalArgv: string[];
  let writeSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    originalArgv = process.argv;
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    process.argv = originalArgv;
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  // #331: this used to emit `{ success, error: { suggestions } }` — the one
  // response an agent is most likely to hit while discovering the CLI, and the
  // only one it could not parse as a CommandResult (ADR-018).
  const config = { commandIDs: ['mfe:validate', 'remote:init', 'remote:generate', 'deploy'] };

  function emitted(): Record<string, any> {
    expect(writeSpy).toHaveBeenCalledTimes(1);
    return JSON.parse((writeSpy.mock.calls[0][0] as string).trim());
  }

  it('emits a CommandResult envelope under --json', async () => {
    process.argv = ['node', 'run.js', 'does-not-exist', '--json'];
    await commandNotFoundHook.call(ctx, { id: 'does-not-exist', argv: [], config } as any);
    const envelope = emitted();
    expect(envelope).not.toHaveProperty('success');
    expect(envelope.ok).toBe(false);
    expect(envelope.warnings).toEqual([]);
    expect(typeof envelope.telemetry.correlationId).toBe('string');
    expect(envelope.error.type).toBe('validation');
    expect(envelope.error.message).toContain('does-not-exist');
  });

  it('exits with the code the envelope declares, via exitCodeFor', async () => {
    process.argv = ['node', 'run.js', 'does-not-exist', '--json'];
    await commandNotFoundHook.call(ctx, { id: 'does-not-exist', argv: [], config } as any);
    const envelope = emitted();
    expect(envelope.error.code).toBe(exitCodeFor('validation'));
    expect(exitSpy).toHaveBeenCalledWith(envelope.error.code);
  });

  it('carries the nearest real commands in error.details.suggestions', async () => {
    process.argv = ['node', 'run.js', 'remote:int', '--json'];
    await commandNotFoundHook.call(ctx, { id: 'remote:int', argv: [], config } as any);
    const { details } = emitted().error;
    expect(details.command).toBe('remote:int');
    expect(details.suggestions[0]).toBe('remote:init');
    expect(details.suggestions).not.toContain('deploy');
  });

  it('reuses the correlation id the init hook published', async () => {
    process.env.SEANS_MFE_CORRELATION_ID = 'corr-from-init';
    process.argv = ['node', 'run.js', 'does-not-exist', '--json'];
    await commandNotFoundHook.call(ctx, { id: 'does-not-exist', argv: [], config } as any);
    expect(emitted().telemetry.correlationId).toBe('corr-from-init');
  });

  it('does not write to stdout and does not exit when --json is absent', async () => {
    process.argv = ['node', 'run.js', 'does-not-exist'];
    await commandNotFoundHook.call(ctx, { id: 'does-not-exist', argv: [], config } as any);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
