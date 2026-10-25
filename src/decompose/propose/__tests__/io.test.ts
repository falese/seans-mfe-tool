import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSpecs, writeFleet, writeSpecs, type DerivedFleet } from '@seans-mfe/decompose';
import { readAnalysis, readAnswerKey, readTraffic } from '../io';

describe('readAnswerKey', () => {
  it('reads a behavior written with ": " back as text — YAML parses it as a one-entry map', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'key-'));
    const file = path.join(dir, 'answer-key.yaml');
    fs.writeFileSync(file, 'domains: []\nfiles: {}\nuntested_behaviors:\n  - TrafficLog sorting\n  - Routing: each path renders the right pair\n');
    const key = await readAnswerKey(file);
    expect(key.untested_behaviors).toEqual(['TrafficLog sorting', 'Routing: each path renders the right pair']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('specs on disk (ADR-112)', () => {
  const doc = {
    openapi: '3.0.3',
    info: { title: 'hm (inferred)', version: '0.0.0-inferred' },
    paths: { '/berths': { get: { operationId: 'listBerths', responses: { '200': { description: 'ok' } } } } },
  };

  it('round-trips the proposal’s specs and their recorded responses', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specs-'));
    expect(await readSpecs(dir)).toBeUndefined();
    const written = await writeSpecs(dir, { specs: { harbormaster: doc }, mocks: { harbormaster: { listBerths: [{ id: 1 }] } } });
    expect(written.map((f) => path.relative(dir, f))).toEqual(['specs/harbormaster.yaml', 'specs/harbormaster.mocks.json']);
    expect(await readSpecs(dir)).toEqual({ specs: { harbormaster: doc }, mocks: { harbormaster: { listBerths: [{ id: 1 }] } } });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the traffic a capture recorded', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
    expect(await readTraffic(dir)).toBeUndefined();
    fs.writeFileSync(path.join(dir, 'bundle.json'), JSON.stringify({ app: 'http://localhost:5090', format: 'smt-evidence/1' }));
    fs.writeFileSync(path.join(dir, 'requests.json'), JSON.stringify([{ id: 'a.0.r0', method: 'GET', url: '/api/hm/berths', status: 200 }]));
    fs.writeFileSync(path.join(dir, 'responses.json'), JSON.stringify({ 'GET /api/hm/berths': { status: 200, mimeType: 'application/json', body: [] } }));
    expect(await readTraffic(dir)).toEqual({
      appUrl: 'http://localhost:5090',
      requests: [{ id: 'a.0.r0', method: 'GET', url: '/api/hm/berths', status: 200 }],
      responses: { 'GET /api/hm/berths': { status: 200, mimeType: 'application/json', body: [] } },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes each BFF’s specs beside its manifest and its fixtures where the BFF codegen reads them', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-'));
    const fleet = {
      manifests: { 'm-docking': { name: 'm-docking' } },
      composition: { project: 'm', namespace: 'm', mfes: ['m-docking'], routes: [] },
      bff: { 'm-docking': { specs: { harbormaster: doc }, mocks: { listBerths: [] } } },
      validation: { manifests: {}, composition: [] },
    } as unknown as DerivedFleet;
    const written = (await writeFleet(dir, fleet)).map((f) => path.relative(dir, f));
    expect(written).toEqual([
      'm-docking/mfe-manifest.yaml',
      'm-docking/specs/harbormaster.yaml',
      'm-docking/src/platform/bff/mocks.json',
      'control-plane/control-plane.yaml',
    ]);
    const mocks = JSON.parse(fs.readFileSync(path.join(dir, 'm-docking/src/platform/bff/mocks.json'), 'utf8')) as Record<string, unknown>;
    expect(mocks.listBerths).toEqual([]);
    expect(String(mocks._comment)).toContain('ADR-052');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('readAnalysis — where decompose:propose looks', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-'));
  const graph = { files: [], routes: [], endpoints: [] };

  it('takes the analysis directory itself', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph));
    await expect(readAnalysis(dir)).resolves.toMatchObject({ dir, graph });
  });

  it('takes the evidence bundle too, and finds its source/', async () => {
    const bundle = tmp();
    fs.mkdirSync(path.join(bundle, 'source'));
    fs.writeFileSync(path.join(bundle, 'source', 'graph.json'), JSON.stringify(graph));
    await expect(readAnalysis(bundle)).resolves.toMatchObject({ dir: path.join(bundle, 'source'), graph });
  });

  it('says what to run when a capture has not been analysed yet', async () => {
    const bundle = tmp();
    fs.writeFileSync(path.join(bundle, 'bundle.json'), '{}');
    await expect(readAnalysis(bundle)).rejects.toThrow(`${bundle} is an evidence bundle with no analysis yet — run: seans-mfe-tool decompose:analyze <app-dir> --evidence ${bundle}`);
    await expect(readAnalysis(tmp())).rejects.toThrow(/has no graph.json — run decompose:analyze first/);
  });
});
