/**
 * Remote Entry Point — Angular standalone components for Module Federation
 * Exports all domain capabilities so the host can dynamic-import them.
 * Generated from mfe-manifest.yaml.
 */
// Ensure Zone is present on the federated path too: when a non-Angular host
// (e.g. a React shell) loads this remote and calls bootstrapApplication(),
// the standalone dev polyfills (angular.json) have NOT run, so import zone.js here.
import 'zone.js';
import './platform/base-mfe/bootstrap';

import { PlayGameComponent } from './features/PlayGame/PlayGame.component';
import { ShowCoverComponent } from './features/ShowCover/ShowCover.component';
import { GetGameInfoComponent } from './features/GetGameInfo/GetGameInfo.component';

export { PlayGameComponent };
export { ShowCoverComponent };
export { GetGameInfoComponent };

export { mfe, mfeReady } from './platform/base-mfe/bootstrap';
