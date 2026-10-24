/**
 * `serializePage()` runs in the browser, so these tests give it a minimal fake
 * DOM on the globals it reads (`document`, `window`, `getComputedStyle`). The
 * fake models only what the serializer touches: element/text nodes, computed
 * styles, rects, open shadow roots and slot assignment.
 */
import { serializePage } from '../page-serializer';
import type { RawRecord } from '../design-tree';

interface FakeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FakeNode {
  nodeType: number;
  nodeValue: string | null;
  childNodes: FakeNode[];
  rect: FakeRect;
}

interface FakeElement extends FakeNode {
  tagName: string;
  id: string;
  className: string;
  styles: Record<string, string>;
  shadowRoot?: { childNodes: FakeNode[] } | null;
  attributes?: Array<{ name: string; value: string }>;
  assigned?: FakeNode[];
  getBoundingClientRect(): FakeRect & { top: number; left: number };
  getAttribute(name: string): string | null;
  assignedNodes?(opts?: { flatten?: boolean }): FakeNode[];
}

const box = (width = 100, height = 20): FakeRect => ({ x: 0, y: 0, width, height });

function element(
  tag: string,
  children: FakeNode[] = [],
  opts: { styles?: Record<string, string>; rect?: FakeRect; id?: string } = {}
): FakeElement {
  const rect = opts.rect ?? box();
  const node: FakeElement = {
    nodeType: 1,
    nodeValue: null,
    tagName: tag.toUpperCase(),
    id: opts.id ?? '',
    className: '',
    childNodes: children,
    rect,
    styles: { display: 'block', visibility: 'visible', opacity: '1', ...opts.styles },
    getBoundingClientRect: () => ({ ...rect, top: rect.y, left: rect.x }),
    getAttribute: () => null,
  };
  if (tag === 'slot') {
    node.assignedNodes = () => node.assigned ?? [];
  }
  return node;
}

function text(value: string, rect: FakeRect = box(40, 16)): FakeNode {
  return { nodeType: 3, nodeValue: value, childNodes: [], rect };
}

function serialize(body: FakeElement): RawRecord[] {
  const g = globalThis as Record<string, unknown>;
  let selected: FakeNode | undefined;
  g.document = {
    body,
    documentElement: body,
    title: 'fake',
    createRange: () => ({
      selectNodeContents: (n: FakeNode) => {
        selected = n;
      },
      getBoundingClientRect: () => {
        const r = selected?.rect ?? box(0, 0);
        return { ...r, top: r.y, left: r.x };
      },
    }),
  };
  g.window = { innerWidth: 800, innerHeight: 600, scrollX: 0, scrollY: 0 };
  g.getComputedStyle = (el: FakeElement) => ({
    getPropertyValue: (name: string) => el.styles[name] ?? '',
  });
  try {
    return serializePage().records;
  } finally {
    delete g.document;
    delete g.window;
    delete g.getComputedStyle;
  }
}

const tags = (records: RawRecord[]) => records.map((r) => (r.kind === 'text' ? `"${r.text}"` : r.tag));

describe('serializePage', () => {
  it('captures the inside of an open shadow root', () => {
    const host = element('fancy-card', [], { id: 'card' });
    host.shadowRoot = { childNodes: [element('p', [text('from the shadow')])] };
    const records = serialize(element('body', [host]));
    expect(tags(records)).toEqual(['body', 'fancy-card', 'p', '"from the shadow"']);
    expect(records[2].parentIndex).toBe(1);
  });

  it('renders light-DOM children where their slot is, once', () => {
    const slot = element('slot', [text('fallback')], { styles: { display: 'contents' }, rect: box(0, 0) });
    const host = element('fancy-card', [element('span', [text('light')])]);
    host.shadowRoot = { childNodes: [element('header', [slot])] };
    slot.assigned = host.childNodes;
    const records = serialize(element('body', [host]));
    expect(tags(records)).toEqual(['body', 'fancy-card', 'header', 'slot', 'span', '"light"']);
    // The span hangs off the slot it was assigned to, not the host.
    expect(records[4].parentIndex).toBe(3);
  });

  it('renders a slot’s fallback content when nothing is assigned', () => {
    const slot = element('slot', [text('fallback')], { styles: { display: 'contents' }, rect: box(0, 0) });
    const host = element('fancy-card');
    host.shadowRoot = { childNodes: [slot] };
    expect(tags(serialize(element('body', [host])))).toEqual(['body', 'fancy-card', 'slot', '"fallback"']);
  });

  it('does not copy the parent’s opacity onto a text run (#409)', () => {
    const faded = element('div', [text('direct text')], { styles: { opacity: '0.5' } });
    const records = serialize(element('body', [faded]));
    const run = records.find((r) => r.kind === 'text');
    expect(run?.styles).not.toHaveProperty('opacity');
    expect(records[1].styles?.opacity).toBe('0.5');
  });
});

describe('serializePage — data attributes (#413)', () => {
  it('keeps data-* attributes, boundary stamps included, and nothing else', () => {
    const slot = element('div', [text('cargo')]);
    slot.attributes = [
      { name: 'data-layout-slot', value: 'main' },
      { name: 'data-smt-capability', value: 'CargoManifest' },
      { name: 'class', value: 'panel' },
    ];
    const records = serialize(element('body', [slot]));
    expect(records[1].data).toEqual({ 'data-layout-slot': 'main', 'data-smt-capability': 'CargoManifest' });
    expect(records[0].data).toBeUndefined();
  });
});
