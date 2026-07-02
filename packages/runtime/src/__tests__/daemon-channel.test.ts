/**
 * DaemonChannel (ADR-057) — a virtual control-plane channel over the host's
 * single daemon socket. It must satisfy the DaemonWebSocketClient port so a
 * composed MFE's updateControlPlaneState works, while routing every envelope
 * through the one shared transport and stamping it with the channel id.
 */
import { DaemonChannel, type ChannelTransport } from '../daemon-channel';

function fakeTransport() {
  const sent: Record<string, unknown>[] = [];
  const transport: ChannelTransport & { sent: Record<string, unknown>[] } = {
    sent,
    async send(envelope) {
      sent.push(envelope);
    },
  };
  return transport;
}

const SEND_MSG = 'mutation sendMessage($m: String!) { sendMessage(message: $m) }';

describe('DaemonChannel', () => {
  it('reports connected from the host transport status, holding no socket of its own', () => {
    const transport = fakeTransport();
    let connected = false;
    const channel = new DaemonChannel(transport, 'main', () => connected);
    expect(channel.connected).toBe(false);
    connected = true;
    expect(channel.connected).toBe(true);
  });

  it('routes a sendMessage envelope over the shared transport, stamped with the channel id', async () => {
    const transport = fakeTransport();
    const channel = new DaemonChannel(transport, 'menu', () => true);

    const envelope = {
      direction: 'ACTION',
      kind: 'ACTION',
      payload: { id: 'a1', componentId: 'app', actionType: 'STATE_UPDATE', stateKey: 'abc.play.flappy', data: {}, timestamp: 't' },
      metadata: { correlationId: 'a1', acknowledged: false, error: null },
    };

    const ok = await channel.mutation(SEND_MSG, { m: JSON.stringify(envelope) });

    expect(ok).toBe(true);
    expect(transport.sent).toHaveLength(1);
    const routed = transport.sent[0] as { payload: { stateKey: string }; metadata: { channel: string; correlationId: string } };
    expect(routed.payload.stateKey).toBe('abc.play.flappy');
    expect(routed.metadata.channel).toBe('menu'); // per-slot attribution
    expect(routed.metadata.correlationId).toBe('a1'); // existing metadata preserved
  });

  it('composes a nested channel id into a path (recursive hosts)', async () => {
    const transport = fakeTransport();
    const parent = new DaemonChannel(transport, 'main', () => true);
    const child = parent.child('quiz');
    expect(child.id).toBe('main/quiz');

    await child.mutation(SEND_MSG, { m: JSON.stringify({ metadata: {} }) });
    expect((transport.sent[0] as { metadata: { channel: string } }).metadata.channel).toBe('main/quiz');
  });

  it('returns false without touching the transport when there is no envelope to route', async () => {
    const transport = fakeTransport();
    const channel = new DaemonChannel(transport, 'main', () => true);
    expect(await channel.mutation(SEND_MSG, {})).toBe(false);
    expect(await channel.mutation(SEND_MSG, { m: '{not json' })).toBe(false);
    expect(transport.sent).toHaveLength(0);
  });
});
