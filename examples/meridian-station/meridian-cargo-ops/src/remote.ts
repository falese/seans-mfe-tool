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

import { CargoManifestComponent } from './features/CargoManifest/CargoManifest.component';
import { HazardSummaryComponent } from './features/HazardSummary/HazardSummary.component';

export { CargoManifestComponent };
export { HazardSummaryComponent };

export { mfe, mfeReady } from './platform/base-mfe/bootstrap';
