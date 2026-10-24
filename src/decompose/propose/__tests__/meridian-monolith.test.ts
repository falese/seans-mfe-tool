/**
 * #415 acceptance on the reference monolith, statically (no browser, the
 * app's own tests not run): the deterministic draft clears F1 0.8 against the
 * answer key, and everything derived from it validates.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { readProject } from '../../source/load';
import { buildSourceGraph } from '../../source/graph';
import { inventoryTests } from '../../source/tests';
import { propose } from '../cluster';
import { deriveFleet } from '../derive';
import { readAnswerKey } from '../io';
import { scoreProposal } from '../score';
import type { Decomposition } from '../model';

const MONOLITH = path.resolve(__dirname, '../../../../examples/meridian-monolith');

describe('decompose:propose on meridian-monolith', () => {
  let doc: Decomposition;
  beforeAll(async () => {
    const project = await readProject(ts, MONOLITH);
    const tests = await inventoryTests(ts, MONOLITH, project.tests, new Set(project.facts.map((f) => f.file)), false);
    doc = propose({ appName: 'meridian-ops', namespace: 'meridian-ops', graph: buildSourceGraph(project.facts), tests });
  });

  it('clears component-assignment F1 0.8 against the answer key, before any agent judgment', async () => {
    const score = scoreProposal(doc, await readAnswerKey(path.join(MONOLITH, 'answer-key.yaml')));
    expect(score.assignment.f1).toBeGreaterThanOrEqual(0.8);
    // Every answer domain finds a proposed domain.
    expect(Object.values(score.domainMap).filter(Boolean).sort()).toEqual(['cargo', 'concourse', 'console', 'crew', 'docking', 'docking-simulation', 'life-support']);
    expect(score.backends.mean).toBe(1);
  });

  it('flags the couplings the answer key names', () => {
    expect(doc.couplings.map((c) => `${c.file} → ${c.owner} (${c.kind})`).sort()).toEqual([
      'src/layout/Sidebar.tsx → life-support (shell-read)',
      'src/pages/ConcoursePage.tsx → docking (store-read)',
      'src/pages/cargo/HazardSummary.tsx → docking (store-read)',
    ]);
  });

  it('derives manifests and a composition that all validate', () => {
    const fleet = deriveFleet(doc);
    expect(fleet.validation.composition).toEqual([]);
    for (const [mfe, errors] of Object.entries(fleet.validation.manifests)) expect([mfe, errors]).toEqual([mfe, []]);
    expect(Object.keys(fleet.manifests)).toHaveLength(7);
  });

  it('does not read the answer key while proposing', () => {
    // The key is ground truth for scoring only (answer-key.yaml header).
    const sources = fs.readdirSync(path.join(__dirname, '..')).filter((f) => f.endsWith('.ts'));
    for (const f of sources.filter((f) => f !== 'score.ts' && f !== 'io.ts')) {
      expect([f, fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes('answer-key')]).toEqual([f, false]);
    }
  });
});
