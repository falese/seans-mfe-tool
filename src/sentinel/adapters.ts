/**
 * SMT's adapters for the Sentinel kernel ports (ADR-089).
 *
 * These live host-side, not in the kernel: the kernel imports nothing from
 * `@seans-mfe/*` (ADR-089 §2), and every host specific — the manifest, the
 * framework templates, the platform-migration registry — is owned here, behind an
 * adapter. This module is the n=1 proof that SMT's existing machinery satisfies
 * the kernel contract: each adapter is a thin wrapper over code that already
 * shipped, and the kernel sees only `{ valid, errors }`, a list of paths, a list
 * of files, and a `HardenedCheck`.
 *
 * SMT is reference implementation #1 (PDR-010). When the kernel is extracted to
 * its own repo, this file stays behind in SMT; a second host writes its own.
 */

import { validateFull, findManifest, type DSLManifest } from '@seans-mfe/dsl';
import {
  generateAllFiles,
  PLATFORM_MIGRATIONS,
  type PlatformMigration,
} from '@seans-mfe/codegen';
import type {
  KernelPorts,
  ValidationOutcome,
  MaterializedFile,
  HardenedCheck,
} from 'sentinel';

/**
 * Port 1 — `validate`. Wraps `validateFull`, the deterministic oracle. The
 * `manifest` field `validateFull` also returns is dropped: the port's contract is
 * a verdict, not the parsed artifact.
 */
export function smtValidate(artifact: unknown): ValidationOutcome {
  const result = validateFull(artifact);
  return { valid: result.valid, errors: result.errors };
}

/**
 * Port 2 — `locateArtifacts`. Wraps `findManifest`, which resolves the one
 * manifest under a directory (or the well-known path). Returned as a list so the
 * port stays honest for a host whose artifacts are many-per-root.
 */
export async function smtLocateArtifacts(root: string): Promise<string[]> {
  const found = await findManifest(root);
  return found ? [found] : [];
}

/**
 * Port 3 — `materialize`. Wraps `generateAllFiles`, carrying the `overwrite`
 * ownership seam (ADR-082, ADR-043) straight through: the kernel does not
 * interpret it, but a host that has it does not lose it at the port.
 */
export async function smtMaterialize(
  artifact: DSLManifest,
  basePath: string,
): Promise<MaterializedFile[]> {
  const { files } = await generateAllFiles(artifact, basePath);
  return files.map((file) => ({
    path: file.path,
    content: file.content,
    overwrite: file.overwrite,
  }));
}

/**
 * Port 4 — the `HardenedCheck`. A `PlatformMigration` (ADR-082) *is* a hardened
 * check: matcher, fix, and the decision it enforces. This maps the SMT registry
 * onto the kernel type; the only rename is `adr` → `enforces`, because the kernel
 * does not own SMT's record-numbering scheme.
 */
export function platformMigrationToHardenedCheck(
  migration: PlatformMigration,
): HardenedCheck {
  return {
    id: migration.id,
    message: migration.message,
    fix: migration.fix,
    enforces: migration.adr,
    pattern: migration.pattern,
    exempt: migration.exempt,
  };
}

/** SMT's whole migration registry as kernel `HardenedCheck`s. */
export const smtHardenedChecks: readonly HardenedCheck[] =
  PLATFORM_MIGRATIONS.map(platformMigrationToHardenedCheck);

/**
 * SMT's implementation of the kernel port bundle. `materialize` is present
 * because SMT is a generating host, not an audit-only one (ADR-089 §3).
 */
export const smtPorts: KernelPorts<DSLManifest> = {
  validate: smtValidate,
  locateArtifacts: smtLocateArtifacts,
  materialize: smtMaterialize,
};
