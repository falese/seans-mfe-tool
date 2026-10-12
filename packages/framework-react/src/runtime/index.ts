/**
 * @seans-mfe/framework-react/runtime — React host-side sugar (ADR-056,
 * boundary layer 3). Imported by React host shells and MFEs; never by the
 * neutral core or daemon. Separate entry from the build-time plugin so
 * loadFrameworkPlugin() in Node never pulls React.
 *
 * There is deliberately no React component that mounts an MFE: the
 * LayoutManager from @seans-mfe-tool/runtime is the only mounter (ADR-108).
 * A React shell hands it a container element.
 */
export { DeclaredSlot } from './DeclaredSlot';
export type { DeclaredSlotProps, SlotContractLike } from './DeclaredSlot';
export { useControlPlaneState } from './useControlPlaneState';
export type {
  ControlPlaneStateContextLike,
  ControlPlaneStatePusherLike,
  UseControlPlaneStateOptions,
} from './useControlPlaneState';
