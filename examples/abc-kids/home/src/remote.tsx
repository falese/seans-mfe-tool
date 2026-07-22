/**
 * Remote Entry Point — domain capabilities + the ADR-056 presentation handle.
 * Generated from mfe-manifest.yaml
 */
import { createImperativeHandle, type ImperativeMountHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { GameMenu } from './features/GameMenu/GameMenu';

export { GameMenu };

export { mfe, mfeReady };

/**
 * Presentation handle (ADR-056): a host-side Framework Provider composes this
 * MFE through the sealed port — handles.imperative.mount(element, { capability,
 * props }) → unmount. This MFE is multi-capability (GameMenu);
 * the host selects one per mount, defaulting to GameMenu.
 */
export const handles: { imperative: ImperativeMountHandle } = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'GameMenu',
  }),
};

export { default } from './App';
