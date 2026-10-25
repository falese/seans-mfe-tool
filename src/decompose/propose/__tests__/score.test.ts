import { diffProposals, scoreProposal, type AnswerKey } from '../score';
import { applyEdits, type Decomposition, type Domain } from '@seans-mfe/decompose';

const evidence = { route: null, data: null, imports: null, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `app-${id}`, shell: false, files, capabilities: [], backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

const KEY: AnswerKey = {
  domains: [
    { id: 'console', capabilities: ['StationConsole'], backends: [] },
    { id: 'docking', capabilities: ['DockingBoard', 'TrafficLog'], backends: ['Harbormaster', 'StellarLedger'] },
    { id: 'life-support', capabilities: ['TelemetryDashboard', 'ModuleStatus'], backends: ['StationOS'] },
  ],
  backends: { Harbormaster: { proxy: '/api/harbormaster' }, StellarLedger: { proxy: '/api/ledger' }, StationOS: { proxy: '/api/stationos' } },
  files: {
    'src/App.tsx': 'console',
    'src/Board.tsx': 'docking',
    'src/Log.tsx': 'docking',
    'src/Life.tsx': 'life-support',
    'src/Module.tsx': 'life-support',
    'src/helpers.ts': 'shared',
  },
  routes: {
    '/docking': { main: 'DockingBoard', status: 'TrafficLog' },
    '/life-support': { main: 'TelemetryDashboard', status: null },
  },
  tests: [
    { file: 'src/__tests__/Board.test.tsx', verdict: 'keep' },
    { file: 'src/__tests__/Life.test.tsx', verdict: 'rewrite' },
  ],
  untested_behaviors: ['TrafficLog sorting newest-first', 'ModuleStatus worst-level dot', 'Routing: each path renders the right pair'],
};

function base(): Decomposition {
  return {
    version: 1,
    app: { name: 'app', namespace: 'app' },
    domains: [
      domain('shell', ['src/App.tsx'], { shell: true }),
      domain('docking', ['src/Board.tsx', 'src/Log.tsx'], {
        backends: ['harbormaster', 'ledger'],
        capabilities: [
          { name: 'DockingBoard', file: 'src/Board.tsx', component: 'DockingBoard' },
          { name: 'TrafficLog', file: 'src/Log.tsx', component: 'TrafficLog' },
        ],
      }),
      // Module.tsx wrongly left in its own domain.
      domain('life-support', ['src/Life.tsx'], {
        backends: ['stationos'],
        capabilities: [{ name: 'LifeSupportPage', file: 'src/Life.tsx', component: 'LifeSupportPage' }],
      }),
      domain('home', ['src/Module.tsx'], { backends: ['stationos'] }),
    ],
    shared: [{ file: 'src/helpers.ts', usedBy: [], suggestion: 'split by domain' }],
    unassigned: [],
    couplings: [],
    slots: [],
    routes: [
      { path: '/docking', stateKey: 'app.open.docking', place: [
        { capability: 'DockingBoard', domain: 'docking', slot: 'main' },
        { capability: 'TrafficLog', domain: 'docking', slot: 'aside' },
      ] },
      { path: '/life-support', stateKey: 'app.open.life-support', place: [{ capability: 'LifeSupportPage', domain: 'life-support', slot: 'main' }] },
    ],
    repeated: [],
    tests: [
      { file: 'src/__tests__/Board.test.tsx', domain: 'docking', verdict: 'keep', reasons: [] },
      { file: 'src/__tests__/Life.test.tsx', domain: 'life-support', verdict: 'keep', reasons: [] },
    ],
    uncovered: [{ capability: 'TrafficLog', domain: 'docking', file: 'src/Log.tsx', reason: '' }],
  };
}

describe('scoreProposal', () => {
  const score = scoreProposal(base(), KEY);

  it('scores file assignment after matching domains by overlap, not by name', () => {
    expect(score.domainMap).toEqual({ shell: 'console', docking: 'docking', 'life-support': 'life-support', home: null });
    // 5 of 6 files right: Module.tsx sits in an unmatched domain.
    expect(score.assignment).toMatchObject({ correct: 5, total: 6, f1: 0.833 });
  });

  it('scores backends per answer domain, mapped through the proxy paths', () => {
    expect(score.backends.perDomain).toEqual({ console: 1, docking: 1, 'life-support': 1 });
    expect(score.backends.mean).toBe(1);
  });

  it('scores slot structure with slots matched by co-occurrence, not by name', () => {
    expect(score.slots.slotMap).toEqual({ main: 'main', aside: 'status' });
    expect(score.slots).toMatchObject({ matched: 3, total: 3, score: 1 });
  });

  it('scores test triage agreement', () => {
    expect(score.tests).toEqual({ agree: 1, total: 2, score: 0.5, disagreements: [{ file: 'src/__tests__/Life.test.tsx', proposed: 'keep', expected: 'rewrite' }] });
  });

  it('scores gap detection by the components each untested behavior names', () => {
    expect(score.gaps).toEqual({
      detected: ['TrafficLog sorting newest-first'],
      missed: ['ModuleStatus worst-level dot'],
      unmatchable: ['Routing: each path renders the right pair'],
      recall: 0.333,
    });
  });
});

describe('scoreProposal — gap matching', () => {
  it('matches behaviors that name a domain or a component in plain words, through the domain they land in', () => {
    const key = { ...KEY, untested_behaviors: ['Life support board settlement label', 'The whole docking board', 'Traffic log sorting'] };
    const doc = base();
    doc.uncovered = [{ capability: 'LifeSupportPage', domain: 'life-support', file: 'src/Life.tsx', reason: '' }];
    const { gaps } = scoreProposal(doc, key);
    // "Life support" names the life-support domain, which has an uncovered capability.
    expect(gaps.detected).toEqual(['Life support board settlement label']);
    // "Traffic log" is TrafficLog in words; covered here, so missed. "docking board" likewise.
    expect(gaps.missed.sort()).toEqual(['The whole docking board', 'Traffic log sorting']);
  });
});

describe('diffProposals', () => {
  it('round-trips with applyEdits: the edits it lists are the edits that were applied', () => {
    const edits = [
      { kind: 'rename-domain' as const, from: 'shell', to: 'console' },
      { kind: 'move-file' as const, file: 'src/Module.tsx', to: 'life-support' },
    ];
    const listed = diffProposals(base(), applyEdits(base(), edits));
    expect(listed[0]).toEqual({ kind: 'rename-domain', from: 'shell', to: 'console' });
    expect(listed).toContainEqual(expect.objectContaining({ kind: 'move-file', file: 'src/Module.tsx', to: 'life-support' }));
  });

  it('records the agent’s judgment as edits: renames and moves', () => {
    const edited = base();
    edited.domains[0].id = 'console';
    edited.domains[2].files.push('src/Module.tsx');
    edited.domains.splice(3, 1);
    edited.domains[2].capabilities[0].name = 'TelemetryDashboard';
    expect(diffProposals(base(), edited)).toEqual([
      { kind: 'rename-domain', from: 'shell', to: 'console' },
      { kind: 'move-file', file: 'src/Module.tsx', from: 'home', to: 'life-support' },
      { kind: 'remove-domain', domain: 'home' },
      { kind: 'rename-capability', domain: 'life-support', from: 'LifeSupportPage', to: 'TelemetryDashboard' },
    ]);
    expect(scoreProposal(edited, KEY).assignment.f1).toBe(1);
  });

  it('records slot renames from repeated placements too', () => {
    const b = base();
    b.repeated = [{ capability: 'Tile', domain: 'docking', slot: 'tile.{id}', renderedBy: 'src/Strip.tsx' }];
    const e = base();
    e.repeated = [{ capability: 'Tile', domain: 'docking', slot: 'berth.{id}', renderedBy: 'src/Strip.tsx' }];
    expect(diffProposals(b, e)).toEqual([{ kind: 'rename-slot', from: 'tile.{id}', to: 'berth.{id}' }]);
  });
});
