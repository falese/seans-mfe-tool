import { Hook } from '@oclif/core';
import { randomUUID } from 'crypto';
import { parseTraceparent } from '@falese/smt-contracts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Message } from '@falese/smt-contracts';

const OFFLINE_CACHE_PATH = path.join(os.homedir(), '.cache', 'seans-mfe', 'daemon-offline');
const OFFLINE_TTL_MS = 60_000;
const CONNECT_TIMEOUT_MS = 2_000;

/**
 * oclif postrun hook — emits a cli.command.completed telemetry event to the
 * daemon over a short-lived graphql-transport-ws connection.
 *
 * Gated by SEANS_MFE_DAEMON_URL.  Non-blocking: any error (unreachable daemon,
 * timeout) is swallowed silently.  A 60-second offline cache prevents repeated
 * connection attempts when the daemon is down.
 *
 * Refs #112 (C4)
 */
const hook: Hook<'postrun'> = async function(opts) {
  const daemonUrl = process.env.SEANS_MFE_DAEMON_URL;
  if (!daemonUrl) return;

  const start = parseInt(process.env.SEANS_MFE_CMD_START ?? '0', 10);
  const durationMs = Date.now() - start;

  if (isDaemonOffline()) {
    this.debug('[postrun] daemon offline cache active, skipping telemetry');
    return;
  }

  const commandId = (opts.Command as { id?: string } | undefined)?.id ?? '(unknown)';
  // Prefer the trace BaseCommand published (ADR-081): before this, the hook
  // minted a correlation id of its own, so the daemon's view of a command could
  // not be joined to that command's envelope or to anything it spawned.
  const correlationId =
    parseTraceparent(process.env.TRACEPARENT)?.traceId ??
    process.env.SEANS_MFE_CORRELATION_ID ??
    randomUUID();

  const message: Message = {
    direction: 'ACTION',
    kind: 'ACTION',
    payload: {
      id: randomUUID(),
      componentId: 'seans-mfe-tool',
      actionType: 'cli.command.completed',
      data: {
        command: commandId,
        durationMs,
        correlationId,
      },
      timestamp: new Date().toISOString(),
    },
    metadata: {
      correlationId,
      acknowledged: false,
      error: null,
    },
  };

  // Fire-and-forget — never delay the CLI
  emitTelemetry(daemonUrl, message, CONNECT_TIMEOUT_MS)
    .catch(() => markDaemonOffline());
};

// ---------------------------------------------------------------------------
// Offline cache helpers
// ---------------------------------------------------------------------------

function isDaemonOffline(): boolean {
  try {
    const raw = fs.readFileSync(OFFLINE_CACHE_PATH, 'utf8').trim();
    const offlineUntil = parseInt(raw, 10);
    return !isNaN(offlineUntil) && Date.now() < offlineUntil;
  } catch {
    return false;
  }
}

function markDaemonOffline(): void {
  try {
    fs.mkdirSync(path.dirname(OFFLINE_CACHE_PATH), { recursive: true });
    fs.writeFileSync(OFFLINE_CACHE_PATH, String(Date.now() + OFFLINE_TTL_MS));
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// WebSocket emission
// ---------------------------------------------------------------------------

/** The subset of the WebSocket surface (native or the 'ws' package) this hook uses. */
interface MinimalWebSocket {
  close(): void;
  send(data: string): void;
  addEventListener(type: 'open' | 'error' | 'close', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}
type WebSocketCtor = new (url: string, protocols?: string | string[]) => MinimalWebSocket;

function emitTelemetry(url: string, message: Message, timeoutMs: number): Promise<void> {
  // Use native WebSocket (Node 22+) or fall back to the 'ws' package
  const WS = getWebSocketClass();
  if (!WS) return Promise.resolve(); // neither available — skip silently

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const ws = new WS(url, ['graphql-transport-ws']);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('daemon connection timeout'));
    }, timeoutMs);

    ws.addEventListener('open', () => {
      try {
        // graphql-transport-ws: send connection_init then our payload
        ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));
        ws.send(JSON.stringify({
          type: 'subscribe',
          id: randomUUID(),
          payload: {
            query: `mutation { telemetry }`,
            variables: { message: JSON.stringify(message) },
          },
        }));
      } catch {
        // fall through — close handler or timer will reject
      }
    });

    ws.addEventListener('message', (event: { data: unknown }) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        if (msg['type'] === 'connection_ack') {
          // Daemon acknowledged — we've delivered the payload in connection_init
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try { ws.close(); } catch { /* ignore */ }
          resolve();
        }
      } catch { /* ignore malformed frames */ }
    });

    ws.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('daemon WebSocket error'));
    });

    ws.addEventListener('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Closed before we got ack — still OK to resolve (best-effort telemetry)
      resolve();
    });
  });
}

function getWebSocketClass(): WebSocketCtor | null {
  // Node 22+ native WebSocket
  const globalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof globalWebSocket !== 'undefined') {
    return globalWebSocket as WebSocketCtor;
  }
  // 'ws' npm package
  try {
    const ws = require('ws') as { default?: unknown };
    return (ws.default ?? ws) as WebSocketCtor;
  } catch {
    return null;
  }
}

export default hook;
