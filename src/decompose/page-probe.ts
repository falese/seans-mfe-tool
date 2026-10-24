/**
 * The in-page half of region capture (ADR-109 §2-3).
 *
 * `probeElements()` runs inside the browser, shipped via `fn.toString()` like
 * `serializePage()`, so it stays self-contained: no imports at evaluation time,
 * only the DOM globals in `src/design/dom-shims.d.ts`. It reports one fact per
 * element and makes no grouping decisions; `assembleRegions()` does that in
 * Node.
 *
 * The owner of an element comes from React's development fiber: the host
 * fiber's `_debugSource` is the file the JSX was written in and `_debugOwner`
 * the component that rendered it. Library code is walked past to the app
 * component that used it. Without that metadata (a production build, or not
 * React) the owner is null.
 */

import type { ElementFact } from './regions';

export interface ProbeResult {
  facts: ElementFact[];
  path: string;
}

export function probeElements(): ProbeResult {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'HEAD', 'TITLE']);
  const LANDMARK_TAGS = new Set(['main', 'nav', 'aside', 'header', 'footer']);

  interface Fiber {
    alternate?: Fiber | null;
    type?: unknown;
    _debugSource?: { fileName: string; lineNumber?: number } | null;
    _debugOwner?: Fiber | null;
  }

  const facts: ElementFact[] = [];
  const instances = new Map<Fiber, number>();

  function fiberOf(el: DomElementLike): Fiber | undefined {
    const bag = el as unknown as Record<string, unknown>;
    for (const key of Object.keys(bag)) {
      if (key.startsWith('__reactFiber$')) return bag[key] as Fiber;
    }
    return undefined;
  }

  function nameOf(type: unknown): string {
    if (typeof type === 'function') {
      const fn = type as { displayName?: string; name?: string };
      return fn.displayName || fn.name || 'Anonymous';
    }
    if (type && typeof type === 'object') {
      const t = type as { displayName?: string; render?: { name?: string }; type?: unknown };
      if (t.displayName) return t.displayName;
      if (t.render && t.render.name) return t.render.name;
      if (t.type) return nameOf(t.type);
    }
    return 'Anonymous';
  }

  function instanceOf(owner: Fiber): number {
    // React keeps two fibers per instance (current and alternate); both are one instance.
    const known = instances.get(owner) ?? (owner.alternate ? instances.get(owner.alternate) : undefined);
    if (known !== undefined) return known;
    const n = instances.size;
    instances.set(owner, n);
    if (owner.alternate) instances.set(owner.alternate, n);
    return n;
  }

  function ownerOf(el: DomElementLike): ElementFact['owner'] {
    const fiber = fiberOf(el);
    if (!fiber) return null;
    let source = fiber._debugSource ?? null;
    let owner = fiber._debugOwner ?? null;
    while (owner && (!source || source.fileName.indexOf('/node_modules/') >= 0)) {
      source = owner._debugSource ?? null;
      owner = owner._debugOwner ?? null;
    }
    if (!owner) return null;
    return { instance: instanceOf(owner), component: nameOf(owner.type), file: source ? source.fileName : null };
  }

  function childrenOf(el: DomElementLike): DomNodeLike[] {
    if (el.shadowRoot) return Array.from(el.shadowRoot.childNodes);
    return Array.from(el.childNodes);
  }

  function visit(el: DomElementLike, parent: number): void {
    if (SKIP.has(el.tagName)) return;
    const tag = el.tagName.toLowerCase();
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const visible =
      r.width > 0 &&
      r.height > 0 &&
      cs.getPropertyValue('visibility') !== 'hidden' &&
      cs.getPropertyValue('display') !== 'none';

    let text = '';
    const kids = childrenOf(el);
    for (const child of kids) {
      if (child.nodeType === 3 && child.nodeValue) text += ' ' + child.nodeValue;
    }

    const data: Record<string, string> = {};
    let slot: string | undefined;
    const attrs = el.attributes ? Array.from(el.attributes) : [];
    for (const a of attrs) {
      if (a.name.indexOf('data-') === 0) data[a.name] = a.value;
      if (a.name === 'data-layout-slot') slot = a.value;
    }

    const fact: ElementFact = {
      i: facts.length,
      parent,
      tag,
      rect: { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height },
      visible,
      owner: ownerOf(el),
      text: text.replace(/\s+/g, ' ').trim(),
    };
    if (slot) fact.landmark = 'slot:' + slot;
    else if (LANDMARK_TAGS.has(tag)) fact.landmark = tag;
    if (Object.keys(data).length > 0) fact.data = data;
    facts.push(fact);

    const index = fact.i;
    for (const child of kids) {
      if (child.nodeType === 1) visit(child as DomElementLike, index);
    }
  }

  visit(document.body, -1);
  return { facts, path: window.location.pathname + window.location.search };
}
