/**
 * Remote Entry Point — domain capabilities + the ADR-056 presentation handle.
 * Generated from mfe-manifest.yaml
 */
import { createImperativeHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { StationConsole } from './features/StationConsole/StationConsole.tsx';

export { StationConsole };

export { mfe, mfeReady };

/**
 * Presentation handle (ADR-056): a host-side Framework Provider composes this
 * MFE through the sealed port — handles.imperative.mount(element, { capability,
 * props }) → unmount. This MFE is multi-capability (StationConsole);
 * the host selects one per mount, defaulting to StationConsole.
 */
export const handles = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'StationConsole',
  }),
};

export { default } from './App.tsx';
