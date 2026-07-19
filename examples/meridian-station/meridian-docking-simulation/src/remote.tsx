/**
 * Remote Entry Point — domain capabilities + the ADR-056 presentation handle.
 * Generated from mfe-manifest.yaml
 */
import { createImperativeHandle, type ImperativeMountHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { DockingSimulation } from './features/DockingSimulation/DockingSimulation';
import { ShipControl } from './features/ShipControl/ShipControl';

export { DockingSimulation };
export { ShipControl };

export { mfe, mfeReady };

/**
 * Presentation handle (ADR-056): a host-side Framework Provider composes this
 * MFE through the sealed port — handles.imperative.mount(element, { capability,
 * props }) → unmount. This MFE is multi-capability (DockingSimulation, ShipControl);
 * the host selects one per mount, defaulting to DockingSimulation.
 */
export const handles: { imperative: ImperativeMountHandle } = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'DockingSimulation',
  }),
};

export { default } from './App';
