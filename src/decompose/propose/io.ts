/**
 * Files in and out of `decompose:propose` and `decompose:score`.
 *
 * Reads what `decompose:analyze` wrote (and the capture's join), writes the
 * proposal and everything derived from it:
 *
 *   decomposition.yaml               the proposal — edit this (ADR-110 §4)
 *   proposal.base.yaml               the deterministic draft, kept to diff edits against
 *   specs/<backend>.yaml             the backend's OpenAPI document, inferred or published (ADR-112)
 *   specs/<backend>.mocks.json       its recorded responses by operationId
 *   <mfe>/mfe-manifest.yaml          derived, validated
 *   <mfe>/specs/<backend>.yaml       the spec cut to what the MFE calls — its BFF's data source
 *   <mfe>/src/platform/bff/mocks.json  the BFF's demo fixtures (ADR-052), developer-owned once scaffolded
 *
 * The layout is a fleet's: `compose:validate <out>` reads it as it reads any project.
 *   control-plane/control-plane.yaml derived, compiled
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ValidationError } from '@seans-mfe/contracts';
import type { SourceGraph } from '../source/graph';
import type { History } from '../source/history';
import type { Join } from '../source/join';
import type { TestInventory } from '../source/tests';
import type { BackendSpecs, DerivedFleet } from './derive';
import { DecompositionSchema, type Decomposition } from './model';
import type { Observation, OpenApiDocument, RecordedBody } from './openapi';
import type { AnswerKey } from './score';

export interface Analysis {
  project: { name: string; dir: string };
  graph: SourceGraph;
  tests?: TestInventory;
  history?: History;
  join?: Join;
}

async function readOptional<T>(file: string): Promise<T | undefined> {
  return (await fs.pathExists(file)) ? ((await fs.readJson(file)) as T) : undefined;
}

/** Read `decompose:analyze` output from `<dir>` (an evidence bundle's `source/`, or an --out directory). */
export async function readAnalysis(dir: string): Promise<Analysis> {
  const graph = await readOptional<SourceGraph>(path.join(dir, 'graph.json'));
  if (!graph) {
    throw new ValidationError(`${dir} has no graph.json — run decompose:analyze first`, 'analysis', 'graph.json');
  }
  return {
    project: (await readOptional<{ name: string; dir: string }>(path.join(dir, 'project.json'))) ?? { name: 'app', dir: '.' },
    graph,
    tests: await readOptional<TestInventory>(path.join(dir, 'tests.json')),
    history: await readOptional<History>(path.join(dir, 'history.json')),
    join: await readOptional<Join>(path.join(dir, 'join.json')),
  };
}

export const dumpYaml = (value: unknown): string => yaml.dump(value, { lineWidth: -1, noRefs: true, sortKeys: false });

export async function readDecomposition(file: string): Promise<Decomposition> {
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

export async function readAnswerKey(file: string): Promise<AnswerKey> {
  const doc = yaml.load(await fs.readFile(file, 'utf8')) as Partial<AnswerKey> | null;
  if (!doc || !doc.domains || !doc.files) {
    throw new ValidationError(`${file} is not an answer key (needs domains and files)`, 'answer-key', 'shape');
  }
  return {
    domains: doc.domains,
    backends: doc.backends ?? {},
    files: doc.files,
    routes: doc.routes ?? {},
    tests: doc.tests ?? [],
    // `- Routing: each path …` is a one-entry map to YAML; it was meant as text.
    untested_behaviors: (doc.untested_behaviors ?? []).map((b: unknown) =>
      typeof b === 'string'
        ? b
        : Object.entries(b as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join('; ')
    ),
  };
}

export interface Traffic {
  appUrl: string;
  requests: Observation[];
  responses: Record<string, RecordedBody>;
}

/** The traffic an evidence bundle recorded, or undefined when `dir` is not a bundle. */
export async function readTraffic(dir: string): Promise<Traffic | undefined> {
  const bundle = await readOptional<{ app?: string }>(path.join(dir, 'bundle.json'));
  if (!bundle) return undefined;
  return {
    appUrl: bundle.app ?? '',
    requests: (await readOptional<Observation[]>(path.join(dir, 'requests.json'))) ?? [],
    responses: (await readOptional<Record<string, RecordedBody>>(path.join(dir, 'responses.json'))) ?? {},
  };
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
