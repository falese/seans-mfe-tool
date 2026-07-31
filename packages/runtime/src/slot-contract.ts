/**
 * Slot contract logic — re-exported from `@falese/smt-contracts` (ADR-073).
 *
 * The implementation moved so that design-time tooling (the `mfe:validate` and
 * `slots:validate` CLI commands) can share one matcher with the runtime instead
 * of copying the grammar — the drift ADR-069 eliminated. This module stays put
 * because every generated MFE imports `createSlotContract` from
 * `@falese/smt-runtime`; keeping the specifier stable means a pure
 * relocation regenerates no MFE and produces no drift-gate churn.
 *
 * Add nothing here. New slot-contract surface belongs in
 * packages/contracts/src/slot-contract.ts, where both consumers can reach it.
 */
export {
  createSlotContract,
  createSlotAddressRegistry,
  toProvidedSlotAddress,
} from '@falese/smt-contracts';
export type {
  ProvidedSlotDeclaration,
  ProvideSlotFn,
  SlotContract,
  SlotAddressRegistry,
  SlotProviderDeclarations,
  SlotTargetRejection,
  SlotTargetResult,
} from '@falese/smt-contracts';
