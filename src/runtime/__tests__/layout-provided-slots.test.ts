/**
 * Slot-provider MFEs (ADR-058): an MFE contributes named slots to the host
 * layout via helpers.provideSlot. The host then routes later experiences into
 * the MFE-provided element — the layout itself is delivered as an MFE, and the
 * host owns no layout knowledge.
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
  constructor(public readonly tag = 'slot') {}
  appendChild(child: unknown): unknown {
    this.children.push(child);
    return child;
  }
  remove(): void {}
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  addEventListener(): void {}
}

class FakeTransport {
  onMessage: ((e: DaemonEnvelope) => void) | null = null;
  start(onMessage: (e: DaemonEnvelope) => void): void {
    this.onMessage = onMessage;
  }
  stop(): void {}
  async send(): Promise<void> {}
  emit(experience: Record<string, unknown>): void {
    this.onMessage?.({
      direction: 'COMPONENT',
      kind: 'COMPONENT_UPDATE',
      payload: { id: String(experience.id), type: 'EXPERIENCE', data: experience },
      metadata: { correlationId: 'c', error: null },
    });
  }
}

// Drain the full async mount chain. The replace→re-provide path awaits an
// unmount in the release step, so a single microtask is not enough. Drain many
// microtask turns (not setTimeout — jest fake timers would never fire it).
const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

const experience = (id: string, contentType: string, props: Record<string, unknown>) => ({
  id,
  mfe: id,
  capability: 'X',
  output: {},
  contentType,
  props,
  createdAt: new Date().toISOString(),
});

describe('LayoutManager — slot-provider MFEs (ADR-058)', () => {
  it('routes a later experience into a slot an MFE provided, without appending it to the host container', async () => {
    const providedMain = new FakeSlotElement('mfe-main');
    let gameSlot: unknown = null;

    // A layout MFE: on mount it contributes its own 'main' region as a host slot.
    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        helpers.provideSlot?.('main', providedMain);
      },
    };
    const gameAdaptor: ExperienceAdaptor = {
      async mount(_exp, slot) {
        gameSlot = slot;
        return () => undefined;
      },
    };

    const host = { children: [] as unknown[], appendChild(c: unknown) { this.children.push(c); return c; } };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: host,
      transport,
      adaptors: { 'test/layout': layoutAdaptor, 'test/game': gameAdaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    // The layout MFE lands in 'root' and provides 'main'.
    transport.emit(experience('layout', 'test/layout', { slot: 'root' }));
    await flush();
    expect(manager.activeSlots).toContain('main');
    expect(host.children).toHaveLength(1); // only 'root'; provided 'main' is the MFE's own element

    // A game targeting 'main' mounts into the MFE-provided element.
    transport.emit(experience('flappy', 'test/game', { slot: 'main' }));
    await flush();
    expect(gameSlot).toBe(providedMain);
    expect(host.children).toHaveLength(1); // still not appended by the host
  });

  it('releases provided slots when the providing experience is replaced', async () => {
    const firstMain = new FakeSlotElement('first');
    const secondMain = new FakeSlotElement('second');
    const provided = [firstMain, secondMain];
    let i = 0;

    const layoutAdaptor: ExperienceAdaptor = {
      async mount(_exp, _slot, helpers) {
        helpers.provideSlot?.('main', provided[i++]);
      },
    };
    const host = { children: [] as unknown[], appendChild(c: unknown) { this.children.push(c); return c; } };
    const transport = new FakeTransport();
    const manager = new LayoutManager({
      container: host,
      transport,
      adaptors: { 'test/layout': layoutAdaptor },
      createSlotElement: () => new FakeSlotElement(),
    });
    manager.start();

    transport.emit(experience('layout-a', 'test/layout', { slot: 'root' }));
    await flush();
    expect(manager.activeSlots).toContain('main');

    // Replacing the provider in 'root' releases its old 'main' and re-registers
    // the new one (last writer wins) — no stale element keeps receiving routes.
    transport.emit(experience('layout-b', 'test/layout', { slot: 'root' }));
    await flush();
    expect(manager.activeSlots).toContain('main');
    expect(manager.activeSlots.filter((s) => s === 'main')).toHaveLength(1);
  });
});
