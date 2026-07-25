/**
 * DeclaredSlotId derivation (ADR-072): manifest slot ids become a TypeScript
 * template-literal union, so renaming a slot in the manifest is a compile error
 * at every use site instead of a runtime throw in production.
 */
import { toDeclaredSlotIdUnion } from '../slot-types';

describe('toDeclaredSlotIdUnion (ADR-072)', () => {
  it('renders a literal declaration as a string-literal member', () => {
    expect(toDeclaredSlotIdUnion([{ id: 'main' }])).toBe("'main'");
  });

  it('renders a {param} segment as ${string} so interpolation type-checks', () => {
    // `berth.${berthId}` must satisfy the emitted type — that is the whole point.
    expect(toDeclaredSlotIdUnion([{ id: 'berth.{id}' }])).toBe('`berth.${string}`');
  });

  it('keeps {param} segments positional', () => {
    expect(toDeclaredSlotIdUnion([{ id: 'section.{key}.footer' }])).toBe(
      '`section.${string}.footer`'
    );
    expect(toDeclaredSlotIdUnion([{ id: 'cell.{row}.{col}' }])).toBe(
      '`cell.${string}.${string}`'
    );
  });

  it('joins declarations in manifest order', () => {
    expect(
      toDeclaredSlotIdUnion([{ id: 'main' }, { id: 'status' }, { id: 'berth.{id}' }])
    ).toBe("'main' | 'status' | `berth.${string}`");
  });

  it('is `never` when nothing is declared — no slot may be registered', () => {
    expect(toDeclaredSlotIdUnion([])).toBe('never');
  });

  it('does not treat a literal segment containing braces-like text as a param', () => {
    // The grammar (ADR-069) admits only [A-Za-z0-9_-] literals, so a hyphenated
    // id stays a plain literal member rather than becoming a template literal.
    expect(toDeclaredSlotIdUnion([{ id: 'main-content' }])).toBe("'main-content'");
  });
});
