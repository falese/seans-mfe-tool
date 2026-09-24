/**
 * Enabling the Rust native target on a manifest (ADR-095, ADR-099).
 *
 * Thin names over `./enable`, which every target shares.
 */

import type { DSLManifest } from '@seans-mfe/dsl';
import { hasTarget, withTarget, enableTargetInFile } from './enable';

/** Whether the manifest already declares a Rust target. */
export function hasRustTarget(manifest: Pick<DSLManifest, 'targets'>): boolean {
  return hasTarget(manifest, 'rust');
}

/** Return a manifest with the Rust target declared. */
export function withRustTarget<T extends Pick<DSLManifest, 'targets'>>(manifest: T): T {
  return withTarget(manifest, 'rust');
}

/** Add `targets.rust` to a manifest file in place. Returns true if it changed. */
export function enableRustTargetInFile(manifestPath: string): Promise<boolean> {
  return enableTargetInFile(manifestPath, 'rust', [
    'A SECOND build of this same MFE (ADR-095): the capabilities above are also',
    'generated as a Cargo crate under rust/, beside the web remote.',
  ]);
}
