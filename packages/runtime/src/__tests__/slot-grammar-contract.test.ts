/**
 * Cross-package grammar contract (ADR-066/067): the slot-id grammar is
 * single-sourced in @seans-mfe/contracts (slot-grammar.ts, ADR-069) and
 * consumed by both the DSL's `providesSlots` validation and the runtime
 * matcher. This suite pins the two CONSUMERS to each other behaviorally —
 * the dsl composes the segment rule into whole-id validation while the
 * runtime compiles declarations into matchers, and those compositions could
 * still drift even over one grammar. Any divergence fails here instead of
 * silently splitting what can be declared from what can match. Refs #265.
 */
import { ProvidedSlotSchema } from '@seans-mfe/dsl';
import { createSlotContract } from '../slot-contract';

const dslAccepts = (id: string): boolean => ProvidedSlotSchema.safeParse({ id }).success;

describe('DSL slot grammar ↔ runtime matcher contract', () => {
  it('every DSL-accepted literal id is matched by its own compiled matcher', () => {
    const literals = ['main', 'info', 'game-area', 'nav_bar', 'a1', 'games.menu', 'x-1_y.z2'];
    for (const id of literals) {
      expect(dslAccepts(id)).toBe(true);
      expect(createSlotContract([{ id }]).matches(id)).toBe(true);
    }
  });

  it('every DSL-accepted keyed pattern matches one-segment instantiations, and only those', () => {
    const cases: Array<[pattern: string, hits: string[], misses: string[]]> = [
      ['games.{gameId}', ['games.alphabet', 'games.x-1', 'games.42'], ['games', 'games.a.b']],
      ['{key}', ['k', 'sku-42'], ['a.b', '']],
      ['cards.{sku}.detail', ['cards.abc-123.detail'], ['cards.detail', 'cards.a.b.detail']],
    ];
    for (const [pattern, hits, misses] of cases) {
      expect(dslAccepts(pattern)).toBe(true);
      const contract = createSlotContract([{ id: pattern }]);
      for (const hit of hits) expect(contract.matches(hit)).toBe(true);
      for (const miss of misses) expect(contract.matches(miss)).toBe(false);
    }
  });

  it('ids the DSL rejects can never reach the matcher as declarations', () => {
    // Ordinal/positional, empty-segment, and path-shaped ids are refused at
    // declaration time (ADR-066), so the matcher never needs to reason about
    // them — pinned here so a schema relaxation is a visible contract change.
    const rejected = ['1', 'games.2', '', 'a/b', '.', 'a..b', '.a', 'a.', '{1bad}', '{}'];
    for (const id of rejected) {
      expect(dslAccepts(id)).toBe(false);
    }
  });

  it('a {param} instantiation uses the same character set the DSL allows for literals', () => {
    // The matcher's runtime value charset ([A-Za-z0-9_-]) must stay within
    // what the DSL considers addressable; a dot or slash in a value would
    // change segment count or path shape.
    const contract = createSlotContract([{ id: 'card.{sku}' }]);
    expect(contract.matches('card.ABC_9-x')).toBe(true);
    expect(contract.matches('card.a.b')).toBe(false);
    expect(contract.matches('card.a/b')).toBe(false);
  });
});
