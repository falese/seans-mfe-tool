import * as path from 'path';
import * as ts from 'typescript';
import type { Decomposition } from '@seans-mfe/decompose';
import { readProject } from '../../decompose/source/load';
import { buildSourceGraph } from '../../decompose/source/graph';
import { inventoryTests } from '../../decompose/source/tests';
import { propose } from '../../decompose/propose/cluster';
import { stopAndAsk, structuralErrors, validateDecomposition } from '../decomposition';

const MONOLITH = path.resolve(__dirname, '../../../examples/meridian-monolith');
const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };

function doc(over: Partial<Decomposition> = {}): Decomposition {
  return {
    version: 1,
    app: { name: 'app', namespace: 'app', gateway: true },
    domains: [
      { id: 'shell', mfe: 'app-shell', shell: true, files: ['src/App.tsx'], capabilities: [{ name: 'App', file: 'src/App.tsx', component: 'App' }], backends: [], endpoints: [], evidence, reasons: [] },
      { id: 'a', mfe: 'app-a', shell: false, files: ['src/A.tsx'], capabilities: [{ name: 'A', file: 'src/A.tsx', component: 'A' }], backends: ['x'], endpoints: ['GET /api/x/a'], evidence, reasons: [] },
      { id: 'b', mfe: 'app-b', shell: false, files: ['src/B.tsx'], capabilities: [{ name: 'B', file: 'src/B.tsx', component: 'B' }], backends: ['x'], endpoints: ['GET /api/x/b'], evidence, reasons: [] },
    ],
    shared: [], unassigned: [], couplings: [],
    slots: [{ id: 'main', provider: 'shell', repeated: false }],
    routes: [{ path: '/a', stateKey: 'app.open.a', place: [{ capability: 'A', domain: 'a', slot: 'main' }] }],
    repeated: [], tests: [], uncovered: [],
    ...over,
  };
}

describe('the decomposition playbook as a ValidatePort (#420, ADR-089)', () => {
  it('accepts a proposal whose every file, capability and placement resolves', async () => {
    expect(await validateDecomposition(doc())).toEqual({ valid: true, errors: [] });
  });

  it('refuses a file or a capability claimed by two domains', () => {
    const d = doc();
    d.domains[2].files.push('src/A.tsx');
    d.domains[2].capabilities.push({ name: 'A', file: 'src/A.tsx', component: 'A' });
    expect(structuralErrors(d).map((e) => e.code)).toEqual(['file-claimed-twice', 'capability-claimed-twice', 'placement-resolves']);
  });

  it('refuses placements of capabilities or into slots that do not exist, and two shells', () => {
    const d = doc({ routes: [{ path: '/', stateKey: 'app.x', place: [{ capability: 'Nope', domain: 'a', slot: 'side' }] }] });
    d.domains[1].shell = true;
    expect(structuralErrors(d).map((e) => `${e.code}: ${e.message}`)).toEqual([
      'one-shell: more than one shell domain: shell, a',
      'placement-resolves: places Nope from a, which has no such capability',
      'placement-resolves: places Nope into side, which no domain provides',
    ]);
  });

  it('refuses what is not a decomposition at all', async () => {
    const out = await validateDecomposition({ version: 2 });
    expect(out.valid).toBe(false);
    expect(out.errors[0].code).toBe('schema');
  });

  it('stops and asks on weak evidence, a backend every domain calls, and a domain that owns no data', () => {
    const d = doc();
    d.domains[1].evidence = { route: 0.2, data: 0.3, imports: null, runtime: null, cochange: null, ownership: null };
    d.domains[2].endpoints = ['GET /api/x/a'];
    expect(stopAndAsk(d).map((f) => `${f.code}${f.domain ? ` ${f.domain}` : ''}`)).toEqual(['low-evidence a', 'backend-everywhere', 'no-data-of-its-own a', 'no-data-of-its-own b']);
  });

  it('passes the deterministic meridian-monolith proposal, and says what to ask about', async () => {
    const project = await readProject(ts, MONOLITH);
    const tests = await inventoryTests(ts, MONOLITH, project.tests, new Set(project.facts.map((f) => f.file)), false);
    const proposal = propose({ appName: 'meridian-ops', namespace: 'meridian-ops', graph: buildSourceGraph(project.facts), tests });
    expect(await validateDecomposition(proposal)).toEqual({ valid: true, errors: [] });
    // Meridian's boundaries are well evidenced and each domain owns some data: nothing to stop for.
    expect(stopAndAsk(proposal)).toEqual([]);
  });
});
