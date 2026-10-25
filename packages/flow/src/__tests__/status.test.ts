import { ValidationError } from '@seans-mfe/contracts';
import { flowStatus, loadFlow, type FlowChecks, type FlowProbe } from '../index';

const FLOW = `
id: demo
title: A demo flow
root: the work directory
inputs:
  appUrl: { from: bundle.json, field: app, otherwise: <app-url> }
  appDir: { from: source/project.json, field: dir, otherwise: <app-dir> }
steps:
  - id: capture
    title: Run the app
    produces: [bundle.json]
    command: capture {appUrl} --out {root}
  - id: analyze
    title: Read the source
    after: [capture]
    produces: [source/graph.json]
    command: analyze {appDir} --evidence {root}
  - id: propose
    title: Propose
    after: [analyze]
    produces: [proposal/base.yaml, proposal/doc.yaml]
    command: propose {root}
  - id: shape
    title: Shape it
    kind: optional
    after: [propose]
    check: waiting-suggestions
    command: workspace {root}/proposal
  - id: present
    title: Present
    after: [propose]
    produces: [proposal/PROPOSAL.md]
    command: present {root}/proposal
  - id: approve
    title: Approve
    kind: gate
    after: [present]
    check: approved
    command: workspace {root}/proposal
  - id: scaffold
    title: Scaffold
    after: [approve]
    available: false
    issue: '#410'
  - id: verify
    title: Verify
    after: [scaffold]
    produces: [../verify/parity.json]
    command: verify {root}
`;

/** A disk as a map of path → mtime (and JSON for the ones read). */
function disk(files: Record<string, number>, json: Record<string, unknown> = {}): FlowProbe {
  return {
    mtime: (p) => files[p] ?? null,
    readJson: (p) => (p in json ? json[p] : undefined),
  };
}

const checks = (approved: { done: boolean; stale?: boolean } = { done: false }): FlowChecks => ({
  approved: () => ({ ...approved, detail: approved.done ? 'approved by sean' : 'not approved yet' }),
  'waiting-suggestions': () => ({ done: false, detail: '2 suggestions waiting' }),
});

const ROOT = '/w/ev';
const at = (p: string) => `${ROOT}/${p}`;

describe('loadFlow', () => {
  it('parses a flow document', () => {
    const flow = loadFlow(FLOW);
    expect(flow.id).toBe('demo');
    expect(flow.steps.map((s) => s.id)).toEqual(['capture', 'analyze', 'propose', 'shape', 'present', 'approve', 'scaffold', 'verify']);
  });

  it('refuses a malformed flow, naming what is wrong', () => {
    expect(() => loadFlow('id: x\ntitle: y\nroot: z\nsteps:\n  - id: a\n    title: A\n    after: [missing]\n    produces: [a]\n    command: a\n')).toThrow(ValidationError);
    expect(() => loadFlow('id: x\ntitle: y\nroot: z\nsteps:\n  - id: a\n    title: A\n    after: [missing]\n    produces: [a]\n    command: a\n')).toThrow(/missing/);
    expect(() => loadFlow('id: x\nsteps: 3\n')).toThrow(ValidationError);
  });
});

describe('flowStatus — where a directory stands, derived from its files (ADR-119 §2)', () => {
  const flow = loadFlow(FLOW);

  it('on an empty directory, the first step is next, with its placeholder input named', () => {
    const s = flowStatus(flow, ROOT, disk({}), checks());
    expect(s.steps.map((x) => [x.id, x.state])).toEqual([
      ['capture', 'next'],
      ['analyze', 'blocked'],
      ['propose', 'blocked'],
      ['shape', 'optional'],
      ['present', 'blocked'],
      ['approve', 'blocked'],
      ['scaffold', 'unavailable'],
      ['verify', 'blocked'],
    ]);
    expect(s.next).toEqual({ step: 'capture', command: `capture <app-url> --out ${ROOT}`, placeholders: ['<app-url>'] });
  });

  it('fills later commands from what earlier steps recorded', () => {
    const s = flowStatus(flow, ROOT, disk({ [at('bundle.json')]: 1 }, { [at('bundle.json')]: { app: 'http://localhost:5090' } }), checks());
    expect(s.steps[0].state).toBe('done');
    expect(s.next).toEqual({ step: 'analyze', command: `analyze <app-dir> --evidence ${ROOT}`, placeholders: ['<app-dir>'] });
    expect(s.steps[0].command).toBe(`capture http://localhost:5090 --out ${ROOT}`);
  });

  it('waits on a person at a gate, and says why', () => {
    const files = { [at('bundle.json')]: 1, [at('source/graph.json')]: 2, [at('proposal/base.yaml')]: 3, [at('proposal/doc.yaml')]: 3, [at('proposal/PROPOSAL.md')]: 4 };
    const s = flowStatus(flow, ROOT, disk(files), checks());
    expect(s.steps.find((x) => x.id === 'approve')).toMatchObject({ state: 'waiting', detail: 'not approved yet' });
    expect(s.steps.find((x) => x.id === 'shape')).toMatchObject({ state: 'optional', detail: '2 suggestions waiting' });
    expect(s.next).toEqual({ step: 'approve', command: `workspace ${ROOT}/proposal`, placeholders: [] });
  });

  it('marks a step stale when something it follows changed after it, and points next at it', () => {
    // The proposal was edited (doc.yaml at 9) after PROPOSAL.md was written (4).
    const files = { [at('bundle.json')]: 1, [at('source/graph.json')]: 2, [at('proposal/base.yaml')]: 3, [at('proposal/doc.yaml')]: 9, [at('proposal/PROPOSAL.md')]: 4 };
    const s = flowStatus(flow, ROOT, disk(files), checks({ done: true, stale: true }));
    expect(s.steps.find((x) => x.id === 'present')).toMatchObject({ state: 'stale', detail: expect.stringContaining('proposal/doc.yaml') });
    expect(s.steps.find((x) => x.id === 'approve')?.state).toBe('stale');
    expect(s.next?.step).toBe('present');
  });

  it('compares a step against its own first output only, so later edits to its other outputs do not stale it', () => {
    const files = { [at('bundle.json')]: 1, [at('source/graph.json')]: 2, [at('proposal/base.yaml')]: 3, [at('proposal/doc.yaml')]: 9 };
    const s = flowStatus(flow, ROOT, disk(files), checks());
    expect(s.steps.find((x) => x.id === 'propose')?.state).toBe('done');
  });

  it('is honest about steps that are not built, and what they block', () => {
    const files = { [at('bundle.json')]: 1, [at('source/graph.json')]: 2, [at('proposal/base.yaml')]: 3, [at('proposal/doc.yaml')]: 3, [at('proposal/PROPOSAL.md')]: 4 };
    const s = flowStatus(flow, ROOT, disk(files), checks({ done: true }));
    expect(s.steps.find((x) => x.id === 'scaffold')).toMatchObject({ state: 'unavailable', detail: expect.stringContaining('#410') });
    expect(s.steps.find((x) => x.id === 'verify')).toMatchObject({ state: 'blocked', detail: expect.stringContaining('scaffold') });
    expect(s.next).toBeNull();
    expect(s.summary).toMatch(/scaffold/);
  });

  it('refuses a check the host did not register', () => {
    expect(() => flowStatus(flow, ROOT, disk({}), {})).toThrow(/approved/);
  });
});
