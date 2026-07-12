/**
 * Per-address lifecycle serialization (ADR-066/068): every mutation of an
 * address — bind, clear, provide, release — runs through one serialized
 * operation queue per address, so overlapping placements can never leak a
 * mounted island, a throwing teardown can never strand the replacement, and
 * an experience re-placed at a new address is cleared from its old one
 * (an experience id occupies at most one address). Refs #265.
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
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
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

const makeHost = () => ({
  children: [] as unknown[],
  appendChild(c: unknown) {
    this.children.push(c);
    return c;
  },
});

describe('LayoutManager — per-address lifecycle serialization (ADR-066/068)', () => {
  it('unmounts a superseded experience whose mount resolves late — no leaked islands', async () => {
    const events: string[] = [];
    let releaseFirstMount: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirstMount = resolve;
    });
    const slowAdaptor: ExperienceAdaptor = {
      async mount(exp) {
        events.push(`mount:${exp.id}`);
        if (exp.id === 'A') await gate; // A's remoteEntry loads slowly
        return () => {
          events.push(`unmount:${exp.id}`);
        };
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/game': slowAdaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('A', 'test/game', { slot: 'main' }));
    await flush(); // A's mount is in flight, parked on the gate
    transport.emit(experience('B', 'test/game', { slot: 'main' })); // registry replaces A
    await flush();
    releaseFirstMount?.(); // A's slow mount finally resolves
    await flush();
    transport.emit(experience('C', 'test/game', { slot: 'main' })); // replace again
    await flush();
    await manager.stop();

    // Every mounted experience is unmounted exactly once — nothing leaks, and
    // a late-resolving superseded mount cannot clobber its replacement's
    // teardown handle.
    for (const id of ['A', 'B', 'C']) {
      expect(events.filter((e) => e === `mount:${id}`).length).toBe(
        events.filter((e) => e === `unmount:${id}`).length
      );
    }
    // The last unmount belongs to the last content standing.
    expect(events[events.length - 1]).toBe('unmount:C');
  });

  it('a throwing unmount surfaces via onError and never strands the replacement', async () => {
    const events: string[] = [];
    const errors: string[] = [];
    const adaptor: ExperienceAdaptor = {
      async mount(exp) {
        events.push(`mount:${exp.id}`);
        if (exp.id === 'A') {
          return () => {
            throw new Error('legacy unmount blew up');
          };
        }
        return () => {
          events.push(`unmount:${exp.id}`);
        };
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/game': adaptor },
      createSlotElement: () => new FakeSlotElement(),
      onError: (m) => errors.push(m),
    });
    manager.start();

    transport.emit(experience('A', 'test/game', { slot: 'main' }));
    await flush();
    transport.emit(experience('B', 'test/game', { slot: 'main' }));
    await flush();

    expect(events).toContain('mount:B'); // desired-state convergence holds
    expect(errors.some((m) => m.includes('legacy unmount blew up'))).toBe(true);
  });

  it('re-placing an experience at a new address clears its previous placement', async () => {
    const live = new Set<string>();
    const gameAdaptor: ExperienceAdaptor = {
      async mount(exp, slot) {
        const key = `${exp.id}@${(slot as FakeSlotElement).attributes['data-layout-slot']}`;
        live.add(key);
        return () => live.delete(key);
      },
    };
    // Layout adaptor provides 'main' and 'info' regions, releasing on unmount.
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        const main = new FakeSlotElement();
        const info = new FakeSlotElement();
        helpers.provideSlot?.('main', main as never);
        helpers.provideSlot?.('info', info as never);
        return () => {
          helpers.provideSlot?.('main', null);
          helpers.provideSlot?.('info', null);
        };
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/game': gameAdaptor, 'test/layout': layoutAdaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('home', 'test/layout', { slot: 'root' }, 'home'));
    await flush();
    // Registry first places game G at home/info…
    transport.emit(experience('G', 'test/game', { slot: 'home/info' }, 'game'));
    await flush();
    // …then moves the SAME experience to home/main.
    transport.emit(experience('G', 'test/game', { slot: 'home/main' }, 'game'));
    await flush();
    expect(Array.from(live)).toEqual(['G@home/main']);

    // The home remounts and re-provides both regions: the stale placement at
    // home/info must NOT resurrect — G occupies exactly one address.
    transport.emit(experience('home2', 'test/layout', { slot: 'root' }, 'home'));
    await flush();
    expect(Array.from(live).sort()).toEqual(['G@home/main']);
  });

  it('ignores a stale island error report after the address was re-bound', async () => {
    const errors: string[] = [];
    const unmounts: string[] = [];
    let reportFromA: ((error: unknown) => void) | undefined;
    const adaptor: ExperienceAdaptor = {
      async mount(exp, _slot, helpers) {
        if (exp.id === 'A') reportFromA = (error) => helpers.reportError(error);
        return () => {
          unmounts.push(exp.id);
        };
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/game': adaptor },
      createSlotElement: () => new FakeSlotElement(),
      onError: (m) => errors.push(m),
    });
    manager.start();

    transport.emit(experience('A', 'test/game', { slot: 'main' }));
    await flush();
    transport.emit(experience('B', 'test/game', { slot: 'main' })); // A replaced
    await flush();
    expect(unmounts).toEqual(['A']);

    // A's island fires a late error (in-flight fetch handler, stray timer).
    reportFromA?.(new Error('ghost failure'));
    await flush();

    // B is untouched: not unmounted, no fallback, and no SLOT_ERROR was
    // escalated under A's stale identity.
    expect(unmounts).toEqual(['A']);
    expect(errors.some((m) => m.includes('ghost failure'))).toBe(false);
    const slotErrors = transport.sent
      .map((e) => e.payload as Record<string, unknown>)
      .filter((p) => p?.actionType === 'SLOT_ERROR');
    expect(slotErrors).toHaveLength(0);
  });

  it('rejects a provided slot id containing "/" — path composition is host-owned', async () => {
    const errors: string[] = [];
    const region = new FakeSlotElement();
    const sneakyProvider: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        // Bypasses the manifest contract (raw provideSlot) and tries to mint
        // an address outside its own prefix.
        helpers.provideSlot?.('other-mfe/main', region as never);
        return () => {};
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/layout': sneakyProvider },
      createSlotElement: () => new FakeSlotElement(),
      onError: (m) => errors.push(m),
    });
    manager.start();

    transport.emit(experience('sneaky', 'test/layout', { slot: 'root' }, 'sneaky'));
    await flush();

    // The registration is refused: no shadow address exists under any
    // spelling, and the violation surfaced through the slot error path.
    expect(manager.activeSlots.some((s) => s.includes('other-mfe'))).toBe(false);
    expect(errors.some((m) => m.includes('must not contain'))).toBe(true);
  });

  it('stop() empties the layout and a restarted manager begins from scratch', async () => {
    const mounts: string[] = [];
    const hostElements: FakeSlotElement[] = [];
    const gameAdaptor: ExperienceAdaptor = {
      async mount(exp) {
        mounts.push(exp.id);
        return () => {};
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/game': gameAdaptor },
      createSlotElement: () => {
        const el = new FakeSlotElement();
        hostElements.push(el);
        return el;
      },
    });
    manager.start();

    transport.emit(experience('A', 'test/game', { slot: 'main' }));
    await flush();
    await manager.stop();

    // Nothing lingers: no active slots, no retained placements, and the
    // host-created element was retired from the container.
    expect(manager.activeSlots).toEqual([]);
    expect(hostElements[0]?.removed).toBe(true);

    // A restarted manager is 100% empty until the daemon speaks again — and
    // then composes fresh instead of into stale entries.
    manager.start();
    transport.emit(experience('A', 'test/game', { slot: 'main' }));
    await flush();
    expect(mounts).toEqual(['A', 'A']);
    expect(manager.activeSlots).toEqual(['main']);
  });

  it('a failing transport during error escalation surfaces via onError, never as an unhandled rejection', async () => {
    const errors: string[] = [];
    const adaptor: ExperienceAdaptor = {
      async mount() {
        throw new Error('mount exploded');
      },
    };
    const transport = new FakeTransport();
    transport.send = async () => {
      throw new Error('socket is down');
    };
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/game': adaptor },
      createSlotElement: () => new FakeSlotElement(),
      onError: (m) => errors.push(m),
    });
    manager.start();

    transport.emit(experience('A', 'test/game', { slot: 'main' }));
    await flush();

    // The mount failure is reported, and the SLOT_ERROR escalation failing on
    // a dead socket lands in the terminal envelope guard instead of escaping.
    expect(errors.some((m) => m.includes('mount exploded'))).toBe(true);
    expect(errors.some((m) => m.includes('Envelope handling failed'))).toBe(true);
  });

  it('an MFE providing the address it occupies converges instead of deadlocking the queue', async () => {
    // 'G' (mfe 'layout') is placed at 'layout/main' before any provider exists,
    // so it mounts into a parked placeholder — and then provides its own
    // address. The registration must retire the placeholder and re-bind G into
    // the provided element without the queue waiting on itself.
    const stableRegion = new FakeSlotElement();
    const mounts: SlotElementLike[] = [];
    const selfProvider: ExperienceAdaptor = {
      async mount(_exp, slot, helpers) {
        mounts.push(slot);
        helpers.provideSlot?.('main', stableRegion as never);
        return () => {};
      },
    };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: makeHost(),
      transport: transport as never,
      adaptors: { 'test/layout': selfProvider },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('G', 'test/layout', { slot: 'layout/main' }, 'layout'));
    await flush();

    // Convergence, not deadlock: the address is backed by the provided element
    // and G was re-bound into it.
    expect(mounts.length).toBeGreaterThanOrEqual(2);
    expect(mounts[mounts.length - 1]).toBe(stableRegion);
    await expect(manager.stop()).resolves.toBeUndefined();
  });
});
