import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { digestFile, flowStatus, loadFlow, provenanceOf, writeProvenance, type FlowProbe } from '../index';

const FLOW = `
id: demo
title: Demo
root: a directory
steps:
  - id: make
    title: Make the input
    produces: [input.json]
    command: make {root}
  - id: build
    title: Build from it
    after: [make]
    produces: [out/result.json]
    from: [input.json]
    command: build {root}
`;

/** A probe over the real disk, as the CLI's is. */
const probe: FlowProbe = {
  mtime: (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : null),
  readJson: (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : undefined),
  digest: digestFile,
};

describe('provenance — freshness by content, not by clock (ADR-119 §2, as amended)', () => {
  let root: string;
  const flow = loadFlow(FLOW);
  const build = () => flowStatus(flow, root, probe, {}).steps[1];
  const touch = (f: string, secondsAgo: number) => {
    const t = Date.now() / 1000 - secondsAgo;
    fs.utimesSync(f, t, t);
  };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-'));
    fs.writeFileSync(path.join(root, 'input.json'), '{"v":1}');
    fs.mkdirSync(path.join(root, 'out'));
    fs.writeFileSync(path.join(root, 'out', 'result.json'), '{}');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('records what an output was built from, relative to the output, beside it', async () => {
    await writeProvenance(path.join(root, 'out', 'result.json'), [path.join(root, 'input.json')]);
    expect(provenanceOf(path.join(root, 'out', 'result.json'))).toBe(path.join(root, 'out', 'result.json.from.json'));
    expect(JSON.parse(fs.readFileSync(path.join(root, 'out', 'result.json.from.json'), 'utf8'))).toEqual({
      inputs: { '../input.json': digestFile(path.join(root, 'input.json')) },
    });
  });

  it('is fresh when the input’s content is unchanged, however the clock moved — a checkout rewrites mtimes', async () => {
    await writeProvenance(path.join(root, 'out', 'result.json'), [path.join(root, 'input.json')]);
    touch(path.join(root, 'out', 'result.json'), 3600);
    touch(path.join(root, 'input.json'), 0);
    expect(build().state).toBe('done');
  });

  it('is stale when the input’s content changed, however the clock moved', async () => {
    await writeProvenance(path.join(root, 'out', 'result.json'), [path.join(root, 'input.json')]);
    fs.writeFileSync(path.join(root, 'input.json'), '{"v":2}');
    touch(path.join(root, 'input.json'), 3600);
    touch(path.join(root, 'out', 'result.json'), 0);
    expect(build()).toMatchObject({ state: 'stale', detail: 'input.json changed since out/result.json was built' });
  });

  it('falls back to timestamps for an output written before provenance was recorded, and says so', () => {
    touch(path.join(root, 'out', 'result.json'), 3600);
    touch(path.join(root, 'input.json'), 0);
    expect(build()).toMatchObject({ state: 'stale', detail: expect.stringContaining('by timestamp') });
  });
});
