/**
 * A proposal directory on disk (ADR-110, ADR-118):
 *
 *   decomposition.yaml               the proposal — changed only by named edits (ADR-110 §4)
 *   specs/<backend>.yaml             each backend's OpenAPI document, inferred or published (ADR-112)
 *   specs/<backend>.mocks.json       its recorded responses by operationId
 *   <mfe>/mfe-manifest.yaml          derived, validated
 *   <mfe>/specs/<backend>.yaml       the spec cut to what the MFE calls — its BFF's data source
 *   <mfe>/src/platform/bff/mocks.json  the BFF's demo fixtures (ADR-052)
 *   control-plane/control-plane.yaml derived, compiled
 *
 * and the evidence bundle's captured steps, which the workspace draws the
 * proposal over (ADR-109).
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ValidationError } from '@seans-mfe/contracts';
import type { BackendSpecs, DerivedFleet } from './derive';
import { DecompositionSchema, type Decomposition } from './model';
import type { OpenApiDocument } from './openapi';
import type { EvidenceStep } from './present';
import { proposalStatus, type ProposalStatus } from './status';

async function readOptional<T>(file: string): Promise<T | undefined> {
  return (await fs.pathExists(file)) ? ((await fs.readJson(file)) as T) : undefined;
}

export const dumpYaml = (value: unknown): string => yaml.dump(value, { lineWidth: -1, noRefs: true, sortKeys: false });

export async function readDecomposition(file: string): Promise<Decomposition> {
  if (!(await fs.pathExists(file))) {
    throw new ValidationError(`no ${path.basename(file)} at ${path.dirname(file)} — run decompose:propose first`, 'decomposition', 'exists');
  }
  let doc: unknown;
  try {
    doc = yaml.load(await fs.readFile(file, 'utf8'));
  } catch (err) {
    throw new ValidationError(`${file} is not valid YAML: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`, 'decomposition', 'yaml');
  }
  const parsed = DecompositionSchema.safeParse(doc);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(`${file}: ${first.path.join('.')}: ${first.message}`, 'decomposition', 'schema');
  }
  return parsed.data;
}

const SPEC_HEADER = '# The backend\'s OpenAPI document, beside the proposal (ADR-112). Replace an inferred one with the published spec when it exists.\n';

/** Write the proposal's per-backend specs and recorded responses under `<dir>/specs/`. */
export async function writeSpecs(dir: string, backends: BackendSpecs): Promise<string[]> {
  const written: string[] = [];
  const specsDir = path.join(dir, 'specs');
  await fs.ensureDir(specsDir);
  for (const name of Object.keys(backends.specs).sort()) {
    const file = path.join(specsDir, `${name}.yaml`);
    await fs.writeFile(file, `${SPEC_HEADER}${dumpYaml(backends.specs[name])}`);
    written.push(file);
    const mocks = backends.mocks?.[name];
    if (mocks && Object.keys(mocks).length > 0) {
      const m = path.join(specsDir, `${name}.mocks.json`);
      await fs.writeFile(m, `${JSON.stringify(mocks, null, 2)}\n`);
      written.push(m);
    }
  }
  return written;
}

/** The proposal's specs, or undefined when it has none. */
export async function readSpecs(dir: string): Promise<BackendSpecs | undefined> {
  const specsDir = path.join(dir, 'specs');
  if (!(await fs.pathExists(specsDir))) return undefined;
  const specs: Record<string, OpenApiDocument> = {};
  const mocks: Record<string, Record<string, unknown>> = {};
  for (const f of (await fs.readdir(specsDir)).sort()) {
    const m = /^(.+)\.ya?ml$/.exec(f);
    if (!m) continue;
    specs[m[1]] = yaml.load(await fs.readFile(path.join(specsDir, f), 'utf8')) as OpenApiDocument;
    const recorded = await readOptional<Record<string, unknown>>(path.join(specsDir, `${m[1]}.mocks.json`));
    if (recorded) mocks[m[1]] = recorded;
  }
  return Object.keys(specs).length > 0 ? { specs, mocks } : undefined;
}

const MOCKS_COMMENT =
  'Demo-mode fixtures (ADR-052), keyed by GraphQL Query field name: the responses decompose:capture recorded from the monolith (ADR-109 §4). ' +
  'Developer-owned: regeneration does not overwrite this file.';

/** Write the derived fleet beside a proposal. Returns the paths written. */
export async function writeFleet(outDir: string, fleet: DerivedFleet): Promise<string[]> {
  const written: string[] = [];
  for (const [name, manifest] of Object.entries(fleet.manifests)) {
    const file = path.join(outDir, name, 'mfe-manifest.yaml');
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, `# Derived by decompose:propose from decomposition.yaml — edit the proposal, not this file (ADR-110 §4).\n${dumpYaml(manifest)}`);
    written.push(file);
    const bff = fleet.bff?.[name];
    if (!bff) continue;
    for (const b of Object.keys(bff.specs).sort()) {
      const spec = path.join(outDir, name, 'specs', `${b}.yaml`);
      await fs.ensureDir(path.dirname(spec));
      await fs.writeFile(spec, `# Derived by decompose:propose: the operations this MFE calls (ADR-112).\n${dumpYaml(bff.specs[b])}`);
      written.push(spec);
    }
    const mocks = path.join(outDir, name, 'src', 'platform', 'bff', 'mocks.json');
    await fs.ensureDir(path.dirname(mocks));
    await fs.writeFile(mocks, `${JSON.stringify({ _comment: MOCKS_COMMENT, ...bff.mocks }, null, 2)}\n`);
    written.push(mocks);
  }
  const cp = path.join(outDir, 'control-plane', 'control-plane.yaml');
  await fs.ensureDir(path.dirname(cp));
  await fs.writeFile(
    cp,
    `# Derived by decompose:propose from decomposition.yaml — edit the proposal, not this file (ADR-110 §4).\n${dumpYaml(fleet.composition)}`
  );
  written.push(cp);
  return written;
}

/** Every captured step of an evidence bundle, journey by journey (ADR-109). */
export async function readEvidenceSteps(bundle: string): Promise<EvidenceStep[]> {
  const dir = path.join(bundle, 'journeys');
  const steps: EvidenceStep[] = [];
  for (const name of (await fs.readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
    const journey = (await fs.readJson(path.join(dir, name))) as { steps: EvidenceStep[] };
    steps.push(...journey.steps);
  }
  return steps;
}

export interface LoadedStatus extends ProposalStatus {
  /** The decomposition.yaml read. */
  proposal: string;
  /** The evidence bundle the screens came from, or null. */
  bundle: string | null;
  warnings: string[];
}

/**
 * A proposal directory as the workspace renders it (ADR-116 §3): the status,
 * with the screens of the evidence bundle (default: the directory's parent)
 * when there is one.
 */
export async function loadProposalStatus(dir: string, opts: { evidence?: string } = {}): Promise<LoadedStatus> {
  const proposal = path.join(path.resolve(dir), 'decomposition.yaml');
  const doc = await readDecomposition(proposal);
  const bundle = path.resolve(opts.evidence ?? path.join(path.resolve(dir), '..'));
  const hasBundle = await fs.pathExists(path.join(bundle, 'bundle.json'));
  const evidence = hasBundle
    ? {
        steps: await readEvidenceSteps(bundle),
        viewport: ((await fs.readJson(path.join(bundle, 'bundle.json'))) as { viewport: { width: number; height: number } }).viewport,
      }
    : {};
  const status = proposalStatus(doc, { specs: await readSpecs(path.resolve(dir)), ...evidence });
  return {
    proposal,
    bundle: hasBundle ? bundle : null,
    ...status,
    warnings: hasBundle ? [] : [`${bundle} is not an evidence bundle — no screens to show (pass --evidence)`],
  };
}
