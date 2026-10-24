/**
 * `probeElements()` runs in the browser; these tests give it a fake DOM whose
 * elements carry React-shaped development fibers (`__reactFiber$…` with
 * `_debugSource` / `_debugOwner`).
 */
import { probeElements, routePath } from '../page-probe';

interface Fiber {
  type?: unknown;
  alternate?: Fiber | null;
  _debugSource?: { fileName: string } | null;
  _debugOwner?: Fiber | null;
}

interface FakeNode {
  nodeType: number;
  nodeValue: string | null;
  childNodes: FakeNode[];
}

const box = { x: 0, y: 0, width: 100, height: 20 };

function el(
  tag: string,
  children: FakeNode[] = [],
  opts: { fiber?: Fiber; legacyFiber?: Fiber; attrs?: Record<string, string>; hidden?: boolean } = {}
): FakeNode & Record<string, unknown> {
  const node: FakeNode & Record<string, unknown> = {
    nodeType: 1,
    nodeValue: null,
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    childNodes: children,
    attributes: Object.entries(opts.attrs ?? {}).map(([name, value]) => ({ name, value })),
    hidden: !!opts.hidden,
    getBoundingClientRect: () => ({ ...box, top: 0, left: 0 }),
    getAttribute: () => null,
  };
  if (opts.fiber) node.__reactFiber$x1 = opts.fiber;
  // React 16 keeps the same fiber under another key.
  if (opts.legacyFiber) node.__reactInternalInstance$x1 = opts.legacyFiber;
  return node;
}

const text = (value: string): FakeNode => ({ nodeType: 3, nodeValue: value, childNodes: [] });

function probe(body: FakeNode, location = { pathname: '/docking', search: '', hash: '' }) {
  const g = globalThis as Record<string, unknown>;
  g.document = { body };
  g.window = { scrollX: 0, scrollY: 0, location };
  g.getComputedStyle = (n: { hidden: boolean }) => ({
    getPropertyValue: (p: string) => (p === 'display' && n.hidden ? 'none' : ''),
  });
  try {
    return probeElements();
  } finally {
    delete g.document;
    delete g.window;
    delete g.getComputedStyle;
  }
}

function DockingBoard(): null {
  return null;
}
function Sidebar(): null {
  return null;
}
function Link(): null {
  return null;
}

describe('probeElements', () => {
  it('names the app component and source file that drew each element', () => {
    const board: Fiber = { type: DockingBoard, _debugSource: { fileName: '/app/src/App.tsx' } };
    const table = el('table', [text(' VR-88213 ')], {
      fiber: { _debugSource: { fileName: '/app/src/components/DockingBoard.tsx' }, _debugOwner: board },
    });
    const { facts, path } = probe(el('body', [el('main', [table])]));
    expect(path).toBe('/docking');
    expect(facts.map((f) => [f.tag, f.parent, f.landmark])).toEqual([
      ['body', -1, undefined],
      ['main', 0, 'main'],
      ['table', 1, undefined],
    ]);
    expect(facts[2].owner).toEqual({ instance: 0, component: 'DockingBoard', file: '/app/src/components/DockingBoard.tsx' });
    expect(facts[2].text).toBe('VR-88213');
  });

  it('walks past library components to the app component that used them', () => {
    const sidebar: Fiber = { type: Sidebar };
    // <Link> is written in Sidebar.tsx; the <a> it renders comes from react-router.
    const link: Fiber = { type: Link, _debugSource: { fileName: '/app/src/layout/Sidebar.tsx' }, _debugOwner: sidebar };
    const anchor = el('a', [text('Docking')], { fiber: { _debugSource: null, _debugOwner: link } });
    const { facts } = probe(el('body', [anchor]));
    expect(facts[1].owner).toEqual({ instance: 0, component: 'Sidebar', file: '/app/src/layout/Sidebar.tsx' });
  });

  it('treats the current and alternate fibers of one component as one instance', () => {
    const current: Fiber = { type: DockingBoard };
    const alternate: Fiber = { type: DockingBoard, alternate: current };
    current.alternate = alternate;
    const src = { fileName: '/app/src/components/DockingBoard.tsx' };
    const { facts } = probe(
      el('body', [el('div', [], { fiber: { _debugSource: src, _debugOwner: current } }), el('div', [], { fiber: { _debugSource: src, _debugOwner: alternate } })])
    );
    expect(facts[1].owner?.instance).toBe(facts[2].owner?.instance);
  });

  it('records slots, data attributes and visibility', () => {
    const { facts } = probe(
      el('body', [
        el('div', [], { attrs: { 'data-layout-slot': 'main', 'data-smt-mfe': 'meridian-cargo-ops', class: 'x' } }),
        el('div', [], { hidden: true }),
      ])
    );
    expect(facts[1].landmark).toBe('slot:main');
    expect(facts[1].data).toEqual({ 'data-layout-slot': 'main', 'data-smt-mfe': 'meridian-cargo-ops' });
    expect(facts[2].visible).toBe(false);
  });

  it('reports no owner without development metadata', () => {
    const { facts } = probe(el('body', [el('div', [], { fiber: { _debugOwner: null } })]));
    expect(facts[1].owner).toBeNull();
  });

  it('reads React 16 fibers too, which live under __reactInternalInstance$ (#442)', () => {
    const owner: Fiber = { type: DockingBoard, _debugSource: { fileName: '/app/src/App.js' } };
    const host: Fiber = { type: 'div', _debugSource: { fileName: '/app/src/DockingBoard.js' }, _debugOwner: owner };
    const result = probe(el('body', [el('div', [text('Berths')], { legacyFiber: host })]));
    expect(result.facts.find((f) => f.tag === 'div')?.owner).toMatchObject({ component: 'DockingBoard', file: '/app/src/DockingBoard.js' });
  });

  it('reports a hash route as the path, as the app’s router sees it (#442)', () => {
    expect(probe(el('div'), { pathname: '/', search: '', hash: '#/article/notes' }).path).toBe('/article/notes');
  });
});

describe('routePath', () => {
  it('is the hash route under a hash router, and pathname + search otherwise', () => {
    expect(routePath({ pathname: '/', search: '', hash: '#/profile/ada?tab=favorites' })).toBe('/profile/ada?tab=favorites');
    expect(routePath({ pathname: '/docking', search: '?b=1', hash: '' })).toBe('/docking?b=1');
    // An in-page anchor is not a route.
    expect(routePath({ pathname: '/docs', search: '', hash: '#install' })).toBe('/docs');
  });
});
