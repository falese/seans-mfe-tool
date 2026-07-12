/**
 * DeclaredSlot (ADR-067, three-layer split) — the React registration sugar
 * over the framework-free slot contract. Written once here; never generated.
 *
 * The contract logic (matching, declare-before-register guard) lives in
 * `@seans-mfe-tool/runtime` (`createSlotContract`); this component only wires
 * it to React's lifecycle: assert on render, register the element via a
 * stable ref callback. Re-registration on remount is safe — the host re-binds
 * the address's desired experience instead of destroying it (ADR-066).
 *
 * This module imports React by design — it is boundary layer 3 (host-side
 * sugar), same posture as MfeHost. React is a peer dependency. The contract
 * is accepted structurally so this package needs no dependency on the runtime
 * package: `createSlotContract(...)` satisfies `SlotContractLike`.
 *
 * Mirrored by the generated template
 * packages/codegen/templates/base-mfe/slots.tsx.ejs (same component with the
 * contract pre-bound — generated MFEs do not depend on framework-react). A
 * change to ref-callback or registration semantics must land in both.
 */
import * as React from 'react';

/** Structural view of `SlotContract` from `@seans-mfe-tool/runtime`. */
export interface SlotContractLike {
  assertDeclared(id: string): void;
  register<E>(
    provideSlot: ((slotId: string, element: E | null) => void) | undefined,
    id: string,
    element: E | null
  ): void;
}

export interface DeclaredSlotProps {
  /** The MFE's slot contract, built from its manifest's providesSlots. */
  contract: SlotContractLike;
  /** The slot id to register — must match a manifest declaration. */
  id: string;
  /**
   * Host registration callback (ADR-058), delivered through render props by
   * the LayoutManager adaptor. Optional: absent in standalone/dev mode, where
   * the region renders inert but undeclared ids still fail fast.
   */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
  className?: string;
  children?: React.ReactNode;
}

export function DeclaredSlot({
  contract,
  id,
  provideSlot,
  className,
  children,
}: DeclaredSlotProps): React.ReactElement {
  contract.assertDeclared(id);

  const register = React.useCallback(
    (element: HTMLElement | null) => contract.register(provideSlot, id, element),
    [contract, id, provideSlot]
  );

  return (
    <div ref={register} className={className} data-declared-slot={id}>
      {children}
    </div>
  );
}
