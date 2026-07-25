/**
 * Slot contract for abc-kids-home — GENERATED from mfe-manifest `providesSlots`.
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
  { id: "main", description: "Primary game region" },
  { id: "info", description: "Contextual game information region" },
] as const;

/** This MFE's slot contract: matching + declare-before-register guard. */
export const slotContract = createSlotContract(PROVIDED_SLOTS);

/**
 * The ids this MFE may register (ADR-072). Renaming a slot in the manifest
 * makes every stale use site a compile error instead of a runtime throw.
 * A `{param}` segment becomes `${string}`, so a keyed id type-checks by
 * interpolation: `` `berth.${berthId}` ``.
 *
 * Looser than the runtime matcher by necessity — TypeScript cannot express
 * "a string with no dot" — so `assertDeclared()` remains the backstop.
 */
export type DeclaredSlotId = 'main' | 'info';

export interface DeclaredSlotProps extends React.HTMLAttributes<HTMLElement> {
  /** The slot id to register — must be one this manifest declares. */
  id: DeclaredSlotId;
  /**
   * The host-supplied registration callback (ADR-058), delivered to this MFE
   * through its render props by the LayoutManager adaptor. Optional so the
   * component renders inert in standalone/dev mode — undeclared ids still
   * fail fast either way.
   */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
  /** Element to render as the region. Defaults to `div`. */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * A named region this MFE contributes to the host layout. Registration rides
 * a stable ref callback; re-registration on remount is safe because the host
 * re-binds the address's desired experience instead of destroying it (ADR-066).
 *
 * This is the app-code API for providing a slot (ADR-072). `slotContract`
 * stays public as the framework-adaptor escape hatch, but feature code should
 * reach for this component so every region carries the same
 * `data-declared-slot` contract instead of a hand-rolled ref callback.
 *
 * Keep in lock-step with packages/framework-react/src/runtime/DeclaredSlot.tsx:
 * this is the same component with the contract pre-bound instead of passed as
 * a prop (generated MFEs depend on the runtime package, not framework-react).
 * A change to ref-callback or registration semantics must land in both.
 */
export function DeclaredSlot({
  id,
  provideSlot,
  as,
  children,
  ...rest
}: DeclaredSlotProps): React.ReactElement {
  slotContract.assertDeclared(id);

  const register = useCallback(
    (element: HTMLElement | null) => slotContract.register(provideSlot, id, element),
    [id, provideSlot]
  );

  // Narrowed to one concrete tag so `ref` resolves to a single element type
  // rather than the union of every intrinsic element (which has no common
  // callable ref signature). The runtime tag is still whatever `as` supplied;
  // `register` takes HTMLElement, a supertype of every tag's instance type.
  const Element = (as ?? 'div') as 'div';

  return (
    <Element {...rest} ref={register} data-declared-slot={id}>
      {children}
    </Element>
  );
}
