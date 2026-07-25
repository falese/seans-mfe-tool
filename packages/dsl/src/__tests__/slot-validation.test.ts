/**
 * Design-time slot validation (ADR-073) — the two checks that close the loop
 * ADR-067 §4 described but never implemented.
 *
 * Pure functions over already-read inputs so they are unit-testable without a
 * filesystem; the CLI commands (`mfe:validate`, `slots:validate`) supply the IO.
 */
import { findUnreferencedSlots, validatePlacementRules } from '../slot-validation';

describe('findUnreferencedSlots (ADR-073)', () => {
  it('passes when every declared slot is referenced in source', () => {
    const findings = findUnreferencedSlots(
      [{ id: 'main' }, { id: 'status' }],
      [{ path: 'src/Console.tsx', text: '<DeclaredSlot id="main" /><DeclaredSlot id="status" />' }]
    );
    expect(findings).toEqual([]);
  });

  it('reports a declared slot no source mentions — it would park forever', () => {
    const findings = findUnreferencedSlots(
      [{ id: 'main' }, { id: 'ghost' }],
      [{ path: 'src/Console.tsx', text: '<DeclaredSlot id="main" />' }]
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ slotId: 'ghost', reason: 'declared-but-unreferenced' });
  });

  it('matches a keyed slot on the literal prefix before the first {param}', () => {
    // The id is built by interpolation at runtime (`berth.${berthId}`), so the
    // literal `berth.` is the only thing a static scan can honestly look for.
    const findings = findUnreferencedSlots(
      [{ id: 'berth.{id}' }],
      [{ path: 'src/Console.tsx', text: 'id={`berth.${berthId}`}' }]
    );
    expect(findings).toEqual([]);
  });

  it('reports a keyed slot whose prefix appears nowhere', () => {
    const findings = findUnreferencedSlots(
      [{ id: 'berth.{id}' }],
      [{ path: 'src/Console.tsx', text: 'id={`dock.${dockId}`}' }]
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ slotId: 'berth.{id}' });
  });

  it('does not count a substring of a longer identifier as a reference', () => {
    // `mainMenu` must not satisfy a declaration of `main`.
    const findings = findUnreferencedSlots(
      [{ id: 'main' }],
      [{ path: 'src/Console.tsx', text: 'const mainMenuStyle = {};' }]
    );
    expect(findings).toHaveLength(1);
  });

  it('accepts a reference in any quoting style', () => {
    for (const text of [`id="main"`, `id='main'`, 'id={`main`}', `register(p, 'main', el)`]) {
      expect(findUnreferencedSlots([{ id: 'main' }], [{ path: 'a.tsx', text }])).toEqual([]);
    }
  });

  it('reports nothing when nothing is declared', () => {
    expect(findUnreferencedSlots([], [{ path: 'a.tsx', text: '' }])).toEqual([]);
  });
});

describe('validatePlacementRules (ADR-073)', () => {
  const providers = [
    { mfeId: 'meridian-console', declarations: [{ id: 'main' }, { id: 'berth.{id}' }] },
  ];

  const doc = (slot: string) => ({
    registration: { name: 'meridian-docking-control' },
    routes: [{ when: { stateKey: 'x' }, resolve: { capability: 'BerthTile', props: { slot } } }],
  });

  it('passes a target the provider declares', () => {
    expect(validatePlacementRules([doc('meridian-console/main')], providers)).toEqual([]);
    expect(validatePlacementRules([doc('meridian-console/berth.b1')], providers)).toEqual([]);
  });

  it('reports a target the provider does not declare, naming the rule', () => {
    const findings = validatePlacementRules([doc('meridian-console/nope')], providers);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      mfe: 'meridian-docking-control',
      capability: 'BerthTile',
      slot: 'meridian-console/nope',
      reason: 'undeclared-slot',
      fatal: true,
    });
  });

  it('marks an unknown provider advisory rather than fatal', () => {
    const findings = validatePlacementRules([doc('who-knows/main')], providers);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ reason: 'unknown-provider', fatal: false });
  });

  it('accepts host-owned unqualified targets like root', () => {
    expect(validatePlacementRules([doc('root')], providers)).toEqual([]);
  });

  it('ignores routes that name no slot — the host default applies', () => {
    const noSlot = {
      registration: { name: 'x' },
      routes: [{ when: {}, resolve: { capability: 'C' } }],
    };
    expect(validatePlacementRules([noSlot], providers)).toEqual([]);
  });

  it('checks every route of every document', () => {
    const multi = {
      registration: { name: 'multi' },
      routes: [
        { when: {}, resolve: { capability: 'A', props: { slot: 'meridian-console/main' } } },
        { when: {}, resolve: { capability: 'B', props: { slot: 'meridian-console/bad' } } },
        { when: {}, resolve: { capability: 'C', props: { slot: 'meridian-console/worse' } } },
      ],
    };
    const findings = validatePlacementRules([multi], providers);
    expect(findings.map((f) => f.capability)).toEqual(['B', 'C']);
  });
});
