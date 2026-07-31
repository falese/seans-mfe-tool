/**
 * Angular subpath entry for @falese/smt-runtime
 *
 * Import as: import { AngularRemoteMFE } from '@falese/smt-runtime/angular'
 *
 * This subpath is intentionally separate from the main index so that React/rspack
 * consumers (RemoteMFE) never pull in @angular/platform-browser (ADR-035).
 */
export { AngularRemoteMFE, AngularApplicationRef } from './angular-remote-mfe';
