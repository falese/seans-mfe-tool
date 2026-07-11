/**
 * @seans-mfe/framework-react/runtime — the React composition provider
 * (ADR-056, boundary layer 3). Imported by React host shells; never by the
 * neutral core or daemon. Separate entry from the build-time plugin so
 * loadFrameworkPlugin() in Node never pulls React.
 */
export { MfeHost, useMfe } from './MfeHost';
export type { MfeHostProps, MfeHandleInput, UseMfeOptions } from './MfeHost';
export { DeclaredSlot } from './DeclaredSlot';
export type { DeclaredSlotProps, SlotContractLike } from './DeclaredSlot';
