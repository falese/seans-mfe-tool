/**
 * Regions: the units a decomposition is assembled from (ADR-109 §2).
 *
 * In a React development build, a region is one rendered instance of an
 * app-level component: the DOM elements that instance owns, found through the
 * fiber on each node (`_debugOwner`, `_debugSource`). Library components are
 * walked past to the app component that used them, so a `<Link>` belongs to
 * the `Sidebar` that rendered it. Without development metadata, regions fall
 * back to page landmarks and carry no source file — the bundle records that
 * instead of guessing (ADR-109, Boundaries).
 *
 * The browser half (`page-probe.ts`) only reports per-element facts; grouping
 * them into regions happens here, in plain functions that are testable
 * without a browser.
 */

import type { Rect } from '../design/design-tree';

/** Which app component instance drew an element. */
export interface ElementOwner {
  /** Instance number, unique within one probe, in document order. */
  instance: number;
  component: string;
  /** Repository-relative source file, or null when the build has no source metadata. */
  file: string | null;
}

/** One element as the page probe saw it. */
export interface ElementFact {
  /** Index in document order. */
  i: number;
  /** Index of the parent element; -1 for the root. */
  parent: number;
  tag: string;
  rect: Rect;
  visible: boolean;
  owner: ElementOwner | null;
  /** The element's own text nodes, whitespace-collapsed — not its descendants'. */
  text: string;
  /** Set on `main`, `nav`, `aside`, `header`, `footer`, and on `[data-layout-slot]` (its value). */
  landmark?: string;
  /** `data-*` attributes, `data-smt-*` boundary stamps included. */
  data?: Record<string, string>;
}

export interface Region {
  /** Stable id: `<file>#<Component>`, with `@n` when one step shows several instances. */
  id: string;
  component: string;
  file: string | null;
  /** Nearest landmark around the region's first root, or null. */
  landmark: string | null;
  /** The region containing this one, or null. */
  parent: string | null;
  /** Union of the region's visible root rects, in page coordinates. */
  rect: Rect;
  /** Text drawn by this region itself, excluding nested regions. */
  ownText: string;
  /** `data-*` attributes of the region's roots. */
  data: Record<string, string>;
}

export interface SourceCoverage {
  visibleElements: number;
  /** Visible elements whose owning component has a source file. */
  mappedToSource: number;
}

/**
 * Make a source path repository-relative. Handles absolute paths from
 * `_debugSource` and webpack module URLs from stack frames; library code
 * (`node_modules`) and empty input give null.
 */
export function normalizeSourcePath(raw: string, sourceRoot?: string): string | null {
  if (!raw) return null;
  let p = raw
    .replace(/[?#].*$/, '')
    .replace(/^webpack-internal:\/\/\//, '')
    .replace(/^webpack:\/\/[^/]*\//, '')
    .replace(/^\.\//, '');
  if (/(^|\/)node_modules\//.test(p)) return null;
  if (sourceRoot) {
    const root = sourceRoot.replace(/\/+$/, '') + '/';
    if (p.startsWith(root)) return p.slice(root.length);
  }
  if (!p.startsWith('/')) return p;
  const cut = p.lastIndexOf('/src/');
  if (cut >= 0) p = p.slice(cut + 1);
  return p;
}

function union(a: Rect | undefined, b: Rect): Rect {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

interface Draft {
  key: string;
  component: string;
  file: string | null;
  landmark: string | null;
  parentKey: string | null;
  rect?: Rect;
  texts: string[];
  data: Record<string, string>;
}

/**
 * Group element facts into regions. Elements arrive in document order with
 * parents before children, so one pass finds each element's region and the
 * landmark around it.
 */
export function assembleRegions(facts: ElementFact[]): { regions: Region[]; coverage: SourceCoverage } {
  const anyOwner = facts.some((f) => f.owner !== null);
  const regionKey = new Array<string | null>(facts.length).fill(null);
  const landmarkOf = new Array<string | null>(facts.length).fill(null);
  const drafts = new Map<string, Draft>();
  const order: string[] = [];
  const coverage: SourceCoverage = { visibleElements: 0, mappedToSource: 0 };

  for (const f of facts) {
    const parent = f.parent >= 0 ? f.parent : -1;
    landmarkOf[f.i] = f.landmark ?? (parent >= 0 ? landmarkOf[parent] : null);
    const inherited = parent >= 0 ? regionKey[parent] : null;
    if (!f.visible) {
      regionKey[f.i] = inherited;
      continue;
    }
    coverage.visibleElements += 1;
    if (f.owner?.file) coverage.mappedToSource += 1;

    let key: string | null;
    let component: string;
    let file: string | null;
    if (anyOwner) {
      if (!f.owner) {
        regionKey[f.i] = inherited;
        if (inherited && f.text) drafts.get(inherited)?.texts.push(f.text);
        continue;
      }
      key = `i${f.owner.instance}`;
      component = f.owner.component;
      file = f.owner.file;
    } else {
      // No development metadata: page landmarks are the only boundaries we can see.
      if (f.landmark) {
        key = `landmark:${f.landmark}`;
        component = f.landmark;
        file = null;
      } else {
        regionKey[f.i] = inherited;
        if (inherited && f.text) drafts.get(inherited)?.texts.push(f.text);
        continue;
      }
    }

    regionKey[f.i] = key;
    let draft = drafts.get(key);
    if (!draft) {
      draft = {
        key,
        component,
        file,
        landmark: landmarkOf[f.i],
        parentKey: inherited && inherited !== key ? inherited : null,
        texts: [],
        data: {},
      };
      drafts.set(key, draft);
      order.push(key);
    }
    if (inherited !== key) {
      // A root of this region: where ownership changes.
      draft.rect = union(draft.rect, f.rect);
      Object.assign(draft.data, f.data ?? {});
    }
    if (f.text) draft.texts.push(f.text);
  }

  // Stable ids: file#Component, numbered when a component appears more than once.
  const base = (d: Draft) => (d.key.startsWith('landmark:') ? d.key : `${d.file ?? '?'}#${d.component}`);
  const counts = new Map<string, number>();
  for (const key of order) {
    const b = base(drafts.get(key) as Draft);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const idOf = new Map<string, string>();
  for (const key of order) {
    const b = base(drafts.get(key) as Draft);
    const n = seen.get(b) ?? 0;
    seen.set(b, n + 1);
    idOf.set(key, (counts.get(b) ?? 0) > 1 ? `${b}@${n}` : b);
  }

  const regions = order.map((key): Region => {
    const d = drafts.get(key) as Draft;
    return {
      id: idOf.get(key) as string,
      component: d.component,
      file: d.file,
      landmark: d.landmark,
      parent: d.parentKey ? (idOf.get(d.parentKey) ?? null) : null,
      rect: d.rect ?? { x: 0, y: 0, width: 0, height: 0 },
      ownText: d.texts.join(' ').replace(/\s+/g, ' ').trim(),
      data: d.data,
    };
  });
  return { regions, coverage };
}
