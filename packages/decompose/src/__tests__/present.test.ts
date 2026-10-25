import { buildOverlay, renderOverlayHtml, renderOverlayPlugin, renderProposalMarkdown, type EvidenceStep } from '../present';
import type { Decomposition, Domain } from '../model';

const evidence = { route: 1, data: 0.67, imports: 1, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], caps: Array<[string, string]>, extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `meridian-${id}`, shell: false, files,
  capabilities: caps.map(([name, file]) => ({ name, file, component: name })),
  backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

function doc(): Decomposition {
  return {
    version: 1,
    app: { name: 'meridian', namespace: 'meridian' },
    domains: [
      domain('console', ['src/App.tsx', 'src/layout/Sidebar.tsx'], [['Console', 'src/App.tsx']], { shell: true, reasons: ['files reached only from the entry'] }),
      domain('docking', ['src/DockingBoard.tsx', 'src/BerthTile.tsx'], [['DockingBoard', 'src/DockingBoard.tsx'], ['BerthTile', 'src/BerthTile.tsx']], {
        backends: ['harbormaster', 'ledger'],
        reasons: ['route /docking places DockingBoard in the primary area'],
      }),
    ],
    shared: [{ file: 'src/api/client.ts', usedBy: ['docking'], suggestion: 'replace with one BFF per domain' }],
    unassigned: [],
    couplings: [{ file: 'src/layout/Sidebar.tsx', domain: 'console', field: 'telemetry', endpoint: 'GET /api/stationos/telemetry', owner: 'life-support', kind: 'shell-read', note: 'the shell shows life-support data' }],
    slots: [{ id: 'main', provider: 'console', repeated: false }, { id: 'berth.{id}', provider: 'console', repeated: true }],
    routes: [{ path: '/docking', stateKey: 'meridian.open.docking', place: [{ capability: 'DockingBoard', domain: 'docking', slot: 'main' }] }],
    repeated: [{ capability: 'BerthTile', domain: 'docking', slot: 'berth.{id}', renderedBy: 'src/layout/BerthStrip.tsx' }],
    tests: [
      { file: 'src/__tests__/DockingBoard.test.tsx', domain: 'docking', verdict: 'keep', reasons: ['behavioral, and runs'] },
      { file: 'src/__tests__/BerthTile.test.tsx', domain: 'docking', verdict: 'rewrite', reasons: ['snapshot-only: pins markup, not behavior'] },
    ],
    uncovered: [{ capability: 'BerthTile', domain: 'docking', file: 'src/BerthTile.tsx', reason: 'no kept test exercises it' }],
  };
}

const region = (id: string, file: string | null, rect: [number, number, number, number], parent: string | null = null) => ({
  id, component: id.split('#')[1] ?? id, file, landmark: null, parent,
  rect: { x: rect[0], y: rect[1], width: rect[2], height: rect[3] }, ownText: '', data: {},
});

const steps: EvidenceStep[] = [
  {
    id: 'explore.1',
    path: '/docking',
    screenshot: 'screens/explore.1.png',
    regions: [
      region('src/App.tsx#App', 'src/App.tsx', [0, 0, 1440, 900]),
      region('src/BerthTile.tsx#BerthTile@0', 'src/BerthTile.tsx', [20, 10, 200, 60], 'src/App.tsx#App'),
      // The shell's sidebar reads another domain's data: drawn as a coupling, though it is inside the shell.
      region('src/layout/Sidebar.tsx#Sidebar', 'src/layout/Sidebar.tsx', [0, 100, 280, 600], 'src/App.tsx#App'),
      region('src/DockingBoard.tsx#DockingBoard', 'src/DockingBoard.tsx', [300, 100, 800, 700], 'src/App.tsx#App'),
      // Nested in the same domain: no box of its own.
      region('src/DockingBoard.tsx#Row', 'src/DockingBoard.tsx', [310, 120, 780, 30], 'src/DockingBoard.tsx#DockingBoard'),
      // Shared and nested: not drawn.
      region('src/StatusChip.tsx#StatusChip', 'src/StatusChip.tsx', [320, 130, 40, 20], 'src/DockingBoard.tsx#DockingBoard'),
      // Below the screenshot: dropped.
      region('src/DockingBoard.tsx#Footer', 'src/DockingBoard.tsx', [0, 2000, 100, 20], 'src/App.tsx#App'),
    ],
  },
  // A second step on the same path is the same screen.
  { id: 'explore.9', path: '/docking', screenshot: 'screens/explore.9.png', regions: [] },
];

describe('renderProposalMarkdown', () => {
  const md = renderProposalMarkdown(doc());
  it('summarises every domain with its MFE, capabilities, backends and evidence', () => {
    expect(md).toContain('# Decomposition proposal — meridian');
    expect(md).toContain('| docking | `meridian-docking` | 2 | DockingBoard, BerthTile | harbormaster, ledger |');
    expect(md).toContain('route /docking places DockingBoard in the primary area');
    expect(md).toContain('data 0.67');
  });
  it('lists shared files, risks and the test triage', () => {
    expect(md).toContain('`src/api/client.ts` | docking | replace with one BFF per domain');
    expect(md).toContain('`src/layout/Sidebar.tsx` (console) reads life-support’s `telemetry`');
    expect(md).toContain('**1 keep, 1 rewrite, 0 discard**');
    expect(md).toContain('`src/__tests__/BerthTile.test.tsx` | docking | rewrite | snapshot-only: pins markup, not behavior');
    expect(md).toContain('BerthTile (docking)');
  });
  it('says how to change it', () => {
    expect(md).toContain('decompose:edit');
  });
});

describe('buildOverlay', () => {
  const overlay = buildOverlay(doc(), steps, { width: 1440, height: 900 });
  it('draws one screen per path, with a box where a domain begins', () => {
    expect(overlay.screens).toHaveLength(1);
    const screen = overlay.screens[0];
    expect(screen).toMatchObject({ path: '/docking', screenshot: 'screens/explore.1.png', width: 1440, height: 900 });
    expect(screen.boxes.map((b) => [b.domain, b.capability, b.slot])).toEqual([
      ['console', 'Console', 'root'],
      ['docking', 'BerthTile', 'berth.{id}'],
      ['docking', 'DockingBoard', 'main'],
    ]);
    expect(screen.boxes[2].label).toBe('docking · meridian-docking · main · harbormaster, ledger');
  });
  it('marks couplings where they show, even inside another domain’s box', () => {
    const screen = overlay.screens[0];
    expect(screen.couplings).toEqual([
      { file: 'src/layout/Sidebar.tsx', label: 'coupling: console reads life-support’s telemetry', rect: { x: 0, y: 100, width: 280, height: 600 } },
    ]);
  });
  it('gives each domain one colour across screens, and lists them in a legend', () => {
    expect(overlay.legend.map((l) => l.domain)).toEqual(['console', 'docking']);
    const docking = overlay.legend.find((l) => l.domain === 'docking')?.color;
    expect(overlay.screens[0].boxes.filter((b) => b.domain === 'docking').every((b) => b.color === docking)).toBe(true);
  });
});

describe('renderOverlayHtml', () => {
  it('lays each screenshot out with its domain boxes on top', () => {
    const html = renderOverlayHtml(buildOverlay(doc(), steps, { width: 1440, height: 900 }), 'meridian');
    expect(html).toContain('<img src="screens/explore.1.png"');
    expect(html).toContain('left:300px;top:100px;width:800px;height:700px');
    expect(html).toContain('docking · meridian-docking · main · harbormaster, ledger');
    // Full text on hover, since narrow boxes truncate their label.
    expect(html).toContain('title="docking · meridian-docking · main · harbormaster, ledger"');
    expect(html).toContain('class="box coupling"');
  });
});

describe('renderOverlayPlugin', () => {
  it('builds a Figma page: a frame per screen with the screenshot and a labelled box per domain region', async () => {
    const overlay = buildOverlay(doc(), steps, { width: 1440, height: 900 });
    const bundle = renderOverlayPlugin(overlay, { 'screens/explore.1.png': Buffer.from('png-bytes') }, 'meridian');
    const manifest = JSON.parse(bundle['manifest.json']) as Record<string, unknown>;
    expect(manifest.documentAccess).toBe('dynamic-page');

    const made: Array<Record<string, unknown>> = [];
    let closed = '';
    let images = 0;
    const node = (type: string) => () => {
      const n: Record<string, unknown> = { type, children: [], appendChild(c: unknown) { (this.children as unknown[]).push(c); }, resize(w: number, h: number) { this.width = w; this.height = h; } };
      made.push(n);
      return n;
    };
    const figma = {
      currentPage: { appendChild: () => undefined },
      createPage: () => ({ name: '', appendChild: () => undefined }),
      setCurrentPageAsync: async () => undefined,
      viewport: { scrollAndZoomIntoView: () => undefined },
      createFrame: node('FRAME'),
      createRectangle: node('RECTANGLE'),
      createText: node('TEXT'),
      createImage: (bytes: Uint8Array) => {
        images += 1;
        expect(Buffer.from(bytes).toString()).toBe('png-bytes');
        return { hash: 'h' };
      },
      base64Decode: (s: string) => new Uint8Array(Buffer.from(s, 'base64')),
      loadFontAsync: async () => undefined,
      closePlugin: (m: string) => {
        closed = m;
      },
    };
    await new Function('figma', `${bundle['code.js']}\nreturn done;`)(figma);
    expect(closed).toContain('1 screen');
    expect(images).toBe(1);
    expect(made.filter((n) => n.type === 'FRAME')).toHaveLength(1);
    // Screenshot rectangle + three domain boxes + one coupling.
    expect(made.filter((n) => n.type === 'RECTANGLE')).toHaveLength(5);
    expect(made.filter((n) => n.type === 'TEXT').map((n) => n.characters)).toContain('coupling: console reads life-support’s telemetry');
    expect(made.filter((n) => n.type === 'TEXT').map((n) => n.characters)).toContain('docking · meridian-docking · main · harbormaster, ledger');
  });
});
