import { assembleRegions, normalizeSourcePath, type ElementFact } from '../regions';

const rect = (x = 0, y = 0, width = 100, height = 20) => ({ x, y, width, height });

function fact(i: number, parent: number, overrides: Partial<ElementFact> = {}): ElementFact {
  return {
    i,
    parent,
    tag: 'div',
    rect: rect(),
    visible: true,
    owner: null,
    text: '',
    ...overrides,
  };
}

const owner = (instance: number, component: string, file: string | null) => ({ instance, component, file });

describe('assembleRegions', () => {
  it('makes one region per component instance, rooted where ownership changes', () => {
    const facts = [
      fact(0, -1, { tag: 'body' }),
      fact(1, 0, { tag: 'main', landmark: 'main' }),
      fact(2, 1, { owner: owner(1, 'DockingBoard', 'src/components/DockingBoard.tsx'), text: 'Docking board' }),
      fact(3, 2, { tag: 'td', owner: owner(1, 'DockingBoard', 'src/components/DockingBoard.tsx'), text: 'VR-88213' }),
      fact(4, 2, { owner: owner(2, 'StatusChip', 'src/components/StatusChip.tsx'), text: 'DOCKED' }),
    ];
    const { regions } = assembleRegions(facts);
    expect(regions.map((r) => r.id)).toEqual([
      'src/components/DockingBoard.tsx#DockingBoard',
      'src/components/StatusChip.tsx#StatusChip',
    ]);
    const board = regions[0];
    expect(board).toMatchObject({ component: 'DockingBoard', landmark: 'main', parent: null });
    expect(board.ownText).toBe('Docking board VR-88213');
    expect(regions[1].parent).toBe('src/components/DockingBoard.tsx#DockingBoard');
    // The chip's text belongs to the chip, not to the board that contains it.
    expect(board.ownText).not.toContain('DOCKED');
  });

  it('numbers repeated instances of one component in document order', () => {
    const tile = (i: number, inst: number) =>
      fact(i, 0, { owner: owner(inst, 'BerthTile', 'src/components/BerthTile.tsx'), text: `b${inst}` });
    const { regions } = assembleRegions([fact(0, -1, { tag: 'body' }), tile(1, 10), tile(2, 11), tile(3, 12)]);
    expect(regions.map((r) => r.id)).toEqual([
      'src/components/BerthTile.tsx#BerthTile@0',
      'src/components/BerthTile.tsx#BerthTile@1',
      'src/components/BerthTile.tsx#BerthTile@2',
    ]);
  });

  it('unions the rects of a component that renders several roots (a fragment)', () => {
    const o = owner(1, 'Pair', 'src/Pair.tsx');
    const { regions } = assembleRegions([
      fact(0, -1, { tag: 'body' }),
      fact(1, 0, { owner: o, rect: rect(0, 0, 50, 10) }),
      fact(2, 0, { owner: o, rect: rect(0, 30, 80, 10) }),
    ]);
    expect(regions).toHaveLength(1);
    expect(regions[0].rect).toEqual({ x: 0, y: 0, width: 80, height: 40 });
  });

  it('keeps data-* attributes of region roots, including data-smt-* stamps', () => {
    const { regions } = assembleRegions([
      fact(0, -1, { tag: 'body' }),
      fact(1, 0, {
        owner: owner(1, 'Panel', 'src/Panel.tsx'),
        data: { 'data-smt-capability': 'CargoManifest', 'data-testid': 'panel' },
      }),
    ]);
    expect(regions[0].data).toEqual({ 'data-smt-capability': 'CargoManifest', 'data-testid': 'panel' });
  });

  it('ignores invisible elements and reports how much of the page maps to source', () => {
    const { regions, coverage } = assembleRegions([
      fact(0, -1, { tag: 'body', visible: true }),
      fact(1, 0, { owner: owner(1, 'A', 'src/A.tsx') }),
      fact(2, 0, { owner: owner(2, 'B', 'src/B.tsx'), visible: false }),
      fact(3, 0, { owner: null }),
      fact(4, 0, { owner: owner(3, 'C', null) }),
    ]);
    expect(regions.map((r) => r.component)).toEqual(['A', 'C']);
    // body, A, the unowned div and C are visible; only A has a source file.
    expect(coverage).toEqual({ visibleElements: 4, mappedToSource: 1 });
  });

  it('falls back to landmark regions when no element has an owner (no React dev build)', () => {
    const { regions } = assembleRegions([
      fact(0, -1, { tag: 'body' }),
      fact(1, 0, { tag: 'nav', landmark: 'nav', text: 'Docking' }),
      fact(2, 0, { tag: 'main', landmark: 'main' }),
      fact(3, 2, { tag: 'p', text: 'Hello' }),
    ]);
    expect(regions.map((r) => [r.id, r.file, r.ownText])).toEqual([
      ['landmark:nav', null, 'Docking'],
      ['landmark:main', null, 'Hello'],
    ]);
  });
});

describe('normalizeSourcePath', () => {
  it('makes paths relative to the source root when one is given', () => {
    expect(normalizeSourcePath('/work/app/src/components/X.tsx', '/work/app')).toBe('src/components/X.tsx');
  });

  it('cuts at the last /src/ segment by default', () => {
    expect(normalizeSourcePath('/home/u/repo/examples/app/src/pages/Y.tsx')).toBe('src/pages/Y.tsx');
  });

  it('reads webpack module URLs from stack frames', () => {
    expect(normalizeSourcePath('webpack-internal:///./src/api/client.ts')).toBe('src/api/client.ts');
    expect(normalizeSourcePath('webpack://meridian-ops/./src/store/AppContext.tsx?abc')).toBe('src/store/AppContext.tsx');
  });

  it('returns null for library code', () => {
    expect(normalizeSourcePath('/app/node_modules/react-router/dist/index.js')).toBeNull();
    expect(normalizeSourcePath('webpack-internal:///./node_modules/axios/lib/adapters/xhr.js')).toBeNull();
    expect(normalizeSourcePath('')).toBeNull();
  });
});
