/**
 * DeclaredSlotDirective tests (ADR-067, three-layer split).
 *
 * Runs under the root jest config: the directive is a plain class, so we drive
 * its lifecycle hooks directly with a fake ElementRef and contract — no
 * TestBed, no platform-browser-dynamic, and no DOM (the element is opaque to
 * the directive, so a sentinel object stands in for HTMLElement). The contract
 * *logic* is covered framework-free in
 * packages/runtime/src/__tests__/slot-contract.test.ts; this suite pins the
 * sugar: assert on init, register the native element on view-init, re-register
 * on input changes (release the old id first), release on destroy.
 */
import type { ElementRef, SimpleChange, SimpleChanges } from '@angular/core';
import { ValidationError } from '@seans-mfe/contracts';

// @angular/core 17 ships ESM-only (fesm2022), which jest's CJS runtime cannot
// require. The directive is tested as a plain class — Angular's runtime is not
// under test — so stub the few symbols it imports: decorators become no-ops
// (we drive the lifecycle hooks manually) and ElementRef a trivial wrapper.
jest.mock('@angular/core', () => ({
  Directive: () => (cls: unknown) => cls,
  Input: () => () => undefined,
  ElementRef: class StubElementRef<T> {
    constructor(public nativeElement: T) {}
  },
}));

// eslint-disable-next-line import/first
import { DeclaredSlotDirective, type SlotContractLike } from '../declared-slot.directive';

/** Minimal contract fake: 'main' and 'info' are declared, everything else is not. */
function fakeContract(log: Array<[string, unknown]>): SlotContractLike {
  const assertDeclared = (id: string): void => {
    if (id !== 'main' && id !== 'info') {
      throw new ValidationError(
        `Slot "${id}" is not declared in providesSlots`,
        'slotId',
        'declared-in-manifest'
      );
    }
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

const fakeElement = (): HTMLElement => ({ tag: 'fake-region' } as unknown as HTMLElement);

function makeDirective(el: HTMLElement): DeclaredSlotDirective {
  return new DeclaredSlotDirective({ nativeElement: el } as ElementRef<HTMLElement>);
}

const change = (previousValue: unknown, currentValue: unknown, firstChange: boolean): SimpleChange =>
  ({ previousValue, currentValue, firstChange, isFirstChange: () => firstChange }) as SimpleChange;

describe('DeclaredSlotDirective (ADR-067)', () => {
  it('registers its native element on view-init and releases it on destroy', () => {
    const log: Array<[string, unknown]> = [];
    const el = fakeElement();
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

  it('throws a typed ValidationError on init for an undeclared id', () => {
    const d = makeDirective(fakeElement());
    d.id = 'not-declared';
    d.contract = fakeContract([]);
    expect(() => d.ngOnInit()).toThrow(ValidationError);
    expect(() => d.ngOnInit()).toThrow(/not declared/);
  });

  it('is inert without a provideSlot callback (standalone mode) but still asserts', () => {
    const d = makeDirective(fakeElement());
    d.id = 'main';
    d.contract = fakeContract([]);
    // no provideSlot bound
    expect(() => {
      d.ngOnInit();
      d.ngAfterViewInit();
      d.ngOnDestroy();
    }).not.toThrow();
  });

  it('re-registers under the new id when the id input changes — old id released first', () => {
    // React's ref-callback sugar releases the old registration and creates the
    // new one automatically when `id` changes; the directive must match
    // (lock-step semantics, ADR-067).
    const log: Array<[string, unknown]> = [];
    const el = fakeElement();
    const d = makeDirective(el);
    d.id = 'main';
    d.contract = fakeContract(log);
    d.provideSlot = () => undefined;

    d.ngOnInit();
    d.ngAfterViewInit();

    d.id = 'info';
    d.ngOnChanges({ id: change('main', 'info', false) } as SimpleChanges);

    expect(log).toEqual([
      ['main', el],
      ['main', null],
      ['info', el],
    ]);

    d.ngOnDestroy();
    expect(log[log.length - 1]).toEqual(['info', null]);
  });

  it('registers once provideSlot arrives late (set after view init)', () => {
    const log: Array<[string, unknown]> = [];
    const el = fakeElement();
    const d = makeDirective(el);
    d.id = 'main';
    d.contract = fakeContract(log);
    // provideSlot not yet delivered at view init (standalone → composed later)
    d.ngOnInit();
    d.ngAfterViewInit();
    expect(log).toEqual([]);

    const received: Array<[string, unknown]> = [];
    d.provideSlot = (slotId, element) => received.push([slotId, element]);
    d.ngOnChanges({ provideSlot: change(undefined, d.provideSlot, false) } as SimpleChanges);

    expect(log).toEqual([['main', el]]);
    expect(received).toEqual([['main', el]]);
  });

  it('does not register on input changes before the view exists', () => {
    const log: Array<[string, unknown]> = [];
    const d = makeDirective(fakeElement());
    d.id = 'main';
    d.contract = fakeContract(log);
    d.provideSlot = () => undefined;

    // Angular calls ngOnChanges before ngOnInit/ngAfterViewInit on first bind.
    d.ngOnChanges({ id: change(undefined, 'main', true) } as SimpleChanges);
    expect(log).toEqual([]);

    d.ngOnInit();
    d.ngAfterViewInit();
    expect(log).toEqual([['main', fakeElement() as unknown]]);
  });

  it('destroy after an id change releases the CURRENT registration, not the original', () => {
    const log: Array<[string, unknown]> = [];
    const el = fakeElement();
    const d = makeDirective(el);
    d.id = 'main';
    d.contract = fakeContract(log);
    d.provideSlot = () => undefined;
    d.ngOnInit();
    d.ngAfterViewInit();
    d.id = 'info';
    d.ngOnChanges({ id: change('main', 'info', false) } as SimpleChanges);
    log.length = 0;

    d.ngOnDestroy();
    expect(log).toEqual([['info', null]]);
  });
});
