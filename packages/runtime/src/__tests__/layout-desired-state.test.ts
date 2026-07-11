/**
 * Desired-state placement (ADR-066): the daemon's placements are desired state
 * addressed by declared slot ids; binding to elements is deferred and
 * reconciled. Placement must never depend on the ordering between an
 * EXPERIENCE arriving and the slot being provided — every ordering converges
 * to the same binding, re-provision re-binds instead of destroying, replay is
 * idempotent, and slot topology is signalled up the control plane. Refs #265.
 */
import {
  LayoutManager,
  type DaemonEnvelope,
  type ExperienceAdaptor,
  type SlotElementLike,
} from '../layout-manager';

class FakeSlotElement implements SlotElementLike {
  innerHTML = '';
  attributes: Record<string, string> = {};
  children: unknown[] = [];
  removed = false;
  constructor(public readonly tag = 'slot') {}
  appendChild(child: unknown): unknown {
    this.children.push(child);
    return child;
  }
  remove(): void {
    this.removed = true;
  }
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  addEventListener(): void {}
}

class FakeTransport {
  onMessage: ((e: DaemonEnvelope) => void) | null = null;
  sent: Record<string, unknown>[] = [];
  start(onMessage: (e: DaemonEnvelope) => void): void {
    this.onMessage = onMessage;
  }
  stop(): void {}
  async send(envelope: Record<string, unknown>): Promise<void> {
    this.sent.push(envelope);
  }
  emit(experience: Record<string, unknown>): void {
    this.onMessage?.({
      direction: 'COMPONENT',
      kind: 'COMPONENT_UPDATE',
      payload: { id: String(experience.id), type: 'EXPERIENCE', data: experience },
      metadata: { correlationId: 'c', error: null },
    });
  }
}

// Drain the full async mount chain (see layout-provided-slots.test.ts).
const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

const experience = (
  id: string,
  contentType: string,
  props: Record<string, unknown>,
  mfe = id
) => ({
  id,
  mfe,
  capability: 'X',
  output: {},
  contentType,
  props,
  createdAt: new Date().toISOString(),
});

/** Extract the ActionRecords of one actionType sent up the transport. */
const actionsOf = (transport: FakeTransport, actionType: string): Record<string, unknown>[] =>
  transport.sent
    .map((envelope) => envelope.payload)
    .filter(
      (payload): payload is Record<string, unknown> =>
        typeof payload === 'object' && payload !== null &&
        (payload as Record<string, unknown>).actionType === actionType
    );

/** A game adaptor that records every element it mounts into and its unmounts. */
const trackingAdaptor = () => {
  const mounts: SlotElementLike[] = [];
  let unmounts = 0;
  const adaptor: ExperienceAdaptor = {
    async mount(_exp, slot) {
      mounts.push(slot);
      return () => {
        unmounts += 1;
      };
    },
  };
  return { adaptor, mounts, unmounts: () => unmounts };
};

const makeHost = () => ({
  children: [] as unknown[],
  appendChild(c: unknown) {
    this.children.push(c);
    return c;
  },
});

describe('LayoutManager — desired-state placement (ADR-066)', () => {
  it('re-binds an already-mounted experience into a later-provided element instead of destroying it', async () => {
    const providedMain = new FakeSlotElement('mfe-main');
    const hostCreated: FakeSlotElement[] = [];
    const game = trackingAdaptor();
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        helpers.provideSlot?.('main', providedMain);
      },
    };

    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: { 'test/layout': layoutAdaptor, 'test/game': game.adaptor },
      createSlotElement: () => {
        const el = new FakeSlotElement('host-created');
        hostCreated.push(el);
        return el;
      },
    });
    manager.start();

    // The daemon places the game BEFORE any provider registers 'main' — the
    // host auto-creates a slot (ADR-055) and mounts there.
    transport.emit(experience('flappy', 'test/game', { slot: 'layout/main' }));
    await flush();
    expect(game.mounts).toHaveLength(1);

    // The layout MFE arrives late and provides 'main'. The placement must
    // survive: the game re-binds into the provided element; the auto-created
    // placeholder is unmounted and removed, not the experience.
    transport.emit(experience('layout', 'test/layout', { slot: 'root' }));
    await flush();

    expect(game.mounts).toHaveLength(2);
    expect(game.mounts[1]).toBe(providedMain);
    expect(game.unmounts()).toBe(1); // the placeholder binding, torn down once
    const mainPlaceholders = hostCreated.filter(
      (el) => el.attributes['data-layout-slot'] === 'layout/main'
    );
    expect(mainPlaceholders).toHaveLength(1);
    expect(mainPlaceholders[0].removed).toBe(true);
    expect(manager.activeSlots.filter((s) => s === 'layout/main')).toHaveLength(1);
  });

  it('converges to the same binding regardless of experience/provision ordering', async () => {
    const run = async (order: 'slot-first' | 'experience-first') => {
      const providedMain = new FakeSlotElement('mfe-main');
      const game = trackingAdaptor();
      const layoutAdaptor: ExperienceAdaptor = {
        async mount(_exp, _slot, helpers) {
          helpers.provideSlot?.('main', providedMain);
        },
      };
      const transport = new FakeTransport();
      const manager = new LayoutManager({
        container: makeHost(),
        transport,
        adaptors: { 'test/layout': layoutAdaptor, 'test/game': game.adaptor },
        createSlotElement: () => new FakeSlotElement(),
      });
      manager.start();

      const events = [
        () => transport.emit(experience('layout', 'test/layout', { slot: 'root' })),
        () => transport.emit(experience('flappy', 'test/game', { slot: 'layout/main' })),
      ];
      if (order === 'experience-first') events.reverse();
      for (const fire of events) {
        fire();
        await flush();
      }
      return game.mounts[game.mounts.length - 1];
    };

    const slotFirst = await run('slot-first');
    const experienceFirst = await run('experience-first');
    expect(slotFirst.tag).toBe('mfe-main');
    expect(experienceFirst.tag).toBe('mfe-main');
  });

  it('re-provision re-binds the occupying experience into the new element', async () => {
    const first = new FakeSlotElement('first');
    const second = new FakeSlotElement('second');
    const provided = [first, second];
    let i = 0;
    const game = trackingAdaptor();
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        helpers.provideSlot?.('main', provided[i++]);
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: { 'test/layout': layoutAdaptor, 'test/game': game.adaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout-a', 'test/layout', { slot: 'root' }, 'layout'));
    await flush();
    transport.emit(experience('flappy', 'test/game', { slot: 'layout/main' }));
    await flush();
    expect(game.mounts[0]).toBe(first);

    // Replacing the provider must carry the game to the new element — a
    // provision is a change of where 'main' is bound, not a teardown of what
    // the registry placed there.
    transport.emit(experience('layout-b', 'test/layout', { slot: 'root' }, 'layout'));
    await flush();
    expect(game.mounts).toHaveLength(2);
    expect(game.mounts[1]).toBe(second);
    expect(game.unmounts()).toBe(1);
  });

  it('replaying the same experience at the same address is idempotent; a new experience replaces', async () => {
    const game = trackingAdaptor();
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: { 'test/game': game.adaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('flappy', 'test/game', { slot: 'main' }));
    await flush();
    // Reconnect replay: same experience id at the same address → no remount.
    transport.emit(experience('flappy', 'test/game', { slot: 'main' }));
    await flush();
    expect(game.mounts).toHaveLength(1);
    expect(game.unmounts()).toBe(0);

    // A different experience at the address is a replacement, as before.
    transport.emit(experience('hockey', 'test/game', { slot: 'main' }));
    await flush();
    expect(game.mounts).toHaveLength(2);
    expect(game.unmounts()).toBe(1);
  });

  it('signals SLOT_PROVIDED and SLOT_RELEASED up the control plane', async () => {
    const providedMain = new FakeSlotElement('mfe-main');
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        helpers.provideSlot?.('main', providedMain);
      },
    };
    const plainAdaptor: ExperienceAdaptor = {
      async mount() {
        return () => undefined;
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: { 'test/layout': layoutAdaptor, 'test/plain': plainAdaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout', 'test/layout', { slot: 'root' }));
    await flush();
    const provided = actionsOf(transport, 'SLOT_PROVIDED');
    expect(provided).toHaveLength(1);
    expect(provided[0].componentId).toBe('layout');
    expect(provided[0].data).toEqual({ slot: 'layout/main' });

    // Replacing the provider releases its slots — the registry hears it.
    transport.emit(experience('other', 'test/plain', { slot: 'root' }));
    await flush();
    const released = actionsOf(transport, 'SLOT_RELEASED');
    expect(released).toHaveLength(1);
    expect(released[0].componentId).toBe('layout');
    expect(released[0].data).toEqual({ slot: 'layout/main' });
  });

  it('scopes identical declared slot ids by provider MFE', async () => {
    const provided = {
      'layout-a': new FakeSlotElement('layout-a-main'),
      'layout-b': new FakeSlotElement('layout-b-main'),
    };
    const gameA = trackingAdaptor();
    const gameB = trackingAdaptor();
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(exp, _slot, helpers) {
        helpers.provideSlot?.('main', provided[exp.mfe as keyof typeof provided]);
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: {
        'test/layout': layoutAdaptor,
        'test/game-a': gameA.adaptor,
        'test/game-b': gameB.adaptor,
      },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout-a-instance', 'test/layout', { slot: 'root-a' }, 'layout-a'));
    transport.emit(experience('layout-b-instance', 'test/layout', { slot: 'root-b' }, 'layout-b'));
    await flush();
    transport.emit(experience('game-a', 'test/game-a', { slot: 'layout-a/main' }));
    transport.emit(experience('game-b', 'test/game-b', { slot: 'layout-b/main' }));
    await flush();

    expect(gameA.mounts).toEqual([provided['layout-a']]);
    expect(gameB.mounts).toEqual([provided['layout-b']]);
    expect(manager.activeSlots).toEqual(
      expect.arrayContaining(['layout-a/main', 'layout-b/main'])
    );
  });

  it('does not let an old provider instance release its replacement', async () => {
    const first = new FakeSlotElement('first');
    const second = new FakeSlotElement('second');
    const elements = new Map([
      ['layout-old', first],
      ['layout-new', second],
    ]);
    const game = trackingAdaptor();
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(exp, _slot, helpers) {
        helpers.provideSlot?.('main', elements.get(exp.id)!);
      },
    };
    const plainAdaptor: ExperienceAdaptor = {
      async mount() {
        return () => undefined;
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: {
        'test/layout': layoutAdaptor,
        'test/game': game.adaptor,
        'test/plain': plainAdaptor,
      },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout-old', 'test/layout', { slot: 'root-old' }, 'layout'));
    await flush();
    transport.emit(experience('game', 'test/game', { slot: 'layout/main' }));
    await flush();
    transport.emit(experience('layout-new', 'test/layout', { slot: 'root-new' }, 'layout'));
    await flush();
    expect(game.mounts[game.mounts.length - 1]).toBe(second);

    transport.emit(experience('replacement', 'test/plain', { slot: 'root-old' }));
    await flush();

    expect(manager.activeSlots).toContain('layout/main');
    expect(game.mounts[game.mounts.length - 1]).toBe(second);
    expect(game.unmounts()).toBe(1);
  });

  it('serializes overlapping replacements so the latest provider wins', async () => {
    const elements = new Map([
      ['layout-old', new FakeSlotElement('old')],
      ['layout-middle', new FakeSlotElement('middle')],
      ['layout-new', new FakeSlotElement('new')],
    ]);
    const mounts: SlotElementLike[] = [];
    const releaseUnmount: Array<() => void> = [];
    const gameAdaptor: ExperienceAdaptor = {
      async mount(_exp, slot) {
        mounts.push(slot);
        return () =>
          new Promise<void>((resolve) => {
            releaseUnmount.push(resolve);
          });
      },
    };
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(exp, _slot, helpers) {
        helpers.provideSlot?.('main', elements.get(exp.id)!);
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: {
        'test/layout': layoutAdaptor,
        'test/game': gameAdaptor,
      },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout-old', 'test/layout', { slot: 'root-old' }, 'layout'));
    await flush();
    transport.emit(experience('game', 'test/game', { slot: 'layout/main' }));
    await flush();

    transport.emit(
      experience('layout-middle', 'test/layout', { slot: 'root-middle' }, 'layout')
    );
    await flush();
    transport.emit(experience('layout-new', 'test/layout', { slot: 'root-new' }, 'layout'));
    await flush();
    expect(releaseUnmount).toHaveLength(1);

    releaseUnmount[0]();
    await flush();
    expect(releaseUnmount).toHaveLength(2);
    releaseUnmount[1]();
    await flush();

    expect(manager.activeSlots).toContain('layout/main');
    expect(mounts[mounts.length - 1]).toBe(elements.get('layout-new'));
  });

  it('releases a conditionally unmounted slot and re-binds when it returns', async () => {
    const first = new FakeSlotElement('first');
    const second = new FakeSlotElement('second');
    const game = trackingAdaptor();
    let provideSlot:
      | ((slotId: string, element: SlotElementLike | null) => void)
      | undefined;
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        provideSlot = helpers.provideSlot;
        provideSlot?.('main', first);
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport,
      adaptors: { 'test/layout': layoutAdaptor, 'test/game': game.adaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout', 'test/layout', { slot: 'root' }));
    await flush();
    transport.emit(experience('game', 'test/game', { slot: 'layout/main' }));
    await flush();

    provideSlot?.('main', null);
    await flush();
    expect(manager.activeSlots).not.toContain('layout/main');
    expect(game.unmounts()).toBe(1);

    provideSlot?.('main', second);
    await flush();
    expect(manager.activeSlots).toContain('layout/main');
    expect(game.mounts[game.mounts.length - 1]).toBe(second);
  });
});
