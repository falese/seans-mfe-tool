/**
 * Slot contract for meridian-console — GENERATED from mfe-manifest `providesSlots`.
 * Do not edit: regenerate after changing the manifest.
 *
 * Three-layer split (ADR-067): this file is the DATA layer — the manifest
 * mirrored into code and bound to the framework-free contract logic in
 * @seans-mfe-tool/runtime. Matching and the declare-before-register guard
 * live there, once; the DeclaredSlot below is thin sugar with no logic of
 * its own. Ids are assigned names, never positions (ADR-066); renaming one
 * is a manifest diff — a contract change, not an incidental string edit.
 */
import React, { useCallback } from 'react';
import { createSlotContract } from '@seans-mfe-tool/runtime';
import type { ProvidedSlotDeclaration } from '@seans-mfe-tool/runtime';

/** The manifest's providesSlots section, mirrored into code. */
export const PROVIDED_SLOTS: readonly ProvidedSlotDeclaration[] = [
  { id: "main", description: "Primary work area — the active domain MFE composes here" },
  { id: "status", description: "Secondary status rail — compact status cards compose here" },
  { id: "berth.{id}", description: "One tile per docking berth on the berth strip, keyed by berth id" },
] as const;

/** This MFE's slot contract: matching + declare-before-register guard. */
export const slotContract = createSlotContract(PROVIDED_SLOTS);

export interface DeclaredSlotProps {
  /** The slot id to register — must match a manifest declaration. */
  id: string;
  /**
   * The host-supplied registration callback (ADR-058), delivered to this MFE
   * through its render props by the LayoutManager adaptor. Optional so the
   * component renders inert in standalone/dev mode — undeclared ids still
   * fail fast either way.
   */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A named region this MFE contributes to the host layout. Registration rides
 * a stable ref callback; re-registration on remount is safe because the host
 * re-binds the address's desired experience instead of destroying it (ADR-066).
 *
 * Keep in lock-step with packages/framework-react/src/runtime/DeclaredSlot.tsx:
 * this is the same component with the contract pre-bound instead of passed as
 * a prop (generated MFEs depend on the runtime package, not framework-react).
 * A change to ref-callback or registration semantics must land in both.
 */
export function DeclaredSlot({
  id,
  provideSlot,
  className,
  children,
}: DeclaredSlotProps): React.ReactElement {
  slotContract.assertDeclared(id);

  const register = useCallback(
    (element: HTMLElement | null) => slotContract.register(provideSlot, id, element),
    [id, provideSlot]
  );

  return (
    <div ref={register} className={className} data-declared-slot={id}>
      {children}
    </div>
  );
}
