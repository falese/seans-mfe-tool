/**
 * sentinel:validate's core — one kernel run over one host root (#384, ADR-089).
 *
 * n1-proof.test.ts proves each SMT adapter satisfies its port in isolation.
 * This composes them the way a host actually would, so the kernel is on a
 * production path rather than only in a proof:
 *
 *   locateArtifacts(root) → validate(artifact) → materialize(artifact)
 *     → verify(check, source) for every HardenedCheck over developer-owned sources
 *
 * `materialize` is the ownership oracle. Hardened checks describe code the
 * generator does not own and cannot fix (ADR-082), so files it would stamp with
 * `overwrite: true` are excluded. That is the same split mfe:validate draws, but
 * reached through the port instead of by calling the generator directly.
 *
 * Everything host-specific arrives through `ports` and `checks`, defaulting to
 * SMT's adapters. The sequence itself names nothing MFE-shaped.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { load as parseYaml } from 'js-yaml';
import { verify, type HardenedCheck, type KernelPorts } from 'sentinel';
import { ValidationError } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';
import type { SentinelValidateResult } from '../oclif/results';
import { smtPorts, smtHardenedChecks } from './adapters';
import { collectSources } from '../commands/mfe/validate';

type SentinelArtifactResult = SentinelValidateResult['artifacts'][number];
type SentinelHit = SentinelValidateResult['hits'][number];

/** Paths `materialize` would overwrite. Empty when the host has no materialize port or it fails. */
async function generatorOwned(
  ports: KernelPorts<DSLManifest>,
  artifact: DSLManifest,
  root: string,
): Promise<Set<string>> {
  if (!ports.materialize) return new Set();
  try {
    const files = await ports.materialize(artifact, root);
    return new Set(files.filter((f) => f.overwrite).map((f) => path.resolve(f.path)));
  } catch {
    // A generator failure degrades to "scan everything", which can only add
    // hits. mfe:validate degrades the other way (no warnings); here a missing
    // warning is the worse failure, since the checks are the point of the run.
    return new Set();
  }
}

export async function sentinelValidate(
  rootDir: string,
  ports: KernelPorts<DSLManifest> = smtPorts,
  checks: readonly HardenedCheck[] = smtHardenedChecks,
): Promise<SentinelValidateResult> {
  const root = path.resolve(rootDir);

  const located = await ports.locateArtifacts(root);
  if (located.length === 0) {
    throw new ValidationError(`No artifact found under ${root}`, 'root', 'artifact-required');
  }

  const artifacts: SentinelArtifactResult[] = [];
  const hits: SentinelHit[] = [];
  let scanned = 0;

  for (const artifactPath of located) {
    const parsed: unknown = parseYaml(await fs.readFile(artifactPath, 'utf8'));
    // The port is typed over the artifact it vouches for; what it receives is
    // whatever the file parsed to. Validating that is the port's whole job.
    const outcome = await ports.validate(parsed as DSLManifest);
    artifacts.push({ path: path.relative(root, artifactPath), valid: outcome.valid, errors: outcome.errors });
    if (!outcome.valid) continue;

    const owned = await generatorOwned(ports, parsed as DSLManifest, path.dirname(artifactPath));
    const sources = (await collectSources(path.dirname(artifactPath)))
      .filter((s) => !owned.has(path.resolve(s.path)));
    scanned += sources.length;

    for (const source of sources) {
      for (const check of checks) {
        for (const hit of verify(check, source)) {
          hits.push({
            check: check.id,
            enforces: check.enforces,
            message: check.message,
            fix: check.fix,
            location: `${path.relative(root, source.path)}:${hit.line}`,
            text: hit.text,
          });
        }
      }
    }
  }

  const invalid = artifacts.filter((a) => !a.valid);
  if (invalid.length > 0) {
    throw new ValidationError(
      `Invalid artifact(s) under ${root}: ${invalid
        .map((a) => `${a.path} — ${a.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`)
        .join(' | ')}`,
      'artifact',
      'invalid',
    );
  }

  return { root, ok: true, artifacts, checks: checks.length, scanned, hits };
}
