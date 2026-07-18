/**
 * DeclaredSlotDirective (ADR-067, three-layer split) — the Angular registration
 * sugar over the framework-free slot contract. Written once here; never generated.
 *
 * The contract logic (matching, declare-before-register guard) lives in
 * `@seans-mfe-tool/runtime` (`createSlotContract`); this directive only wires it
 * to Angular's element lifecycle: assert on init, register the host element on
 * view init, re-register on input changes (releasing the old id first), release
 * on destroy. Re-registration on remount is safe — the host
 * re-binds the address's desired experience instead of destroying it (ADR-066).
 *
 * This module imports @angular/core by design — it is boundary layer 3 (host-side
 * sugar), the Angular counterpart to framework-react's DeclaredSlot. @angular/core
 * is a peer dependency. The contract is accepted structurally so this package
 * needs no dependency on the runtime package: `createSlotContract(...)` satisfies
 * `SlotContractLike`.
 *
 * Mirrored by the generated template
 * packages/codegen/templates/base-mfe-angular/slots.ts.ejs (same directive with
 * the contract pre-bound — generated MFEs do not depend on framework-angular). A
 * change to lifecycle or registration semantics must land in both.
 *
 * Note: compiled here with plain `tsc` (experimentalDecorators). Angular AOT hosts
 * should prefer the generated, project-compiled source form.
 */
import {
  Directive,
  ElementRef,
  Input,
  type AfterViewInit,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  type SimpleChanges,
} from '@angular/core';

/** Structural view of `SlotContract` from `@seans-mfe-tool/runtime`. */
export interface SlotContractLike {
  assertDeclared(id: string): void;
  register<E>(
    provideSlot: ((slotId: string, element: E | null) => void) | undefined,
    id: string,
    element: E | null
  ): void;
}

/** Host registration callback (ADR-058). */
export type ProvideSlotFn = (slotId: string, element: HTMLElement | null) => void;

/**
 * A named region this MFE contributes to the host layout. Drop the attribute on
 * the region element:
 *
 *   <div [smtDeclaredSlot]="'main'" [contract]="slotContract"
 *        [provideSlot]="provideSlot"></div>
 *
 * The generated `slots.ts` pre-binds `contract`, so provider components pass only
 * `id` and `provideSlot`.
 */
@Directive({
  selector: '[smtDeclaredSlot]',
  standalone: true,
})
export class DeclaredSlotDirective implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  /** The slot id to register — must match a manifest declaration. */
  @Input('smtDeclaredSlot') id!: string;

  /** The MFE's slot contract, built from its manifest's providesSlots. */
  @Input() contract!: SlotContractLike;

  /**
   * Host registration callback (ADR-058), delivered through render props by the
   * LayoutManager adaptor. Optional: absent in standalone/dev mode, where the
   * region renders inert but undeclared ids still fail fast.
   */
  @Input() provideSlot?: ProvideSlotFn;

  /**
   * What is currently registered with the host, captured at registration time
   * so a later input change releases exactly what was registered (old id, old
   * callback, old contract) before re-registering — the Angular equivalent of
   * React's ref-callback release/re-attach on dependency change.
   */
  private registeredWith?: { contract: SlotContractLike; id: string; provideSlot?: ProvideSlotFn };
  private viewReady = false;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    // Fail fast on an undeclared id, before the host ever composes into it.
    this.contract.assertDeclared(this.id);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.registerNow();
  }

  /**
   * React to post-registration input changes: a new `id` (dynamic binding), a
   * late-arriving `provideSlot`, or a swapped `contract` releases the previous
   * registration and re-registers under the current inputs. Before the view
   * exists this is a no-op — ngAfterViewInit performs the first registration.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    const relevant = ['id', 'contract', 'provideSlot'].some(
      (key) => key in changes && !changes[key].firstChange
    );
    if (!relevant) return;
    this.releaseNow();
    this.contract.assertDeclared(this.id);
    this.registerNow();
  }

  ngOnDestroy(): void {
    this.releaseNow();
  }

  private registerNow(): void {
    this.contract.register(this.provideSlot, this.id, this.elementRef.nativeElement);
    this.registeredWith = { contract: this.contract, id: this.id, provideSlot: this.provideSlot };
  }

  private releaseNow(): void {
    if (!this.registeredWith) return;
    const { contract, id, provideSlot } = this.registeredWith;
    this.registeredWith = undefined;
    contract.register(provideSlot, id, null);
  }
}
