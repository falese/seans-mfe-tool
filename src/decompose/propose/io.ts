/**
 * Files in and out of `decompose:propose` and `decompose:score`.
 *
 * Reads what `decompose:analyze` wrote (and the capture's join), writes the
 * proposal and everything derived from it:
 *
 *   decomposition.yaml               the proposal — edit this (ADR-110 §4)
 *   proposal.base.yaml               the deterministic draft, kept to diff edits against
 *   <mfe>/mfe-manifest.yaml          derived, validated
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
import type { DerivedFleet } from './derive';
import { DecompositionSchema, type Decomposition } from './model';
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

/** Write the derived fleet beside a proposal. Returns the paths written. */
export async function writeFleet(outDir: string, fleet: DerivedFleet): Promise<string[]> {
  const written: string[] = [];
  for (const [name, manifest] of Object.entries(fleet.manifests)) {
    const file = path.join(outDir, name, 'mfe-manifest.yaml');
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, `# Derived by decompose:propose from decomposition.yaml — edit the proposal, not this file (ADR-110 §4).\n${dumpYaml(manifest)}`);
    written.push(file);
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
