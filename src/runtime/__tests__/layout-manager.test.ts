/**
 * LayoutManager contract tests (ADR-055).
 *
 * The manager is DOM-light by design: slot elements and the daemon transport
 * are injected, so the routing/lifecycle logic is tested without a browser.
 */
import {
  GraphQLTransportWsDaemonTransport,
  LayoutManager,
  type DaemonEnvelope,
  type ExperienceAdaptor,
  type SlotElementLike,
  type WebSocketLike,
} from '../layout-manager';

// ── Fakes ────────────────────────────────────────────────────

class FakeSlotElement implements SlotElementLike {
  innerHTML = '';
  attributes: Record<string, string> = {};
  children: unknown[] = [];
  removed = false;
  appendChild(child: unknown): unknown { this.children.push(child); return child; }
  remove(): void { this.removed = true; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  addEventListener(): void { /* not exercised in node tests */ }
}

class FakeTransport {
  onMessage: ((envelope: DaemonEnvelope) => void) | null = null;
  sent: Record<string, unknown>[] = [];
  started = false;
  stopped = false;
  start(onMessage: (envelope: DaemonEnvelope) => void): void {
    this.started = true;
    this.onMessage = onMessage;
  }
  stop(): void { this.stopped = true; }
  async send(envelope: Record<string, unknown>): Promise<void> { this.sent.push(envelope); }
  emitExperience(experience: Record<string, unknown>): void {
    this.onMessage?.({
      direction: 'COMPONENT',
      kind: 'COMPONENT_UPDATE',
      payload: { id: String(experience.id), type: 'EXPERIENCE', data: experience },
      metadata: { correlationId: 'corr-1', error: null },
    });
  }
}

function makeAdaptor() {
  const mounts: { experience: unknown; slot: FakeSlotElement }[] = [];
  const unmounts: string[] = [];
  const adaptor: ExperienceAdaptor = {
    async mount(experience, slot) {
      mounts.push({ experience, slot: slot as FakeSlotElement });
      return () => { unmounts.push((experience as { id: string }).id); };
    },
  };
  return { adaptor, mounts, unmounts };
}

function makeManager(adaptor: ExperienceAdaptor, extra: Partial<ConstructorParameters<typeof LayoutManager>[0]> = {}) {
  const host = { children: [] as unknown[], appendChild(child: unknown) { this.children.push(child); return child; } };
  const transport = new FakeTransport();
  const errors: string[] = [];
  const manager = new LayoutManager({
    container: host,
    transport,
    adaptors: { 'test/adaptor': adaptor },
    createSlotElement: () => new FakeSlotElement(),
    onError: (message) => errors.push(message),
    ...extra,
  });
  return { manager, transport, host, errors };
}

const experience = (id: string, props: Record<string, unknown> = {}) => ({
  id,
  mfe: 'csv-analyzer',
  capability: 'DataAnalysis',
  output: { hello: true },
  contentType: 'test/adaptor',
  props,
  createdAt: new Date().toISOString(),
});

const flush = () => new Promise((resolve) => { void Promise.resolve().then(resolve); });

// ── Tests ────────────────────────────────────────────────────

describe('LayoutManager', () => {
  it('starts 100% empty — no slots until the daemon signals', () => {
    const { adaptor } = makeAdaptor();
    const { manager, host } = makeManager(adaptor);
    manager.start();
    expect(manager.activeSlots).toEqual([]);
    expect(host.children).toHaveLength(0);
  });

  it('mounts an EXPERIENCE into the default "main" slot via its adaptor', async () => {
    const { adaptor, mounts } = makeAdaptor();
    const { manager, transport, host } = makeManager(adaptor);
    manager.start();

    transport.emitExperience(experience('e-1'));
    await flush();

    expect(manager.activeSlots).toEqual(['main']);
    expect(host.children).toHaveLength(1);
    expect(mounts).toHaveLength(1);
    expect((mounts[0].experience as { id: string }).id).toBe('e-1');
    expect(mounts[0].slot.attributes['data-layout-slot']).toBe('main');
  });

  it('routes experiences to named slots via props.slot — slots coexist', async () => {
    const { adaptor, mounts } = makeAdaptor();
    const { manager, transport } = makeManager(adaptor);
    manager.start();

    transport.emitExperience(experience('e-1', { slot: 'sidebar' }));
    transport.emitExperience(experience('e-2', { slot: 'main' }));
    await flush();

    expect(manager.activeSlots.sort()).toEqual(['main', 'sidebar']);
    expect(mounts).toHaveLength(2);
  });

  it('replacing the experience in a slot unmounts the previous one', async () => {
    const { adaptor, mounts, unmounts } = makeAdaptor();
    const { manager, transport } = makeManager(adaptor);
    manager.start();

    transport.emitExperience(experience('e-1'));
    await flush();
    transport.emitExperience(experience('e-2'));
    await flush();

    expect(unmounts).toEqual(['e-1']);
    expect(mounts).toHaveLength(2);
    expect(manager.activeSlots).toEqual(['main']);
  });

  it('reports an error for unknown contentTypes instead of throwing', async () => {
    const { adaptor } = makeAdaptor();
    const { manager, transport, errors } = makeManager(adaptor);
    manager.start();

    transport.emitExperience({ ...experience('e-1'), contentType: 'application/wasm' });
    await flush();

    expect(errors[0]).toMatch(/No adaptor registered .* "application\/wasm"/);
    expect(manager.activeSlots).toEqual([]);
  });

  it('surfaces RESOLUTION_ERROR components through onError', async () => {
    const { adaptor } = makeAdaptor();
    const { manager, transport, errors } = makeManager(adaptor);
    manager.start();

    transport.onMessage?.({
      kind: 'COMPONENT_UPDATE',
      payload: { id: 'x', type: 'RESOLUTION_ERROR', data: { mfe: 'm', capability: 'C', reason: 'down' } },
    });
    await flush();

    expect(errors[0]).toBe('MFE resolution failed: m.C: down');
  });

  it('reports adaptor mount failures with MFE identity and slot', async () => {
    const failing: ExperienceAdaptor = { async mount() { throw new Error('boom'); } };
    const { manager, transport, errors } = makeManager(failing);
    manager.start();

    transport.emitExperience(experience('e-1'));
    await flush();

    expect(errors[0]).toMatch(/csv-analyzer\.DataAnalysis in slot "main": boom/);
  });

  it('sendAction carries the session context up the control plane', async () => {
    const { adaptor } = makeAdaptor();
    const session = { sessionId: 's-1', user: { id: 'u-1' }, application: 'web' };
    const { manager, transport } = makeManager(adaptor, { session });
    manager.start();

    await manager.sendAction('e-1', 'CLICK', { x: 1 });

    expect(transport.sent).toHaveLength(1);
    const envelope = transport.sent[0] as { direction: string; payload: { context: unknown; actionType: string } };
    expect(envelope.direction).toBe('ACTION');
    expect(envelope.payload.actionType).toBe('CLICK');
    expect(envelope.payload.context).toEqual(session);
  });

  it('stop() closes the transport and unmounts every slot', async () => {
    const { adaptor, unmounts } = makeAdaptor();
    const { manager, transport } = makeManager(adaptor);
    manager.start();
    transport.emitExperience(experience('e-1'));
    await flush();

    await manager.stop();

    expect(transport.stopped).toBe(true);
    expect(unmounts).toEqual(['e-1']);
  });
});

describe('GraphQLTransportWsDaemonTransport', () => {
  function makeSocket() {
    const socket: WebSocketLike & { sentFrames: string[] } = {
      sentFrames: [],
      send(data: string) { this.sentFrames.push(data); },
      close() { this.onclose?.(); },
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    return socket;
  }

  it('performs the graphql-transport-ws handshake then subscribes to messages', () => {
    const socket = makeSocket();
    const transport = new GraphQLTransportWsDaemonTransport('ws://daemon/graphql', () => socket);
    const received: DaemonEnvelope[] = [];
    const statuses: string[] = [];

    transport.start((envelope) => received.push(envelope), (status) => statuses.push(status));
    socket.onopen?.();
    expect(JSON.parse(socket.sentFrames[0]).type).toBe('connection_init');

    socket.onmessage?.({ data: JSON.stringify({ type: 'connection_ack' }) });
    const subscribe = JSON.parse(socket.sentFrames[1]);
    expect(subscribe.type).toBe('subscribe');
    expect(subscribe.payload.query).toContain('subscription { messages');
    expect(statuses).toEqual(['connecting', 'connected']);

    socket.onmessage?.({
      data: JSON.stringify({ type: 'next', payload: { data: { messages: { kind: 'COMPONENT_UPDATE' } } } }),
    });
    expect(received).toHaveLength(1);
    transport.stop();
  });

  it('send() fires the sendMessage mutation once connected, throws before', async () => {
    const socket = makeSocket();
    const transport = new GraphQLTransportWsDaemonTransport('ws://daemon/graphql', () => socket);
    transport.start(() => undefined);

    await expect(transport.send({ direction: 'ACTION' })).rejects.toThrow(/not connected/);

    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({ type: 'connection_ack' }) });
    await transport.send({ direction: 'ACTION' });

    const mutation = JSON.parse(socket.sentFrames[socket.sentFrames.length - 1]);
    expect(mutation.payload.query).toContain('sendMessage');
    expect(JSON.parse(mutation.payload.variables.message).direction).toBe('ACTION');
    transport.stop();
  });

  it('answers protocol pings with pongs', () => {
    const socket = makeSocket();
    const transport = new GraphQLTransportWsDaemonTransport('ws://daemon/graphql', () => socket);
    transport.start(() => undefined);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({ type: 'ping' }) });
    expect(socket.sentFrames.some((frame) => JSON.parse(frame).type === 'pong')).toBe(true);
    transport.stop();
  });
});
