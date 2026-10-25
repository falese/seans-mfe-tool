/**
 * The CLI's own inputs to `decompose:propose` and `decompose:score`: what
 * `decompose:analyze` wrote (and the capture's join), the recorded traffic, and
 * an answer key. A proposal directory itself is read and written by
 * `@seans-mfe/decompose` (ADR-118).
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ValidationError } from '@seans-mfe/contracts';
import type { SourceGraph } from '../source/graph';
import type { History } from '../source/history';
import type { Join } from '../source/join';
import type { TestInventory } from '../source/tests';
import type { Observation, RecordedBody } from '@seans-mfe/decompose';
import type { AnswerKey } from './score';

export interface Analysis {
  /** The directory the analysis was read from: the one given, or its `source/`. */
  dir: string;
  project: { name: string; dir: string };
  graph: SourceGraph;
  tests?: TestInventory;
  history?: History;
  join?: Join;
}

async function readOptional<T>(file: string): Promise<T | undefined> {
  return (await fs.pathExists(file)) ? ((await fs.readJson(file)) as T) : undefined;
}

/**
 * Read `decompose:analyze` output from `<given>`: the analysis directory itself
 * (an --out directory, or a bundle's `source/`), or the evidence bundle holding it.
 */
export async function readAnalysis(given: string): Promise<Analysis> {
  const dir = (await fs.pathExists(path.join(given, 'graph.json'))) ? given : path.join(given, 'source');
  const graph = await readOptional<SourceGraph>(path.join(dir, 'graph.json'));
  if (!graph) {
    if (await fs.pathExists(path.join(given, 'bundle.json'))) {
      throw new ValidationError(
        `${given} is an evidence bundle with no analysis yet — run: seans-mfe-tool decompose:analyze <app-dir> --evidence ${given}`,
        'analysis',
        'graph.json'
      );
    }
    throw new ValidationError(`${given} has no graph.json — run decompose:analyze first`, 'analysis', 'graph.json');
  }
  return {
    dir,
    project: (await readOptional<{ name: string; dir: string }>(path.join(dir, 'project.json'))) ?? { name: 'app', dir: '.' },
    graph,
    tests: await readOptional<TestInventory>(path.join(dir, 'tests.json')),
    history: await readOptional<History>(path.join(dir, 'history.json')),
    join: await readOptional<Join>(path.join(dir, 'join.json')),
  };
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

