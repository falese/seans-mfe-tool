/**
 * DeclaredSlotDirective tests (ADR-067, three-layer split).
 *
 * CI-only: needs @angular/core + `experimentalDecorators` compilation, which the
 * default ts-jest config does not enable (same posture as framework-react's
 * DeclaredSlot.test.tsx, and the `.spec.ts` name is outside the default
 * testMatch). Run under the Angular jest project in CI. The contract *logic* is
 * fully covered framework-free in packages/runtime/src/__tests__/slot-contract.test.ts;
 * this pins the sugar: assert on init, register the native element on view-init,
 * release on destroy.
 *
 * The directive is a plain class, so we drive its lifecycle hooks directly with a
 * fake ElementRef and contract — no TestBed / platform-browser-dynamic needed.
 */
import { ElementRef } from '@angular/core';
import { DeclaredSlotDirective, type SlotContractLike } from '../declared-slot.directive';

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

function makeDirective(el: HTMLElement): DeclaredSlotDirective {
  return new DeclaredSlotDirective(new ElementRef(el));
}

describe('DeclaredSlotDirective (ADR-067)', () => {
  it('registers its native element on view-init and releases it on destroy', () => {
    const log: Array<[string, unknown]> = [];
    const el = document.createElement('div');
    const d = makeDirective(el);
    d.id = 'main';
    d.contract = fakeContract(log);
    d.provideSlot = () => undefined;

    d.ngOnInit();
    d.ngAfterViewInit();
    d.ngOnDestroy();

    expect(log).toEqual([
      ['main', el],
      ['main', null],
    ]);
  });

  it('throws on init for an undeclared id — declare it in the manifest first', () => {
    const d = makeDirective(document.createElement('div'));
    d.id = 'not-declared';
    d.contract = fakeContract([]);
    expect(() => d.ngOnInit()).toThrow(/not declared/);
  });

  it('is inert without a provideSlot callback (standalone mode) but still asserts', () => {
    const d = makeDirective(document.createElement('div'));
    d.id = 'main';
    d.contract = fakeContract([]);
    // no provideSlot bound
    expect(() => {
      d.ngOnInit();
      d.ngAfterViewInit();
      d.ngOnDestroy();
    }).not.toThrow();
  });
});
