/**
 * #417 on the reference monolith: the deterministic proposal, approved,
 * scaffolds a fleet of generated MFEs, the legacy wrapper and a shell, whose
 * starting composition places the monolith everywhere and compiles.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as ts from 'typescript';
import { applyEdits, dumpYaml, type Decomposition } from '@seans-mfe/decompose';
import { readProject } from '../../source/load';
import { buildSourceGraph } from '../../source/graph';
import { inventoryTests } from '../../source/tests';
import { propose } from '../../propose/cluster';
import { apiPrefixes, scaffoldFleet } from '../scaffold';
import { headStylesOf } from '../shell';

const MONOLITH = path.resolve(__dirname, '../../../../examples/meridian-monolith');

jest.setTimeout(120_000);

describe('decompose:scaffold on meridian-monolith', () => {
  let doc: Decomposition;
  let work: string;
  let proposalDir: string;

  beforeAll(async () => {
    const project = await readProject(ts, MONOLITH);
    const tests = await inventoryTests(ts, MONOLITH, project.tests, new Set(project.facts.map((f) => f.file)), false);
    doc = propose({ appName: 'meridian-ops', namespace: 'meridian-ops', graph: buildSourceGraph(project.facts), tests });
    work = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-'));
    proposalDir = path.join(work, 'evidence', 'proposal');
    await fs.ensureDir(proposalDir);
    await fs.writeJson(path.join(work, 'evidence', 'bundle.json'), { app: 'http://localhost:5090/' });
  });
  afterAll(() => fs.remove(work));

  const writeDoc = (d: Decomposition) => fs.writeFile(path.join(proposalDir, 'decomposition.yaml'), dumpYaml(d));

  it('refuses a proposal nobody approved, and one changed after approval', async () => {
    await writeDoc(doc);
    await expect(scaffoldFleet({ proposalDir, outDir: path.join(work, 'none') })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
    const approved = applyEdits(doc, [{ kind: 'approve', by: 'Sean', at: '2026-11-11T00:00:00Z' }]);
    const changed = applyEdits(approved, [{ kind: 'rename-domain', from: approved.domains[1].id, to: 'renamed' }]);
    await writeDoc({ ...changed, approval: approved.approval });
    await expect(scaffoldFleet({ proposalDir, outDir: path.join(work, 'stale') })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
    expect(await fs.pathExists(path.join(work, 'none'))).toBe(false);
  });

  it('refuses an approved proposal that breaks the playbook\'s structural rules (#420)', async () => {
    const broken = structuredClone(doc);
    broken.domains[2].files.push(broken.domains[1].files[0]);
    await writeDoc(applyEdits(broken, [{ kind: 'approve', by: 'Sean', at: '2026-11-11T00:00:00Z' }]));
    await expect(scaffoldFleet({ proposalDir, outDir: path.join(work, 'broken') })).rejects.toThrow(/file-claimed-twice|is claimed by/);
  });

  describe('an approved proposal', () => {
    let out: string;
    let result: Awaited<ReturnType<typeof scaffoldFleet>>;
    beforeAll(async () => {
      await writeDoc(applyEdits(doc, [{ kind: 'approve', by: 'Sean', at: '2026-11-11T00:00:00Z' }]));
      out = path.join(work, 'fleet');
      result = await scaffoldFleet({ proposalDir, outDir: out, appDir: MONOLITH, runtimeDir: path.join(work, 'dist', 'runtime') });
    });

    it('generates one MFE per domain plus the legacy wrapper', () => {
      expect(result.mfes.map((m) => m.name)).toEqual([...doc.domains.map((d) => d.mfe), 'legacy-meridian-ops']);
      for (const m of result.mfes) {
        expect([m.name, fs.existsSync(path.join(m.dir, 'src', 'platform', 'base-mfe', 'mfe.ts'))]).toEqual([m.name, true]);
        expect([m.name, fs.existsSync(path.join(m.dir, 'package.json'))]).toEqual([m.name, true]);
        for (const c of m.capabilities) expect(fs.existsSync(path.join(m.dir, 'src', 'features', c, `${c}.tsx`))).toBe(true);
      }
    });

    it('points every package.json at the local runtime build, whichever dependency field names it (ADR-064)', async () => {
      for (const dir of [...result.mfes.map((m) => m.dir), result.shell.dir]) {
        const pkg = (await fs.readJson(path.join(dir, 'package.json'))) as Record<string, Record<string, string> | undefined>;
        const spec = pkg.dependencies?.['@seans-mfe-tool/runtime'] ?? pkg.devDependencies?.['@seans-mfe-tool/runtime'];
        expect([path.basename(dir), spec]).toEqual([path.basename(dir), `file:${path.relative(dir, path.join(work, 'dist', 'runtime'))}`]);
      }
    });

    it('seeds the legacy capability with the component that mounts the monolith', async () => {
      const src = await fs.readFile(path.join(out, 'legacy-meridian-ops', 'src', 'features', 'LegacyMeridianOps', 'LegacyMeridianOps.tsx'), 'utf8');
      expect(src).toContain("const REMOTE_ENTRY = 'http://localhost:5090/remoteEntry.js'");
      expect(await fs.pathExists(path.join(out, 'legacy-meridian-ops', 'MONOLITH-FEDERATION.md'))).toBe(true);
    });

    it('starts the composition with the monolith in every state, compiled to rules.json', async () => {
      const cp = yaml.load(await fs.readFile(result.controlPlane, 'utf8')) as { mfes: string[]; routes: Array<{ when: string; place: unknown[] }> };
      expect(cp.mfes).toContain('legacy-meridian-ops');
      expect(cp.routes.map((r) => r.when)).toEqual(['meridian-ops.root', ...doc.routes.map((r) => r.stateKey).filter((k) => k !== 'meridian-ops.root')]);
      for (const r of cp.routes) expect(r.place).toEqual([{ capability: 'LegacyMeridianOps', into: 'root' }]);
      const rules = (await fs.readJson(result.rules)) as Array<{ registration: { name: string } }>;
      expect(rules.map((r) => r.registration.name)).toContain('legacy-meridian-ops');
      expect(await fs.pathExists(result.target)).toBe(true);
    });

    it('writes a shell that shows nothing of its own, on the monolith\'s page styles', async () => {
      const app = await fs.readFile(path.join(out, 'shell', 'src', 'App.tsx'), 'utf8');
      expect(app).toContain("const ROOT_STATE = 'meridian-ops.root'");
      // Marks itself assembling until the first experience arrives, so capture waits for it.
      expect(app).toContain("host.dataset.composition = 'pending';");
      expect(app).toContain("host.dataset.composition = 'ready';");
      expect(app).toContain('return <div ref={hostRef} data-testid="layout-host" className="layout-host" />;');
      const html = await fs.readFile(path.join(out, 'shell', 'public', 'index.html'), 'utf8');
      expect(html).toContain('background: #0b0e1a');
      const rspack = await fs.readFile(path.join(out, 'shell', 'rspack.config.js'), 'utf8');
      expect(rspack).toContain('context: ["/api"]');
      // The daemon sends no CORS headers: the shell reaches it through its own origin.
      expect(rspack).toContain("context: ['/__control-plane'], target: process.env.DAEMON_HTTP_URL || 'http://localhost:3004'");
      expect(app).toContain("await fetch('/__control-plane/graphql'");
      // Production by default, like the remotes it composes (a dev react-dom warns on their mounts).
      expect(rspack).toContain("optimization: { nodeEnv: process.env.SHELL_REACT_ENV || 'production' }");
    });

    it('fills each BFF\'s demo fixtures only from recorded responses', async () => {
      // No capture in this test: no fixtures, and scaffold says so rather than inventing data.
      for (const m of result.mfes.filter((x) => x.role === 'domain')) {
        const mocks = path.join(m.dir, 'src', 'platform', 'bff', 'mocks.json');
        if (await fs.pathExists(mocks)) expect(Object.keys(await fs.readJson(mocks))).toEqual(['_comment']);
      }
    });

    it('refuses a non-empty output without --force, and keeps developer-owned files with it', async () => {
      await expect(scaffoldFleet({ proposalDir, outDir: out })).rejects.toMatchObject({ code: 'DIR_EXISTS' });
      const feature = path.join(out, 'legacy-meridian-ops', 'src', 'features', 'LegacyMeridianOps', 'LegacyMeridianOps.tsx');
      await fs.writeFile(feature, '// mine\n');
      await scaffoldFleet({ proposalDir, outDir: out, force: true });
      expect(await fs.readFile(feature, 'utf8')).toBe('// mine\n');
    });
  });
});

describe('helpers', () => {
  it('collects the API prefixes the shell forwards', () => {
    const d = { domains: [{ endpoints: ['GET /api/harbormaster/x', 'POST /api/ledger/y'] }, { endpoints: ['GET /graphql'] }] } as unknown as Decomposition;
    expect(apiPrefixes(d)).toEqual(['/api', '/graphql']);
  });
  it('keeps the page head styles and stylesheets', () => {
    expect(headStylesOf('<html><head><title>x</title><style>body{}</style><link rel="stylesheet" href="a.css"></head></html>')).toBe(
      '<style>body{}</style>\n    <link rel="stylesheet" href="a.css">'
    );
  });
});
