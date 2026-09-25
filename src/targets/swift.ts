/**
 * Enabling the Swift native target on a manifest (ADR-095, ADR-096).
 *
 * Thin names over `./enable`, which every target shares.
 */

import type { DSLManifest } from '@seans-mfe/dsl';
import { withTarget, enableTargetInFile } from './enable';

/** Return a manifest with the Swift target declared. */
export function withSwiftTarget<T extends Pick<DSLManifest, 'targets'>>(manifest: T): T {
  return withTarget(manifest, 'swift');
}

/** Add `targets.swift` to a manifest file in place. Returns true if it changed. */
export function enableSwiftTargetInFile(manifestPath: string): Promise<boolean> {
  return enableTargetInFile(manifestPath, 'swift', [
    'A SECOND build of this same MFE (ADR-095): the capabilities above are also',
    'generated as a Swift Package under swift/, beside the web remote.',
  ]);
}
