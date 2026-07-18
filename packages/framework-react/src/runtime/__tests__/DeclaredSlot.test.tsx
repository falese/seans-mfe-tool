/**
 * DeclaredSlot tests (ADR-067, three-layer split).
 *
 * CI-only: needs react + @testing-library/react + jsdom, which are not
 * installed in every environment (same posture as MfeHost.test.tsx). The
 * contract *logic* is fully covered framework-free in
 * packages/runtime/src/__tests__/slot-contract.test.ts; this pins the sugar:
 * assert on render, register through a stable ref, inert without a host.
 */
import * as React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DeclaredSlot, type SlotContractLike } from '../DeclaredSlot';

afterEach(() => cleanup());

/** Minimal contract fake: 'main' is declared, everything else is not. */
function fakeContract(log: Array<[string, unknown]>): SlotContractLike {
  const assertDeclared = (id: string): void => {
    if (id !== 'main') throw new Error(`Slot "${id}" is not declared in providesSlots`);
  };
  return {
    assertDeclared,
    register<E>(
      provideSlot: ((slotId: string, element: E | null) => void) | undefined,
      id: string,
      element: E | null
    ): void {
      assertDeclared(id);
      if (provideSlot) {
        provideSlot(id, element);
        log.push([id, element]);
      }
    },
  };
}

describe('DeclaredSlot (ADR-067)', () => {
  it('registers its element with the host on mount and renders children', () => {
    const log: Array<[string, unknown]> = [];
    const provided: Array<[string, HTMLElement | null]> = [];
    const { getByText, container, unmount } = render(
      <DeclaredSlot
        contract={fakeContract(log)}
        id="main"
        provideSlot={(id, el) => provided.push([id, el])}
      >
        <span>content</span>
      </DeclaredSlot>
    );

    expect(getByText('content')).toBeTruthy();
    const region = container.querySelector('[data-declared-slot="main"]');
    expect(region).not.toBeNull();
    expect(provided).toHaveLength(1);
    expect(provided[0][0]).toBe('main');
    expect(provided[0][1]).toBe(region);

    unmount();
    expect(provided[1]).toEqual(['main', null]);
  });

  it('throws during render for an undeclared id — declare it in the manifest first', () => {
    expect(() =>
      render(<DeclaredSlot contract={fakeContract([])} id="sidebar" />)
    ).toThrow(/not declared/);
  });

  it('renders inert without a provideSlot callback (standalone mode)', () => {
    const log: Array<[string, unknown]> = [];
    const { container } = render(<DeclaredSlot contract={fakeContract(log)} id="main" />);
    expect(container.querySelector('[data-declared-slot="main"]')).not.toBeNull();
    expect(log).toHaveLength(0);
  });
});
