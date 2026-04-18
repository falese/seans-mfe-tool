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

describe('postrun hook', () => {
  it('calls debug with duration in milliseconds', async () => {
    process.env.SEANS_MFE_CMD_START = String(Date.now() - 42);
    await postrunHook.call(ctx, { Command: makeCommand('deploy'), argv: [], result: undefined } as any, {} as any);
    const call = (ctx.debug as jest.Mock).mock.calls[0][0] as string;
    expect(call).toMatch(/\d+ms/);
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

  it('emits JSON envelope and exits 2 when --json is present', async () => {
    process.argv = ['node', 'run.js', 'does-not-exist', '--json'];
    await commandNotFoundHook.call(ctx, { id: 'does-not-exist', argv: [] } as any, {} as any);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = (writeSpy.mock.calls[0][0] as string).trim();
    const envelope = JSON.parse(written);
    expect(envelope.success).toBe(false);
    expect(envelope.error.type).toBe('validation');
    expect(envelope.error.message).toContain('does-not-exist');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('does not write to stdout and does not exit when --json is absent', async () => {
    process.argv = ['node', 'run.js', 'does-not-exist'];
    await commandNotFoundHook.call(ctx, { id: 'does-not-exist', argv: [] } as any, {} as any);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
