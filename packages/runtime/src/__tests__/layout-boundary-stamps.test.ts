/**
 * Boundary stamps (#408, ADR-108).
 *
 * Once a capability mounts, its DOM is anonymous. The LayoutManager — the only
 * thing that mounts an MFE (ADR-108) — stamps every slot it binds with the MFE,
 * capability, experience and content type it holds, beside the existing
 * data-layout-slot / data-slot-state, so anything that needs to know whose
 * region this is (design capture, e2e selectors, error attribution, parity
 * checks) reads a fact instead of guessing from geometry.
 *
 * The stamps describe the experience bound to the slot, including while it
 * shows its error fallback (that is exactly when attribution matters), and are
 * removed when the slot is cleared, so a stamp never outlives its occupant.
 */
import {
  LayoutManager,
  type DaemonEnvelope,
  type ExperienceAdaptor,
  type SlotElementLike,
} from '../layout-manager';

const STAMPS = ['data-smt-mfe', 'data-smt-capability', 'data-smt-experience', 'data-smt-content-type'];

class StampedElement implements SlotElementLike {
  innerHTML = '';
  attributes: Record<string, string> = {};
  removed = false;
  appendChild(child: unknown): unknown { return child; }
  remove(): void { this.removed = true; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  removeAttribute(name: string): void { delete this.attributes[name]; }
  addEventListener(): void { /* not exercised in node tests */ }
}

/** A host element factory that predates removeAttribute on SlotElementLike. */
class LegacyElement implements SlotElementLike {
  innerHTML = '';
  attributes: Record<string, string> = {};
  appendChild(child: unknown): unknown { return child; }
  remove(): void { /* no-op */ }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  addEventListener(): void { /* not exercised */ }
}

class FakeTransport {
  onMessage: ((e: DaemonEnvelope) => void) | null = null;
  start(onMessage: (e: DaemonEnvelope) => void): void { this.onMessage = onMessage; }
  stop(): void { /* no-op */ }
  async send(): Promise<void> { /* no-op */ }
  emit(experience: Record<string, unknown>): void {
    this.onMessage?.({
      direction: 'COMPONENT',
      kind: 'COMPONENT_UPDATE',
      payload: { id: String(experience.id), type: 'EXPERIENCE', data: experience },
      metadata: { correlationId: 'c', error: null },
    });
  }
}

const experience = (
  id: string,
  mfe: string,
  capability: string,
  props: Record<string, unknown> = {},
  contentType = 'test/ok'
) => ({ id, mfe, capability, output: {}, contentType, props, createdAt: new Date().toISOString() });

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

function setup(adaptors: Record<string, ExperienceAdaptor>, createSlotElement: () => SlotElementLike = () => new StampedElement()) {
  const elements: SlotElementLike[] = [];
  const transport = new FakeTransport();
  const manager = new LayoutManager({
    container: { appendChild: (child: unknown) => child },
    transport,
    adaptors,
    createSlotElement: () => {
      const el = createSlotElement();
      elements.push(el);
      return el;
    },
    onError: () => undefined,
  });
  manager.start();
  return { manager, transport, elements };
}

const ok: ExperienceAdaptor = { async mount() { return () => undefined; } };
const stampsOf = (el: SlotElementLike) =>
  Object.fromEntries(STAMPS.map((k) => [k, (el as StampedElement).attributes[k]]));

describe('LayoutManager boundary stamps (#408)', () => {
  it('stamps the slot with the MFE, capability, experience and content type it holds', async () => {
    const { transport, elements } = setup({ 'test/ok': ok });
    transport.emit(experience('e-1', 'meridian-cargo-ops', 'CargoManifest', { slot: 'main' }));
    await flush();

    expect(stampsOf(elements[0])).toEqual({
      'data-smt-mfe': 'meridian-cargo-ops',
      'data-smt-capability': 'CargoManifest',
      'data-smt-experience': 'e-1',
      'data-smt-content-type': 'test/ok',
    });
    // Beside the existing slot attributes, not instead of them.
    expect((elements[0] as StampedElement).attributes['data-layout-slot']).toBe('main');
    expect((elements[0] as StampedElement).attributes['data-slot-state']).toBe('ready');
  });

  it('restamps when the address is re-bound to another MFE', async () => {
    const { transport, elements } = setup({ 'test/ok': ok });
    transport.emit(experience('e-1', 'meridian-cargo-ops', 'CargoManifest'));
    await flush();
    transport.emit(experience('e-2', 'meridian-crew-services', 'CrewRoster'));
    await flush();

    expect(elements).toHaveLength(1);
    expect(stampsOf(elements[0])).toEqual({
      'data-smt-mfe': 'meridian-crew-services',
      'data-smt-capability': 'CrewRoster',
      'data-smt-experience': 'e-2',
      'data-smt-content-type': 'test/ok',
    });
  });

  it('keeps the stamps on a slot showing its error fallback, so the failure is attributable', async () => {
    const failing: ExperienceAdaptor = { async mount() { throw new Error('boom'); } };
    const { transport, elements } = setup({ 'test/fail': failing });
    transport.emit(experience('e-1', 'meridian-life-support', 'AlertsFeed', {}, 'test/fail'));
    await flush();

    const el = elements[0] as StampedElement;
    expect(el.attributes['data-slot-state']).toBe('error');
    expect(el.attributes['data-smt-capability']).toBe('AlertsFeed');
    expect(el.attributes['data-smt-mfe']).toBe('meridian-life-support');
  });

  it('removes the stamps from an address its experience moved away from', async () => {
    const { manager, transport, elements } = setup({ 'test/ok': ok });
    transport.emit(experience('e-1', 'meridian-cargo-ops', 'HazardSummary', { slot: 'status' }));
    await flush();
    transport.emit(experience('e-1', 'meridian-cargo-ops', 'HazardSummary', { slot: 'main' }));
    await flush();

    const [status, main] = elements as StampedElement[];
    expect(manager.activeSlots.sort()).toEqual(['main', 'status']);
    for (const stamp of STAMPS) expect(status.attributes).not.toHaveProperty(stamp);
    expect(main.attributes['data-smt-capability']).toBe('HazardSummary');
  });

  it('removes the stamps when the manager stops', async () => {
    const { manager, transport, elements } = setup({ 'test/ok': ok });
    transport.emit(experience('e-1', 'meridian-concourse', 'MarketDirectory'));
    await flush();
    await manager.stop();

    for (const stamp of STAMPS) expect((elements[0] as StampedElement).attributes).not.toHaveProperty(stamp);
  });

  it('stamps an MFE-provided slot (ADR-058) with its occupant', async () => {
    const provided = new StampedElement();
    const layout: ExperienceAdaptor = {
      async mount(_experience, _slot, helpers) {
        helpers.provideSlot?.('main', provided);
        return () => undefined;
      },
    };
    const { transport } = setup({ 'test/layout': layout, 'test/ok': ok });
    transport.emit(experience('console', 'meridian-console', 'StationConsole', { slot: 'root' }, 'test/layout'));
    await flush();
    transport.emit(experience('e-1', 'meridian-docking-control', 'DockingBoard', { slot: 'meridian-console/main' }));
    await flush();

    expect(provided.attributes['data-layout-slot']).toBe('meridian-console/main');
    expect(provided.attributes['data-smt-mfe']).toBe('meridian-docking-control');
    expect(provided.attributes['data-smt-capability']).toBe('DockingBoard');
  });

  it('blanks the stamps on a host element that has no removeAttribute', async () => {
    const { manager, transport, elements } = setup({ 'test/ok': ok }, () => new LegacyElement());
    transport.emit(experience('e-1', 'meridian-concourse', 'MarketDirectory'));
    await flush();
    expect((elements[0] as LegacyElement).attributes['data-smt-mfe']).toBe('meridian-concourse');

    await manager.stop();
    for (const stamp of STAMPS) expect((elements[0] as LegacyElement).attributes[stamp]).toBe('');
  });
});
