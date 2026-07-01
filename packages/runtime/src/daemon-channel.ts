/**
 * DaemonChannel — a virtual control-plane channel over the host's single
 * daemon socket (ADR-057).
 *
 * The host (LayoutManager, ADR-055) owns exactly one physical
 * graphql-transport-ws connection. Each layout slot — and, recursively, each
 * MFE composed within a slot — gets its own DaemonChannel, injected as the
 * MFE's `deps.wsClient` via `BaseMFE.attachControlPlane`. The channel
 * implements `DaemonWebSocketClient`, so the platform capability
 * `updateControlPlaneState` works unchanged, but every channel multiplexes onto
 * the one socket instead of opening its own.
 *
 * Outbound envelopes are stamped with the channel id (`metadata.channel`) so
 * the control plane — and the host — can reason about which slot/MFE a signal
 * came from. Nested hosts compose the id into a path (`main` → `main/quiz`).
 *
 * Framework-neutral and DOM-free: it depends only on the neutral transport
 * `send()` and the `DaemonWebSocketClient` port (ADR-056 boundary).
 */
import type { DaemonWebSocketClient } from './graphql-ws-client';

/** The neutral slice of the host transport a channel rides — just `send`. */
export interface ChannelTransport {
  send(envelope: Record<string, unknown>): Promise<void>;
}

export class DaemonChannel implements DaemonWebSocketClient {
  constructor(
    private readonly transport: ChannelTransport,
    private readonly channelId: string,
    private readonly isConnected: () => boolean
  ) {}

  /** True when the host's single physical socket is open. */
  get connected(): boolean {
    return this.isConnected();
  }

  /** The channel's address (slot id, or nested path for recursive hosts). */
  get id(): string {
    return this.channelId;
  }

  /**
   * Open a nested channel for an MFE composed inside this one. The id composes
   * into a path so the control plane reasons about nested slots uniformly.
   */
  child(subId: string): DaemonChannel {
    return new DaemonChannel(this.transport, `${this.channelId}/${subId}`, this.isConnected);
  }

  /**
   * `updateControlPlaneState` sends `sendMessage($m)` with `m` = a JSON-encoded
   * action envelope. Decode it, stamp the channel id for per-slot attribution,
   * and route it over the host's single socket rather than opening a new one.
   * Returns true once the envelope is handed to the transport.
   */
  async mutation(
    _query: string,
    variables: Record<string, unknown>,
    _timeoutMs?: number
  ): Promise<boolean> {
    const raw = variables?.m;
    if (typeof raw !== 'string') return false;

    let envelope: Record<string, unknown>;
    try {
      envelope = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return false;
    }

    const metadata = (envelope.metadata as Record<string, unknown> | undefined) ?? {};
    envelope.metadata = { ...metadata, channel: this.channelId };
    await this.transport.send(envelope);
    return true;
  }
}
