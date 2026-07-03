/**
 * Daemon transport for the LayoutManager (ADR-055): a self-contained
 * graphql-transport-ws client for the daemon's `messages` subscription and
 * `sendMessage` mutation, with bounded-backoff reconnect. Deliberately
 * dependency-free so the runtime ships no WS library.
 */

// ── Daemon transport (graphql-transport-ws) ──────────────────

export interface DaemonTransport {
  /** Open the `messages` subscription; deliver each envelope to onMessage. */
  start(onMessage: (envelope: DaemonEnvelope) => void, onStatus?: (s: TransportStatus) => void): void;
  stop(): void;
  /** Fire the sendMessage mutation with a JSON-encoded envelope. */
  send(envelope: Record<string, unknown>): Promise<void>;
}

export type TransportStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * The transport envelope delivered on the daemon's `messages` subscription.
 *
 * This is NOT the logical `Message` (ADR-054). The downward payload is wrapped
 * in a component envelope: `kind: 'COMPONENT_UPDATE'` with `payload.type`
 * (`'EXPERIENCE' | 'RESOLUTION_ERROR'`) discriminating the envelope and
 * `payload.data` carrying the ADR-054 `RenderedExperience`. The `type`
 * discriminator is an envelope tag, not a revived CARD/FORM/NOTIFICATION
 * component type (ADR-054 "Wire envelope vs logical message").
 */
export interface DaemonEnvelope {
  direction?: string;
  kind?: string;
  payload?: {
    id?: string;
    type?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  };
  metadata?: { correlationId?: string; acknowledged?: boolean; error?: string | null };
}

/** Minimal WebSocket surface so tests can inject a fake socket factory. */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((err: unknown) => void) | null;
}

const RECONNECT_BASE_MS = 400;
const RECONNECT_MAX_MS = 5_000;
const RECONNECT_FACTOR = 1.6;

/**
 * Self-contained graphql-transport-ws client for the daemon's `messages`
 * subscription and `sendMessage` mutation, with bounded-backoff reconnect.
 */
export class GraphQLTransportWsDaemonTransport implements DaemonTransport {
  private socket: WebSocketLike | null = null;
  private stopped = false;
  private attempt = 0;
  private acked = false;

  constructor(
    private readonly url: string,
    private readonly createSocket: (url: string, protocol: string) => WebSocketLike
  ) {}

  start(onMessage: (envelope: DaemonEnvelope) => void, onStatus?: (s: TransportStatus) => void): void {
    this.stopped = false;
    const connect = (): void => {
      if (this.stopped) return;
      onStatus?.('connecting');
      const socket = this.createSocket(this.url, 'graphql-transport-ws');
      this.socket = socket;
      this.acked = false;

      socket.onopen = () => socket.send(JSON.stringify({ type: 'connection_init' }));
      socket.onmessage = (event) => {
        let frame: { type?: string; payload?: { data?: { messages?: DaemonEnvelope } } };
        try {
          frame = JSON.parse(event.data) as typeof frame;
        } catch {
          return;
        }
        if (frame.type === 'connection_ack') {
          this.acked = true;
          this.attempt = 0;
          onStatus?.('connected');
          socket.send(JSON.stringify({
            id: 'layout-sub',
            type: 'subscribe',
            payload: { query: 'subscription { messages { direction kind payload metadata { correlationId acknowledged error } } }' },
          }));
        } else if (frame.type === 'next' && frame.payload?.data?.messages) {
          onMessage(frame.payload.data.messages);
        } else if (frame.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      };
      socket.onclose = () => {
        onStatus?.('disconnected');
        if (this.stopped) return;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(RECONNECT_FACTOR, this.attempt++));
        setTimeout(connect, delay);
      };
      socket.onerror = () => { /* onclose drives the reconnect */ };
    };
    connect();
  }

  stop(): void {
    this.stopped = true;
    this.socket?.close();
    this.socket = null;
  }

  async send(envelope: Record<string, unknown>): Promise<void> {
    if (!this.socket || !this.acked) {
      throw new Error('LayoutManager: daemon transport is not connected');
    }
    this.socket.send(JSON.stringify({
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'subscribe',
      payload: {
        query: 'mutation($message: String!) { sendMessage(message: $message) }',
        variables: { message: JSON.stringify(envelope) },
      },
    }));
  }
}
