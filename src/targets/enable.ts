/**
 * Enabling a secondary build target on a manifest (ADR-095).
 *
 * A target flag (`--swift`, `--rust`) is additive: it declares a SECOND build
 * of the same MFE, so it writes a `targets.<id>` block and touches nothing
 * else. `framework` and `bundler` still describe the primary web build, and
 * the capabilities every build is generated from are untouched.
 *
 * One implementation for every target, shared by `remote:init` (new MFEs) and
 * `remote:generate` (retrofitting an existing one), so no two flags can
 * disagree about what "enable" means.
 */

import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import type { DSLManifest } from '@seans-mfe/dsl';
import { SystemError } from '@seans-mfe/contracts';

type WithTargets = Pick<DSLManifest, 'targets'>;

/** Whether the manifest already declares `targets.<id>`. */
export function hasTarget(manifest: WithTargets, id: string): boolean {
  return (manifest.targets as Record<string, unknown> | undefined)?.[id] !== undefined;
}

/**
 * Return a manifest with `targets.<id>` declared.
 *
 * Deliberately empty: every field of a target block is defaulted by the
 * schema, and codegen derives names from identity the manifest already
 * carries. Writing derived values into the manifest would create a second
 * source for them.
 */
export function withTarget<T extends WithTargets>(manifest: T, id: string): T {
  if (hasTarget(manifest, id)) return manifest;
  return { ...manifest, targets: { ...(manifest.targets ?? {}), [id]: {} } };
}

/**
 * Add `targets.<id>` to a manifest file in place, preserving everything else.
 *
 * Re-serializing the parsed manifest would reformat the whole file and drop
 * comments, and these manifests are hand-maintained and heavily commented. So
 * when there is no `targets:` block yet, append one textually — which is also
 * what makes the resulting diff one added stanza rather than a rewrite.
 * `comment` is written above that block.
 *
 * Returns true if the file was changed.
 */
export async function enableTargetInFile(manifestPath: string, id: string, comment: string[]): Promise<boolean> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (err) {
    throw new SystemError(`Failed to read manifest: ${manifestPath}`, err as Error);
  }

  const parsed = yaml.load(raw) as { targets?: Record<string, unknown> } | undefined;
  if (parsed && typeof parsed === 'object' && parsed.targets?.[id] !== undefined) {
    return false;
  }

  if (parsed && typeof parsed === 'object' && parsed.targets !== undefined) {
    // A targets: block exists without this entry. Re-serializing is the only
    // safe edit here, and it is rare enough to accept the reformat.
    const next = { ...parsed, targets: { ...parsed.targets, [id]: {} } };
    await fs.writeFile(manifestPath, yaml.dump(next, { noRefs: true, lineWidth: -1 }), 'utf8');
    return true;
  }

  const block = ['', ...comment.map((line) => `# ${line}`), 'targets:', `  ${id}: {}`, ''].join('\n');
  const body = raw.endsWith('\n') ? raw : raw + '\n';
  await fs.writeFile(manifestPath, body + block, 'utf8');
  return true;
}
