/**
 * Angular subpath entry for @seans-mfe-tool/runtime
 *
 * Import as: import { AngularRemoteMFE } from '@seans-mfe-tool/runtime/angular'
 *
 * This subpath is intentionally separate from the main index so that React/rspack
 * consumers (RemoteMFE) never pull in @angular/platform-browser (ADR-070).
 */
export { AngularRemoteMFE, AngularApplicationRef } from './angular-remote-mfe';
