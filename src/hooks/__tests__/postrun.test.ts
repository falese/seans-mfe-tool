/**
 * Tests for the postrun hook telemetry emission.
 *
 * Uses a mock WebSocket class (no real network) to assert:
 * - Correct envelope sent to daemon
 * - Correlation ID propagated from env
 * - Offline cache prevents repeated attempts
 * - Without SEANS_MFE_DAEMON_URL, no connection is attempted
 *
 * Refs #112 (C4)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WsListener = (event: { data: string }) => void;

interface MockWsInstance {
  url: string;
  sentFrames: string[];
  listeners: Record<string, Array<(event?: unknown) => void>>;
  triggerOpen(): void;
  triggerMessage(data: string): void;
  triggerError(): void;
  triggerClose(): void;
  close(): void;
}

let lastMockWs: MockWsInstance | null = null;

function createMockWsClass() {
  class MockWebSocket {
    url: string;
    sentFrames: string[] = [];
    listeners: Record<string, Array<(event?: unknown) => void>> = {};

    constructor(url: string) {
      this.url = url;
      lastMockWs = this as unknown as MockWsInstance;
    }

    send(data: string) {
      this.sentFrames.push(data);
    }
    close() {
      this._emit('close');
    }

    addEventListener(type: string, fn: (event?: unknown) => void) {
      this.listeners[type] = this.listeners[type] ?? [];
      this.listeners[type].push(fn);
    }

    _emit(type: string, event?: unknown) {
      (this.listeners[type] ?? []).forEach((fn) => fn(event));
    }

    triggerOpen() {
      this._emit('open');
    }
    triggerMessage(data: string) {
      this._emit('message', { data });
    }
    triggerError() {
      this._emit('error');
    }
    triggerClose() {
      this._emit('close');
    }
  }
  return MockWebSocket as unknown as new (url: string, protocols?: string | string[]) => unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OFFLINE_CACHE = path.join(os.homedir(), '.cache', 'seans-mfe', 'daemon-offline');

const OFFLINE_TTL_MS = 60_000;

function clearOfflineCache() {
  try {
    fs.unlinkSync(OFFLINE_CACHE);
  } catch {
    /* ignore */
  }
}

function writeOfflineCache(offsetMs = OFFLINE_TTL_MS + 1_000) {
  fs.mkdirSync(path.dirname(OFFLINE_CACHE), { recursive: true });
  fs.writeFileSync(OFFLINE_CACHE, String(Date.now() + offsetMs));
}

function buildHookContext(overrides: Record<string, unknown> = {}) {
  return {
    Command: { id: 'test:cmd' },
    config: {},
    debug: jest.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearOfflineCache();
  lastMockWs = null;
  delete process.env.SEANS_MFE_DAEMON_URL;
  delete process.env.SEANS_MFE_CMD_START;
  delete process.env.SEANS_MFE_CORRELATION_ID;
});

afterEach(() => {
  clearOfflineCache();
});

describe('postrun hook', () => {
  test('no-ops when SEANS_MFE_DAEMON_URL is not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hook = require('../postrun').default;
    await hook.call(buildHookContext(), {});
    expect(lastMockWs).toBeNull();
  });

  test('sends cli.command.completed ACTION with correct correlation ID', async () => {
    jest.useFakeTimers();
    process.env.SEANS_MFE_DAEMON_URL = 'ws://localhost:9999/graphql';
    process.env.SEANS_MFE_CMD_START = String(Date.now() - 100);
    process.env.SEANS_MFE_CORRELATION_ID = 'test-corr-id';

    // Patch globalThis.WebSocket with our mock
    (globalThis as any).WebSocket = createMockWsClass();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hook = require('../postrun').default;
    const ctx = buildHookContext();

    const hookPromise = hook.call(ctx, { Command: { id: 'bff:init' } });

    // Simulate connection sequence
    await Promise.resolve(); // let the hook start
    lastMockWs!.triggerOpen();
    await Promise.resolve();
    lastMockWs!.triggerMessage(JSON.stringify({ type: 'connection_ack' }));

    await hookPromise;
    jest.runAllTimers();

    const frames = lastMockWs!.sentFrames.map((f: string) => JSON.parse(f));
    const init = frames.find((f: Record<string, unknown>) => f.type === 'connection_init');
    const subscribe = frames.find((f: Record<string, unknown>) => f.type === 'subscribe');

    expect(init).toBeDefined();
    expect(subscribe).toBeDefined();

    const vars = subscribe.payload.variables as { message: string };
    const msg = JSON.parse(vars.message);
    expect(msg.payload.actionType).toBe('cli.command.completed');
    expect(msg.metadata.correlationId).toBe('test-corr-id');
    expect(msg.payload.data.command).toBe('bff:init');

    delete (globalThis as any).WebSocket;
    jest.useRealTimers();
  });

  test('marks daemon offline after connection error and skips next attempt', async () => {
    jest.useFakeTimers();
    process.env.SEANS_MFE_DAEMON_URL = 'ws://localhost:9999/graphql';
    (globalThis as any).WebSocket = createMockWsClass();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hook = require('../postrun').default;

    const hookPromise = hook.call(buildHookContext(), {});
    await Promise.resolve();
    lastMockWs!.triggerError();
    await hookPromise;
    jest.runAllTimers();

    // Offline file should now exist
    expect(fs.existsSync(OFFLINE_CACHE)).toBe(true);

    // Second call — should skip without creating a new socket
    const prevWs = lastMockWs;
    lastMockWs = null;
    await hook.call(buildHookContext(), {});
    expect(lastMockWs).toBeNull(); // no new socket created

    delete (globalThis as any).WebSocket;
    jest.useRealTimers();
  });

  test('no latency added when SEANS_MFE_DAEMON_URL is unset (<10ms)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hook = require('../postrun').default;
    const start = Date.now();
    await hook.call(buildHookContext(), {});
    expect(Date.now() - start).toBeLessThan(10);
  });
});
