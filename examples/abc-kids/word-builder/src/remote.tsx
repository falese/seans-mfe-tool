/**
 * Remote Entry Point — domain capabilities + the ADR-056 presentation handle.
 * Generated from mfe-manifest.yaml
 */
import { createImperativeHandle, type ImperativeMountHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { PlayGame } from './features/PlayGame/PlayGame';
import { ShowCover } from './features/ShowCover/ShowCover';
import { GetGameInfo } from './features/GetGameInfo/GetGameInfo';

export { PlayGame };
export { ShowCover };
export { GetGameInfo };

export { mfe, mfeReady };

/**
 * Presentation handle (ADR-056): a host-side Framework Provider composes this
 * MFE through the sealed port — handles.imperative.mount(element, { capability,
 * props }) → unmount. This MFE is multi-capability (PlayGame, ShowCover, GetGameInfo);
 * the host selects one per mount, defaulting to PlayGame.
 */
export const handles: { imperative: ImperativeMountHandle } = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'PlayGame',
  }),
};

export { default } from './App';
