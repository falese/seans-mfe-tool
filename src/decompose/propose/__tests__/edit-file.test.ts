import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { editProposalFile } from '../edit-file';
import { dumpYaml } from '../io';
import type { Decomposition, Domain } from '../model';

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], caps: string[], extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `app-${id}`, shell: false, files,
  capabilities: caps.map((name, i) => ({ name, file: files[i] ?? files[0], component: name })),
  backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

const doc = (): Decomposition => ({
  version: 1,
  app: { name: 'app', namespace: 'app', gateway: true },
  domains: [
    domain('shell', ['src/App.tsx'], ['App'], { shell: true }),
    domain('docking', ['src/Board.tsx'], ['Board']),
    domain('cargo', ['src/Manifest.tsx', 'src/Hazards.tsx'], ['Manifest', 'Hazards']),
  ],
  shared: [],
  unassigned: [],
  couplings: [],
  slots: [{ id: 'main', provider: 'shell', repeated: false }],
  routes: [
    { path: '/docking', stateKey: 'app.open.docking', place: [{ capability: 'Board', domain: 'docking', slot: 'main' }] },
    { path: '/cargo', stateKey: 'app.open.cargo', place: [{ capability: 'Manifest', domain: 'cargo', slot: 'main' }] },
  ],
  repeated: [],
  tests: [],
  uncovered: [],
});

describe('editProposalFile', () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'edit-file-'));
    file = path.join(dir, 'decomposition.yaml');
    await fs.writeFile(file, dumpYaml(doc()));
  });
  afterEach(() => fs.remove(dir));

  it('applies the edits, writes the document and the re-derived fleet', async () => {
    const result = await editProposalFile(file, [{ kind: 'rename-domain', from: 'cargo', to: 'freight' }], { dryRun: false });
    expect(result.valid).toBe(true);
    expect(result.edited.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'freight']);
    expect(await fs.readFile(file, 'utf8')).toContain('freight');
    expect(result.files).toContain(file);
    expect(result.files.length).toBeGreaterThan(1);
  });

  it('on a dry run, applies and validates but writes nothing — the oracle’s check (ADR-117 §4)', async () => {
    const before = await fs.readFile(file, 'utf8');
    const listing = await fs.readdir(dir);
    const result = await editProposalFile(file, [{ kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['src/Hazards.tsx'] }], { dryRun: true });
    expect(result.valid).toBe(true);
    expect(result.edited.domains.map((d) => d.id)).toContain('hazmat');
    expect(result.files).toEqual([]);
    expect(await fs.readFile(file, 'utf8')).toBe(before);
    expect(await fs.readdir(dir)).toEqual(listing);
  });

  it('refuses an edit that cannot apply, dry run or not, and leaves the file alone', async () => {
    const before = await fs.readFile(file, 'utf8');
    await expect(editProposalFile(file, [{ kind: 'move-file', file: 'src/Board.tsx', to: 'nowhere' }], { dryRun: true })).rejects.toThrow(/nowhere/);
    expect(await fs.readFile(file, 'utf8')).toBe(before);
  });
});
