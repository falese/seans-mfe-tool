/**
 * GraphQL WebSocket client for the daemon control plane.
 *
 * Wraps an existing graphql-transport-ws connection and adds a fire-and-collect
 * .mutation() helper used by RemoteMFE.doUpdateControlPlaneState().
 *
 * The underlying WebSocket is created and owned by the Renderer (same socket
 * used for the Subscription.messages channel). RemoteMFE receives it via
 * BaseMFEDependencies.wsClient.
 */

/**
 * Minimal interface for the socket so tests can inject fakes without depending
 * on the browser WebSocket class.
 */
interface MinimalSocket {
  readonly readyState: number;
  send(data: string): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void;
}

/** graphql-transport-ws readyState open value */
const WS_OPEN = 1;

/**
 * Platform-facing interface used in BaseMFEDependencies.
 * Keeps the abstract base class decoupled from the concrete implementation.
 */
export interface DaemonWebSocketClient {
  /** True when the underlying socket is open and ready to send frames. */
  readonly connected: boolean;

  /**
   * Execute a GraphQL mutation over the existing WS connection using the
   * graphql-transport-ws subscribe/next/complete protocol.
   *
   * @param query      Full GraphQL mutation string
   * @param variables  Variables map
   * @param timeoutMs  Abort after this many ms (default 4 000, matches DaemonService.forwardTimeoutMs)
   * @returns Resolves with the Boolean result of the mutation
   * @throws Error on timeout or GraphQL-level errors
   */
  mutation(
    query: string,
    variables: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<boolean>;
}

/**
 * Concrete implementation of DaemonWebSocketClient.
 *
 * Protocol sketch for a mutation over graphql-transport-ws:
 *   1. Client → `{ type: "subscribe", id, payload: { query, variables } }`
 *   2. Server → `{ type: "next",      id, payload: { data: { <field>: <value> } } }`
 *   3. Server → `{ type: "complete",  id }`                (server signals done)
 *   4. Client → `{ type: "complete",  id }`                (client acknowledges)
 *
 * We resolve on step 2 (first "next" frame) and send the client-side "complete"
 * immediately after to free server-side resources.
 */
export class GraphQLWebSocketClient implements DaemonWebSocketClient {
  private readonly socket: MinimalSocket;

  constructor(socket: MinimalSocket) {
    this.socket = socket;
  }

  get connected(): boolean {
    return this.socket.readyState === WS_OPEN;
  }

  async mutation(
    query: string,
    variables: Record<string, unknown>,
    timeoutMs = 4_000,
  ): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Daemon WebSocket not connected');
    }

    const id = crypto.randomUUID();

    return new Promise<boolean>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.socket.removeEventListener('message', onMessage);
        reject(new Error('sendMessage timed out'));
      }, timeoutMs);

      const onMessage = (event: { data: unknown }) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data as string) as Record<string, unknown>;
        } catch {
          return; // ignore non-JSON frames
        }

        if (msg['id'] !== id) return;

        if (msg['type'] === 'next') {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.socket.removeEventListener('message', onMessage);

          // Send client-side complete to acknowledge receipt
          this.socket.send(JSON.stringify({ type: 'complete', id }));

          // Extract the Boolean result from payload.data.<firstField>.
          // Default to false (safe) when the field is absent or not a boolean,
          // so a malformed response doesn't silently count as acknowledged.
          const payload = msg['payload'] as Record<string, unknown> | undefined;
          const data = payload?.['data'] as Record<string, unknown> | undefined;
          const firstValue = data ? Object.values(data)[0] : undefined;
          resolve(typeof firstValue === 'boolean' ? firstValue : false);
        } else if (msg['type'] === 'error') {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.socket.removeEventListener('message', onMessage);

          const errors = msg['payload'] as Array<{ message?: string }> | undefined;
          const message = errors?.[0]?.message ?? 'GraphQL mutation error';
          reject(new Error(message));
        }
      };

      this.socket.addEventListener('message', onMessage);

      this.socket.send(
        JSON.stringify({ type: 'subscribe', id, payload: { query, variables } }),
      );
    });
  }
}
