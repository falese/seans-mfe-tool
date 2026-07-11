/**
 * Slot contract logic (ADR-067) — framework-free, DOM-free, published once.
 *
 * The three-layer split: the *manifest* declares slot identity (data), this
 * module owns matching and the declare-before-register guard (logic), and
 * framework packages add thin registration sugar (e.g. a React component
 * whose ref callback calls `register()`). Generated MFEs mirror their
 * manifest's `providesSlots` into `createSlotContract(...)` and carry no
 * slot logic of their own — a matcher fix ships here, not in N regenerated
 * copies.
 *
 * Identity rules come from ADR-066: ids are assigned names; a `{param}`
 * segment is the domain key of a repeated slot and matches exactly one
 * runtime segment. Ordinal-form ids cannot be declared (the DSL schema
 * rejects them), so they can never match here either.
 */

import { ValidationError } from '@seans-mfe/contracts';

/** One slot declaration, as it appears in the manifest's `providesSlots`. */
export interface ProvidedSlotDeclaration {
  id: string;
  description?: string;
}

/** Host registration callback (ADR-058), structural over the element type. */
export type ProvideSlotFn<E> = (slotId: string, element: E) => void;

export interface SlotContract {
  /** The manifest declarations this contract was built from. */
  readonly declarations: readonly ProvidedSlotDeclaration[];
  /** True when `id` matches a declared literal or keyed pattern. */
  matches(id: string): boolean;
  /** Throw a ValidationError unless `id` is declared. */
  assertDeclared(id: string): void;
  /**
   * Guarded registration: asserts the id is declared, then hands the element
   * to the host. No-op when the element is absent (unmount tick) or there is
   * no host callback (standalone/dev mode) — the assertion still runs, so an
   * undeclared id fails fast even before composition.
   */
  register<E>(provideSlot: ProvideSlotFn<E> | undefined, id: string, element: E | null): void;
}

/** Compile one declared id into a matcher: literals escaped, `{param}` → one segment. */
function toMatcher(declaredId: string): RegExp {
  const source = declaredId
    .split('.')
    .map((segment) =>
      /^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(segment)
        ? '[A-Za-z0-9_-]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('\\.');
  return new RegExp('^' + source + '$');
}

export function createSlotContract(declarations: readonly ProvidedSlotDeclaration[]): SlotContract {
  const matchers = declarations.map((declaration) => toMatcher(declaration.id));

  const matches = (id: string): boolean => matchers.some((matcher) => matcher.test(id));

  const assertDeclared = (id: string): void => {
    if (matches(id)) return;
    throw new ValidationError(
      `Slot "${id}" is not declared in this MFE's manifest providesSlots ` +
        `(declared: ${declarations.map((d) => `"${d.id}"`).join(', ') || 'none'}). ` +
        `Declare it in the manifest and regenerate — the manifest is the contract ` +
        `registry rules validate against (ADR-067).`,
      'slotId',
      'declared-in-manifest'
    );
  };

  return {
    declarations,
    matches,
    assertDeclared,
    register<E>(provideSlot: ProvideSlotFn<E> | undefined, id: string, element: E | null): void {
      assertDeclared(id);
      if (element !== null && provideSlot) provideSlot(id, element);
    },
  };
}
