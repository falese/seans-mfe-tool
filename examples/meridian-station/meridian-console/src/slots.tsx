/**
 * Slot contract for meridian-console — GENERATED from mfe-manifest `providesSlots`.
 * Do not edit: regenerate after changing the manifest.
 *
 * Three-layer split (ADR-067): this file is the DATA layer — the manifest
 * mirrored into code and bound to the framework-free contract logic in
 * @falese/smt-runtime. Matching and the declare-before-register guard
 * live there, once; the DeclaredSlot below is thin sugar with no logic of
 * its own. Ids are assigned names, never positions (ADR-066); renaming one
 * is a manifest diff — a contract change, not an incidental string edit.
 */
import type * as React from 'react';
import { createSlotContract } from '@falese/smt-runtime';
import type { ProvidedSlotDeclaration } from '@falese/smt-runtime';
import {
  DeclaredSlot as BaseDeclaredSlot,
  type DeclaredSlotProps as BaseDeclaredSlotProps,
} from '@falese/smt-framework-react/runtime';

/** The manifest's providesSlots section, mirrored into code. */
export const PROVIDED_SLOTS: readonly ProvidedSlotDeclaration[] = [
  { id: "main", description: "Primary work area — the active domain MFE composes here" },
  { id: "status", description: "Secondary status rail — compact status cards compose here" },
  { id: "berth.{id}", description: "One tile per docking berth on the berth strip, keyed by berth id" },
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
export type DeclaredSlotId = 'main' | 'status' | `berth.${string}`;

/**
 * Props for this MFE's slot component: the published component's props, minus
 * the two this file supplies — `contract` (pre-bound below) and `id`, which is
 * narrowed from `string` to this manifest's own ids.
 */
export type DeclaredSlotProps = Omit<BaseDeclaredSlotProps, 'id' | 'contract'> & {
  /** The slot id to register — must be one this manifest declares. */
  id: DeclaredSlotId;
};

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
 * A binding, not a copy: the component lives once in
 * `@falese/smt-framework-react` and is imported (ADR-084). It used to be
 * duplicated here — identical but for one identifier — because that package
 * could not be installed by a generated MFE, and the two copies were kept in
 * step by a comment nothing enforced. Registration semantics now change in one
 * place. What stays generated is the part that genuinely varies per manifest:
 * the contract and the `DeclaredSlotId` union.
 */
export function DeclaredSlot(props: DeclaredSlotProps): React.ReactElement {
  return <BaseDeclaredSlot {...props} contract={slotContract} />;
}
