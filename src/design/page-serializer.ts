/**
 * The in-page half of `design:export`.
 *
 * `serializePage()` runs inside the browser — Playwright ships the function's
 * compiled JS via `fn.toString()`, so it must stay FULLY self-contained: every
 * constant and helper lives inside the function body, no imports are touched
 * at evaluation time, and the only globals are the DOM ones declared in
 * `dom-shims.d.ts`. (The `RawRecord` import below is type-only and erased at
 * compile time.)
 *
 * It emits a FLAT list of {@link RawRecord}s — elements and text runs in
 * document order, linked by `parentIndex`. The shape keeps the browser half
 * dumb: all the judgment (culling, kind assignment, auto-layout inference,
 * font collection) lives in `design-tree.ts`, which is unit-testable without
 * a browser.
 */

import type { RawRecord } from './design-tree';

export interface SerializedPage {
  records: RawRecord[];
  title: string;
}

/**
 * Serialize the current document into flat raw records.
 *
 * Text is captured per DOM text node (not per element), using a Range rect so
 * each run keeps its own box. Its styles are inherited from the parent
 * element's computed style — text nodes have none of their own.
 */
export function serializePage(): SerializedPage {
  /** Elements that never carry design meaning. */
  const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'LINK',
    'META',
    'TITLE',
    'HEAD',
    'TEMPLATE',
    'BR',
  ]);

  /** Replaced/atomic content: no descendants carry design meaning. */
  const ATOMIC_TAGS = new Set(['svg', 'canvas', 'iframe', 'video', 'object', 'embed']);

  /** Computed-style properties copied onto every element record. */
  const STYLE_PROPS = [
    'display',
    'position',
    'visibility',
    'opacity',
    'color',
    'background-color',
    'background-image',
    'overflow-x',
    'overflow-y',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'text-align',
    'letter-spacing',
    'text-decoration-line',
    'text-transform',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'flex-direction',
    'flex-wrap',
    'justify-content',
    'align-items',
    'row-gap',
    'column-gap',
    'box-shadow',
    'z-index',
  ];

  const TEXT_STYLE_PROPS = [
    'color',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'text-align',
    'letter-spacing',
    'text-decoration-line',
    'text-transform',
    'opacity',
    'visibility',
  ];

  const records: RawRecord[] = [];
  const range = document.createRange();

  function readStyles(el: DomElementLike): Record<string, string> {
    const cs = getComputedStyle(el);
    const styles: Record<string, string> = {};
    for (const prop of STYLE_PROPS) {
      styles[prop] = cs.getPropertyValue(prop);
    }
    return styles;
  }

  function classNameOf(el: DomElementLike): string | undefined {
    const cn = el.className;
    const s = typeof cn === 'string' ? cn : cn.baseVal;
    return s.trim() ? s.trim() : undefined;
  }

  function applyTextTransform(text: string, transform: string): string {
    if (transform === 'uppercase') return text.toUpperCase();
    if (transform === 'lowercase') return text.toLowerCase();
    if (transform === 'capitalize') return text.replace(/\b\w/g, (c) => c.toUpperCase());
    return text;
  }

  function textStylesFrom(parent: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const prop of TEXT_STYLE_PROPS) {
      out[prop] = parent[prop];
    }
    return out;
  }

  function pushText(
    node: DomNodeLike,
    parentIndex: number,
    parentStyles: Record<string, string>
  ): void {
    const raw = (node.nodeValue ?? '').replace(/\s+/g, ' ');
    if (!raw.trim()) return;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    records.push({
      kind: 'text',
      parentIndex,
      text: applyTextTransform(raw.trim(), parentStyles['text-transform'] ?? 'none'),
      rect: {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height,
      },
      styles: textStylesFrom(parentStyles),
    });
  }

  function pushElement(el: DomElementLike, parentIndex: number): void {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(el.tagName)) return;

    const styles = readStyles(el);
    // Cull early: invisible subtrees cannot produce design nodes, and skipping
    // them here avoids a computed-style read per descendant.
    if (
      styles.display === 'none' ||
      styles.visibility === 'hidden' ||
      styles.visibility === 'collapse'
    ) {
      return;
    }

    const r = el.getBoundingClientRect();
    const record: RawRecord = {
      kind: 'element',
      parentIndex,
      tag,
      id: el.id || undefined,
      className: classNameOf(el),
      rect: {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height,
      },
      styles,
    };
    if (tag === 'img') {
      record.src = el.currentSrc ?? el.src ?? el.getAttribute('src') ?? undefined;
    }
    const index = records.push(record) - 1;

    if (ATOMIC_TAGS.has(tag)) return;

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1) {
        pushElement(child as DomElementLike, index);
      } else if (child.nodeType === 3) {
        pushText(child, index, styles);
      }
    }
  }

  pushElement(document.body, -1);
  return { records, title: document.title };
}
