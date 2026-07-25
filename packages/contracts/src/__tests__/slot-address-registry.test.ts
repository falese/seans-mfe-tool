/**
 * Cross-MFE placement-target validation (ADR-073).
 *
 * ADR-067 §4 named the manifest "the registry-side validation target", but
 * nothing ever validated a placement against it — a rule aimed at a renamed or
 * misspelled slot registered happily and parked forever at runtime. This is the
 * check that makes the promise real, reusing the one matcher so design time and
 * run time can never disagree (ADR-069).
 */
import { createSlotAddressRegistry } from '../slot-contract';

const providers = [
  {
    mfeId: 'meridian-console',
    declarations: [{ id: 'main' }, { id: 'status' }, { id: 'berth.{id}' }],
  },
  { mfeId: 'abc-kids-home', declarations: [{ id: 'main' }, { id: 'info' }] },
];

describe('createSlotAddressRegistry (ADR-073)', () => {
  const registry = createSlotAddressRegistry(providers);

  it('accepts a qualified address a provider declares', () => {
    expect(registry.validateTarget('meridian-console/main')).toEqual({ status: 'ok' });
    expect(registry.validateTarget('meridian-console/status')).toEqual({ status: 'ok' });
  });

  it('accepts a keyed address matching a declared {param} pattern', () => {
    expect(registry.validateTarget('meridian-console/berth.b1')).toEqual({ status: 'ok' });
    // Shape, not membership (ADR-067): which berths exist is runtime data.
    expect(registry.validateTarget('meridian-console/berth.b99')).toEqual({ status: 'ok' });
  });

  it('rejects an id a registered provider does not declare — the rename/typo case', () => {
    const result = registry.validateTarget('meridian-console/nonexistent');
    expect(result.status).toBe('rejected');
    expect(result).toMatchObject({ reason: 'undeclared-slot' });
  });

  it('rejects a keyed address with too many segments for one {param}', () => {
    // `berth.{id}` matches exactly one segment (SLOT_PARAM_VALUE_SOURCE excludes '.').
    expect(registry.validateTarget('meridian-console/berth.b1.extra').status).toBe('rejected');
  });

  it('scopes declarations per provider — the same local name does not leak', () => {
    // Both declare `main`; only abc-kids-home declares `info` (ADR-068).
    expect(registry.validateTarget('abc-kids-home/info')).toEqual({ status: 'ok' });
    expect(registry.validateTarget('meridian-console/info').status).toBe('rejected');
  });

  it('treats an unqualified address as host-owned and accepts it', () => {
    // `root` and the LayoutManager default `main` belong to the shell, not to
    // any MFE manifest, so no contract can judge them.
    expect(registry.validateTarget('root')).toEqual({ status: 'ok' });
    expect(registry.validateTarget('main')).toEqual({ status: 'ok' });
  });

  it('flags an unknown provider as advisory, not fatal', () => {
    // Registration order is not guaranteed and fleets validate incrementally,
    // so this must not fail a build the way an undeclared id does.
    const result = registry.validateTarget('not-registered/main');
    expect(result).toMatchObject({ status: 'rejected', reason: 'unknown-provider' });
  });

  it('reports the declared vocabulary so the error can name alternatives', () => {
    const result = registry.validateTarget('meridian-console/nonexistent');
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.message).toContain('meridian-console');
      expect(result.message).toContain('main');
    }
  });

  it('rejects an empty provider or slot segment', () => {
    expect(registry.validateTarget('/main').status).toBe('rejected');
    expect(registry.validateTarget('meridian-console/').status).toBe('rejected');
  });
});
