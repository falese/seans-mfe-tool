/**
 * Tests for src/runtime/graphql-ws-client.ts
 *
 * Covers the GraphQLWebSocketClient.mutation() lifecycle over the
 * graphql-transport-ws protocol: subscribe → next/error/timeout → complete ack.
 *
 * Refs Phase 1.1 of the production-readiness plan.
 */

import { GraphQLWebSocketClient } from '../graphql-ws-client';

const WS_OPEN = 1;
const WS_CLOSED = 3;

type MessageListener = (event: { data: unknown }) => void;

/**
 * In-test fake of the minimal WebSocket surface the client depends on.
 * Captures every frame the client sends and lets tests dispatch server
 * frames on demand.
 */
class FakeSocket {
  public readyState: number;
  public readonly sent: string[] = [];
  private listeners: MessageListener[] = [];

  constructor(readyState: number = WS_OPEN) {
    this.readyState = readyState;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  addEventListener(_type: 'message', listener: MessageListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: 'message', listener: MessageListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /** Number of active message listeners (used to assert cleanup). */
  get listenerCount(): number {
    return this.listeners.length;
  }

  /** Drive a server frame into every active listener. */
  emit(data: unknown): void {
    // Iterate a snapshot so listeners that detach themselves don't perturb the loop.
    for (const l of [...this.listeners]) l({ data });
  }
}

function parseFrame(raw: string): Record<string, unknown> {
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('GraphQLWebSocketClient', () => {
  beforeEach(() => {
    // jest.setup.js enables fake timers; ensure each test starts clean.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connected getter', () => {
    it('reports true when the underlying socket is in OPEN state', () => {
      const socket = new FakeSocket(WS_OPEN);
      const client = new GraphQLWebSocketClient(socket);

      expect(client.connected).toBe(true);
    });

    it('reports false when the underlying socket is closed', () => {
      const socket = new FakeSocket(WS_CLOSED);
      const client = new GraphQLWebSocketClient(socket);

      expect(client.connected).toBe(false);
    });
  });

  describe('mutation()', () => {
    it('throws when the socket is not connected (no frames sent)', async () => {
      const socket = new FakeSocket(WS_CLOSED);
      const client = new GraphQLWebSocketClient(socket);

      await expect(client.mutation('mutation { x }', {})).rejects.toThrow(
        /not connected/i,
      );
      expect(socket.sent).toHaveLength(0);
    });

    it('sends a subscribe frame with the supplied query/variables', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const variables = { id: 'abc', n: 7 };
      const promise = client.mutation('mutation { ack }', variables);

      // Reply with a next frame so the promise resolves and we can flush.
      expect(socket.sent).toHaveLength(1);
      const subscribe = parseFrame(socket.sent[0]);
      expect(subscribe).toMatchObject({ type: 'subscribe' });
      expect(subscribe.id).toEqual(expect.any(String));
      expect((subscribe.payload as Record<string, unknown>).query).toBe('mutation { ack }');
      expect((subscribe.payload as Record<string, unknown>).variables).toEqual(variables);

      socket.emit(
        JSON.stringify({
          type: 'next',
          id: subscribe.id,
          payload: { data: { ack: true } },
        }),
      );

      await expect(promise).resolves.toBe(true);
    });

    it('resolves with the first Boolean value from payload.data on a "next" frame', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      socket.emit(
        JSON.stringify({
          type: 'next',
          id,
          payload: { data: { ok: true } },
        }),
      );

      await expect(promise).resolves.toBe(true);

      // Client must send a "complete" ack after receiving the result.
      expect(socket.sent).toHaveLength(2);
      expect(parseFrame(socket.sent[1])).toEqual({ type: 'complete', id });

      // Listener must be detached so the socket isn't leaked.
      expect(socket.listenerCount).toBe(0);
    });

    it('resolves to false (not undefined) when payload.data is malformed', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      // payload.data exists but the first value is not a boolean.
      socket.emit(
        JSON.stringify({
          type: 'next',
          id,
          payload: { data: { ok: 'truthy-string' } },
        }),
      );

      await expect(promise).resolves.toBe(false);
    });

    it('resolves to false when payload.data is entirely absent', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      socket.emit(JSON.stringify({ type: 'next', id, payload: {} }));

      await expect(promise).resolves.toBe(false);
    });

    it('rejects with the first error message when the server sends an "error" frame', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { bad }', {});
      const id = parseFrame(socket.sent[0]).id;

      socket.emit(
        JSON.stringify({
          type: 'error',
          id,
          payload: [{ message: 'boom' }, { message: 'second' }],
        }),
      );

      await expect(promise).rejects.toThrow('boom');
      // No "complete" ack on error path.
      expect(socket.sent).toHaveLength(1);
      expect(socket.listenerCount).toBe(0);
    });

    it('uses a default error message when an "error" frame has no payload', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { bad }', {});
      const id = parseFrame(socket.sent[0]).id;

      socket.emit(JSON.stringify({ type: 'error', id }));

      await expect(promise).rejects.toThrow('GraphQL mutation error');
    });

    it('ignores frames whose id does not match the in-flight subscription', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      // Frame for a different subscription — must be ignored.
      socket.emit(
        JSON.stringify({
          type: 'next',
          id: 'some-other-id',
          payload: { data: { ok: false } },
        }),
      );

      // Promise is still pending; emit the matching next frame to settle it.
      socket.emit(
        JSON.stringify({
          type: 'next',
          id,
          payload: { data: { ok: true } },
        }),
      );

      await expect(promise).resolves.toBe(true);
    });

    it('ignores non-JSON frames without rejecting', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      // Bogus non-JSON payload — must be swallowed silently.
      socket.emit('not-json{');
      // Then the real response.
      socket.emit(
        JSON.stringify({ type: 'next', id, payload: { data: { ok: true } } }),
      );

      await expect(promise).resolves.toBe(true);
    });

    it('ignores unknown frame types (e.g. server-side "complete") without settling', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      socket.emit(JSON.stringify({ type: 'complete', id }));
      // The promise must still be pending — settle it now.
      socket.emit(
        JSON.stringify({ type: 'next', id, payload: { data: { ok: true } } }),
      );

      await expect(promise).resolves.toBe(true);
    });

    it('rejects with a timeout error if no response arrives in time', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { slow }', {}, 1_000);
      // Surface unhandled-rejection noise — attach a no-op handler immediately.
      promise.catch(() => {});

      // Fast-forward past the timeout without dispatching any server frame.
      jest.advanceTimersByTime(1_500);

      await expect(promise).rejects.toThrow(/timed out/i);
      // Listener must be detached on timeout.
      expect(socket.listenerCount).toBe(0);
    });

    it('uses the default 4000ms timeout when no override is supplied', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { x }', {});
      promise.catch(() => {});

      // 3.5s — still pending.
      jest.advanceTimersByTime(3_500);
      // Cannot assert "still pending" directly without races; instead push past
      // 4s and assert the timeout fires.
      jest.advanceTimersByTime(1_000);

      await expect(promise).rejects.toThrow(/timed out/i);
    });

    it('guards against a duplicate "next" frame settling the promise twice', async () => {
      // Construct a socket whose removeEventListener is a no-op so we can
      // drive a SECOND frame through the same handler. This exercises the
      // `if (settled) return;` guard inside the next branch.
      class LeakySocket extends FakeSocket {
        override removeEventListener(): void {
          /* deliberately leak listeners */
        }
      }

      const socket = new LeakySocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { ok }', {});
      const id = parseFrame(socket.sent[0]).id;

      socket.emit(
        JSON.stringify({ type: 'next', id, payload: { data: { ok: true } } }),
      );
      await expect(promise).resolves.toBe(true);

      // Second "next" frame for the same id — settled guard must swallow it.
      expect(() =>
        socket.emit(
          JSON.stringify({ type: 'next', id, payload: { data: { ok: false } } }),
        ),
      ).not.toThrow();

      // Same for an "error" frame after settle.
      expect(() =>
        socket.emit(
          JSON.stringify({
            type: 'error',
            id,
            payload: [{ message: 'late' }],
          }),
        ),
      ).not.toThrow();
    });

    it('guards against a stale timeout firing after a successful settle', async () => {
      // Defeat the clearTimeout(timer) path so the original setTimeout
      // callback actually runs after the next-frame settle. This drives the
      // `if (settled) return;` guard at the top of the timeout callback.
      const realClearTimeout = global.clearTimeout;
      global.clearTimeout = (() => {
        /* swallow */
      }) as unknown as typeof clearTimeout;

      class LeakySocket extends FakeSocket {
        override removeEventListener(): void {
          /* leak listeners */
        }
      }

      try {
        const socket = new LeakySocket();
        const client = new GraphQLWebSocketClient(socket);

        const promise = client.mutation('mutation { ok }', {}, 1_000);
        const id = parseFrame(socket.sent[0]).id;

        socket.emit(
          JSON.stringify({ type: 'next', id, payload: { data: { ok: true } } }),
        );
        await expect(promise).resolves.toBe(true);

        // Advance past the original timeout — timer fires, sees settled=true,
        // and must early-return without rejecting the already-resolved promise.
        expect(() => jest.advanceTimersByTime(2_000)).not.toThrow();
      } finally {
        global.clearTimeout = realClearTimeout;
      }
    });

    it('ignores a stale frame that arrives after the timeout has fired', async () => {
      const socket = new FakeSocket();
      const client = new GraphQLWebSocketClient(socket);

      const promise = client.mutation('mutation { slow }', {}, 500);
      const id = parseFrame(socket.sent[0]).id;
      promise.catch(() => {});

      jest.advanceTimersByTime(750);
      await expect(promise).rejects.toThrow(/timed out/i);

      // A late server frame must be a no-op (we've already settled and
      // detached, but defensively dispatching shouldn't throw).
      expect(() =>
        socket.emit(
          JSON.stringify({ type: 'next', id, payload: { data: { ok: true } } }),
        ),
      ).not.toThrow();
    });
  });
});
