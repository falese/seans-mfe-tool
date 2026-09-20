/**
 * Enabling the Swift native target on a manifest (ADR-095).
 *
 * `--swift` is additive: it declares a SECOND build of the same MFE, so it
 * writes a `targets.swift` block and touches nothing else. `framework` and
 * `bundler` still describe the primary web build, and the capabilities both
 * builds are generated from are untouched.
 *
 * Shared by `remote:init` (new MFEs) and `remote:generate` (retrofitting an
 * existing one) so the two cannot disagree about what the flag means.
 */

import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import type { DSLManifest } from '@seans-mfe/dsl';
import { SystemError } from '@seans-mfe/contracts';

/** Whether the manifest already declares a Swift target. */
export function hasSwiftTarget(manifest: Pick<DSLManifest, 'targets'>): boolean {
  return manifest.targets?.swift !== undefined;
}

/**
 * Return a manifest with the Swift target declared.
 *
 * Deliberately empty: every field of the block is defaulted by the schema, and
 * codegen derives the module name and bundle id from identity the manifest
 * already carries. Writing derived values into the manifest would create a
 * second source for them.
 */
export function withSwiftTarget<T extends Pick<DSLManifest, 'targets'>>(manifest: T): T {
  if (hasSwiftTarget(manifest)) return manifest;
  return { ...manifest, targets: { ...(manifest.targets ?? {}), swift: {} } };
}

/**
 * Add `targets.swift` to a manifest file in place, preserving everything else.
 *
 * Re-serializing the parsed manifest would reformat the whole file and drop
 * comments, and these manifests are hand-maintained and heavily commented. So
 * append the block textually instead, which is also what makes the resulting
 * diff readable: one added stanza rather than a whole-file rewrite.
 *
 * Returns true if the file was changed.
 */
export async function enableSwiftTargetInFile(manifestPath: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (err) {
    throw new SystemError(`Failed to read manifest: ${manifestPath}`, err as Error);
  }

  const parsed = yaml.load(raw) as { targets?: { swift?: unknown } } | undefined;
  if (parsed && typeof parsed === 'object' && parsed.targets?.swift !== undefined) {
    return false;
  }

  if (parsed && typeof parsed === 'object' && parsed.targets !== undefined) {
    // A targets: block exists but has no swift entry. Re-serializing is the
    // only safe edit here, and it is rare enough to accept the reformat.
    const next = { ...parsed, targets: { ...(parsed.targets as object), swift: {} } };
    await fs.writeFile(manifestPath, yaml.dump(next, { noRefs: true, lineWidth: -1 }), 'utf8');
    return true;
  }

  const block = [
    '',
    '# A SECOND build of this same MFE (ADR-095): the capabilities above are also',
    '# generated as a Swift Package under swift/, beside the web remote.',
    'targets:',
    '  swift: {}',
    '',
  ].join('\n');

  const body = raw.endsWith('\n') ? raw : raw + '\n';
  await fs.writeFile(manifestPath, body + block, 'utf8');
  return true;
}
