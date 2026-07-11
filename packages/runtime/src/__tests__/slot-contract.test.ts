/**
 * Slot contract logic (ADR-067, three-layer split): the matcher and the
 * declare-before-register guard live here — framework-free, published once in
 * the runtime — so generated MFEs carry data, not logic. Framework packages
 * add thin sugar over `register()`. Refs #265.
 */
import { createSlotContract } from '../slot-contract';
import { ValidationError } from '@seans-mfe/contracts';

const contract = createSlotContract([
  { id: 'main', description: 'Primary content region' },
  { id: 'info' },
  { id: 'card.{sku}', description: 'One card per product' },
]);

describe('createSlotContract — matching (ADR-066 identity rules)', () => {
  it('matches declared literal ids', () => {
    expect(contract.matches('main')).toBe(true);
    expect(contract.matches('info')).toBe(true);
  });

  it('matches keyed patterns with exactly one segment per {param}', () => {
    expect(contract.matches('card.ABC-123')).toBe(true);
    expect(contract.matches('card.ABC.123')).toBe(false); // two segments, one key
    expect(contract.matches('card.')).toBe(false);
  });

  it('never matches undeclared or ordinal-form ids', () => {
    expect(contract.matches('sidebar')).toBe(false);
    expect(contract.matches('main.2')).toBe(false);
    expect(contract.matches('2')).toBe(false);
  });

  it('treats regex metacharacters in declared ids as literals', () => {
    const c = createSlotContract([{ id: 'a-b_c' }]);
    expect(c.matches('a-b_c')).toBe(true);
    expect(c.matches('aXb_c')).toBe(false);
  });
});

describe('createSlotContract — assertDeclared', () => {
  it('passes silently for declared ids', () => {
    expect(() => contract.assertDeclared('main')).not.toThrow();
    expect(() => contract.assertDeclared('card.SKU9')).not.toThrow();
  });

  it('throws a typed ValidationError naming the manifest as the fix', () => {
    try {
      contract.assertDeclared('sidebar');
      throw new Error('expected assertDeclared to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validation = error as ValidationError;
      expect(validation.message).toContain('sidebar');
      expect(validation.message).toContain('providesSlots');
      expect(validation.field).toBe('slotId');
    }
  });
});

describe('createSlotContract — register', () => {
  it('registers a declared id through the host callback', () => {
    const calls: Array<[string, unknown]> = [];
    const element = { tag: 'div' };
    contract.register((id, el) => calls.push([id, el]), 'main', element);
    expect(calls).toEqual([['main', element]]);
  });

  it('is a no-op without an element (unmount tick) or without a host callback (standalone mode)', () => {
    const calls: unknown[] = [];
    contract.register((id, el) => calls.push([id, el]), 'main', null);
    contract.register(undefined, 'main', { tag: 'div' });
    expect(calls).toEqual([]);
  });

  it('rejects undeclared ids even when no element is attached yet', () => {
    expect(() => contract.register(() => undefined, 'nope', null)).toThrow(ValidationError);
  });

  it('exposes the declarations it was built from', () => {
    expect(contract.declarations.map((d) => d.id)).toEqual(['main', 'info', 'card.{sku}']);
  });
});
