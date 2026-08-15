/**
 * @jest-environment jsdom
 *
 * DeclaredSlot tests (ADR-067, three-layer split).
 *
 * Needs react + @testing-library/react + jsdom (same posture as
 * MfeHost.test.tsx — see its header for what changed to make that true).
 * The contract *logic* is fully covered framework-free in
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

  // ADR-072 §3: providers hand-rolled their own ref callbacks partly because the
  // sugar could not express inline styles or semantic elements. If it cannot
  // replace the primitive, it will keep losing to it.
  it('renders the element named by `as`, keeping registration intact', () => {
    const provided: Array<[string, HTMLElement | null]> = [];
    const { container } = render(
      <DeclaredSlot
        contract={fakeContract([])}
        id="main"
        as="section"
        provideSlot={(id, el) => provided.push([id, el])}
      />
    );

    const region = container.querySelector('section[data-declared-slot="main"]');
    expect(region).not.toBeNull();
    expect(provided[0][1]).toBe(region);
  });

  it('forwards arbitrary element props (aria, style, data-*) to the region', () => {
    const { container } = render(
      <DeclaredSlot
        contract={fakeContract([])}
        id="main"
        as="aside"
        aria-label="game info"
        style={{ minHeight: 96 }}
        data-testid="info-region"
      />
    );

    const region = container.querySelector('[data-declared-slot="main"]') as HTMLElement;
    expect(region.tagName).toBe('ASIDE');
    expect(region.getAttribute('aria-label')).toBe('game info');
    expect(region.getAttribute('data-testid')).toBe('info-region');
    expect(region.style.minHeight).toBe('96px');
  });

  it('defaults to a div when `as` is omitted', () => {
    const { container } = render(<DeclaredSlot contract={fakeContract([])} id="main" />);
    expect((container.querySelector('[data-declared-slot="main"]') as HTMLElement).tagName).toBe(
      'DIV'
    );
  });
});
