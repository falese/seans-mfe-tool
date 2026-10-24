/**
 * `decompose:analyze` core (ADR-109 §3, #414): read the app's source, build
 * the source graph, inventory its tests, read its history, and join it all to
 * an evidence bundle when one is given.
 *
 * Writes, under the output directory:
 *   graph.json     files (components, imports, endpoints, store reads, screen assignment), routes, entries
 *   history.json   co-change pairs and CODEOWNERS owners
 *   tests.json     the test inventory, with per-test results when the suite ran
 *   join.json      runtime ⇄ source: observed endpoints explained by source, per-file runtime facts
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { stableStringify } from '../bundle';
import { buildSourceGraph, type SourceGraph } from './graph';
import { readHistory, type History } from './history';
import { joinEvidence, type Evidence, type Join } from './join';
import { loadTypeScript, readProject } from './load';
import { inventoryTests, type TestInventory } from './tests';

export interface AnalyzeOptions {
  dir: string;
  srcDir: string;
  outDir: string;
  /** An evidence bundle from decompose:capture to join with. */
  evidenceDir?: string;
  runTests: boolean;
}

export interface AnalyzeOutcome {
  graph: SourceGraph;
  history: History;
  tests: TestInventory;
  join: Join | null;
  files: string[];
}

async function readEvidence(dir: string): Promise<Evidence> {
  const requests = (await fs.readJson(path.join(dir, 'requests.json'))) as Evidence['requests'];
  const steps: Evidence['steps'] = [];
  const journeysDir = path.join(dir, 'journeys');
  for (const name of (await fs.readdir(journeysDir)).filter((n) => n.endsWith('.json')).sort()) {
    const journey = (await fs.readJson(path.join(journeysDir, name))) as { steps: Evidence['steps'] };
    steps.push(...journey.steps);
  }
  return { requests, steps };
}

export async function analyzeProject(options: AnalyzeOptions): Promise<AnalyzeOutcome> {
  const ts = await loadTypeScript();
  const project = await readProject(ts, options.dir, options.srcDir);
  const graph = buildSourceGraph(project.facts);
  const sourceFiles = new Set(project.facts.map((f) => f.file));
  const tests = await inventoryTests(ts, options.dir, project.tests, sourceFiles, options.runTests);
  const history = await readHistory(options.dir, [...sourceFiles, ...project.tests]);
  const join = options.evidenceDir ? joinEvidence(graph, await readEvidence(options.evidenceDir)) : null;

  const out: Record<string, unknown> = { 'graph.json': graph, 'history.json': history, 'tests.json': tests };
  if (join) out['join.json'] = join;
  const files: string[] = [];
  await fs.ensureDir(options.outDir);
  for (const [name, value] of Object.entries(out)) {
    const full = path.join(options.outDir, name);
    await fs.writeFile(full, stableStringify(value));
    files.push(full);
  }
  return { graph, history, tests, join, files: files.sort() };
}
