/**
 * The normalized design tree: the single artifact everything downstream of
 * `design:export` consumes. Written to `design.json` for inspection and fed to
 * the Figma plugin emitter (`figma-plugin.ts`).
 *
 * Everything in this module is a pure function over {@link RawRecord}s — the
 * flat, dumb list the in-page serializer produces — so the interesting logic
 * (culling, kind assignment, auto-layout inference, font collection) is
 * unit-testable without a browser.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One flat record emitted by the in-page serializer. */
export interface RawRecord {
  kind: 'element' | 'text';
  /** Index into the record list of the parent element; -1 for the root. */
  parentIndex: number;
  tag?: string;
  id?: string;
  className?: string;
  text?: string;
  /** Absolute page coordinates (scroll offset already applied). */
  rect: Rect;
  styles?: Record<string, string>;
  /** img only: resolved image URL. */
  src?: string;
  /** `data-*` attributes, `data-smt-*` boundary stamps and `data-layout-slot` included. */
  data?: Record<string, string>;
}

/** RGBA with channels normalized to 0–1 — Figma's paint shape. */
export interface Paint {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AutoLayoutSpec {
  direction: 'HORIZONTAL' | 'VERTICAL';
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  /** `flex-wrap: wrap` on a row — Figma wraps horizontal auto-layout only. */
  wrap?: boolean;
  /** Gap between wrapped lines (`row-gap`); set only when `wrap` is. */
  counterAxisSpacing?: number;
  primaryAxis: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxis: 'MIN' | 'CENTER' | 'MAX';
}

export interface DropShadowSpec {
  x: number;
  y: number;
  blur: number;
  spread: number;
  inner: boolean;
  color: Paint;
}

interface DesignBase {
  name: string;
  /** Absolute page coordinates — retained for `design.json` debugging even
   * when auto-layout ignores them at import time. */
  rect: Rect;
  opacity: number;
  fills: Paint[];
  stroke?: Paint;
  strokeWeights?: { top: number; right: number; bottom: number; left: number };
  strokeDashed?: boolean;
  cornerRadius?: { tl: number; tr: number; br: number; bl: number };
  effects?: DropShadowSpec[];
}

export interface FrameDesignNode extends DesignBase {
  kind: 'frame';
  /** overflow clips descendants. */
  clipsContent: boolean;
  /** Present when the element was a flex container whose children could all
   * be expressed in flow — see {@link autoLayoutFor}. */
  layout?: AutoLayoutSpec;
  children: DesignNode[];
}

export interface TextDesignNode extends DesignBase {
  kind: 'text';
  characters: string;
  fontFamily: string;
  fontWeight: number;
  fontItalic: boolean;
  fontSize: number;
  /** Undefined means 'auto' (CSS `line-height: normal`). */
  lineHeightPx?: number;
  letterSpacing: number;
  align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  decoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
}

export interface ImageDesignNode extends DesignBase {
  kind: 'image';
  src?: string;
}

/** Replaced content Figma can't reconstruct — kept as a labeled rectangle so
 * the design keeps the footprint instead of silently dropping it. */
export interface RectDesignNode extends DesignBase {
  kind: 'rect';
  /** What the placeholder stands in for: 'svg', 'canvas', 'iframe', ... */
  label: string;
}

export type DesignNode = FrameDesignNode | TextDesignNode | ImageDesignNode | RectDesignNode;

export interface FontSpec {
  family: string;
  weight: number;
  italic: boolean;
}

export interface DesignTreeResult {
  root: FrameDesignNode;
  fonts: FontSpec[];
  stats: {
    elements: number;
    texts: number;
    images: number;
    placeholders: number;
    /** Descendants dropped because they exceeded --max-depth. */
    truncated: number;
  };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

export function px(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Parse `rgb()`/`rgba()`/`#hex` into a normalized Paint; transparent → undefined. */
export function parseColor(value: string | undefined): Paint | undefined {
  if (!value || value === 'transparent') return undefined;
  const m = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a <= 0) return undefined;
    return { r: parseFloat(m[1]) / 255, g: parseFloat(m[2]) / 255, b: parseFloat(m[3]) / 255, a };
  }
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    const hasAlpha = h.length === 8;
    const a = hasAlpha ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    if (a <= 0) return undefined;
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a,
    };
  }
  return undefined;
}

/** First family in a CSS font-family list, quotes stripped. */
export function firstFontFamily(value: string | undefined): string {
  if (!value) return 'Inter';
  const first = value
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '');
  return first || 'Inter';
}

/**
 * Parse the first `box-shadow` layer into a DropShadowSpec.
 * Computed form is `color x y blur spread [inset]`, e.g.
 * `rgba(0,0,0,0.2) 0px 4px 12px 0px`.
 */
export function parseBoxShadow(value: string | undefined): DropShadowSpec | undefined {
  if (!value || value === 'none') return undefined;
  const first = value.split(/,(?![^()]*\))/)[0];
  const inner = /\binset\b/.test(first);
  const cleaned = first.replace(/\binset\b/g, '').trim();
  const m = cleaned.match(/^(.*?)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px)?$/);
  if (!m) return undefined;
  const color = parseColor(m[1]) ?? { r: 0, g: 0, b: 0, a: 0.3 };
  return {
    x: parseFloat(m[2]),
    y: parseFloat(m[3]),
    blur: parseFloat(m[4]),
    spread: m[5] ? parseFloat(m[5]) : 0,
    inner,
    color,
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const PLACEHOLDER_TAGS = new Set(['svg', 'canvas', 'iframe', 'video', 'object', 'embed']);

function layerName(record: RawRecord): string {
  if (record.kind === 'text') {
    const t = (record.text ?? '').trim();
    return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  }
  const tag = record.tag ?? 'el';
  if (record.id) return `${tag}#${record.id}`;
  const cls = record.className?.split(/\s+/)[0];
  if (cls) return `${tag}.${cls}`;
  return tag;
}

/**
 * What a record contributes to the design, judged on the record alone:
 * - `keep`: it becomes a node;
 * - `transparent`: it draws nothing itself but its children may — a
 *   `display: contents` wrapper or a slot (0×0 boxes), or an element wholly
 *   outside the clip rect. Its children are handed to the nearest kept
 *   ancestor (#409);
 * - `cull`: neither it nor anything under it can show.
 */
type Disposition = 'keep' | 'transparent' | 'cull';

function clips(record: RawRecord): boolean {
  const ox = s_over(record, 'overflow-x');
  const oy = s_over(record, 'overflow-y');
  return (ox !== '' && ox !== 'visible') || (oy !== '' && oy !== 'visible');
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function dispositionOf(record: RawRecord, clip: Rect | undefined): Disposition {
  const s = record.styles ?? {};
  if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse')
    return 'cull';
  if (parseFloat(s.opacity ?? '1') <= 0) return 'cull';
  if (record.kind === 'text') {
    if (!(record.text ?? '').trim()) return 'cull';
    if (record.rect.width < 0.5 && record.rect.height < 0.5) return 'cull';
    if (clip && !intersects(record.rect, clip)) return 'cull';
    return 'keep';
  }
  const empty = record.rect.width < 0.5 && record.rect.height < 0.5;
  const outside = clip !== undefined && !intersects(record.rect, clip);
  if (!empty && !outside) return 'keep';
  // A box that clips hides everything outside it, so nothing under an empty
  // or off-screen clipping box can show. A display:contents element has no
  // box, so it never clips.
  if (clips(record) && s.display !== 'contents') return 'cull';
  return 'transparent';
}

function baseFrom(record: RawRecord): DesignBase {
  const s = record.styles ?? {};
  const fills: Paint[] = [];
  const bg = parseColor(s['background-color']);
  if (bg) fills.push(bg);

  const weightKeys = [
    ['border-top-width', 'top'],
    ['border-right-width', 'right'],
    ['border-bottom-width', 'bottom'],
    ['border-left-width', 'left'],
  ] as const;
  let stroke: Paint | undefined;
  const strokeWeights = { top: 0, right: 0, bottom: 0, left: 0 };
  let strokeDashed = false;
  for (const [widthProp, side] of weightKeys) {
    const w = px(s[widthProp]);
    strokeWeights[side] = w;
    if (w > 0 && !stroke) {
      const colorProp = widthProp.replace('width', 'color');
      const styleProp = widthProp.replace('width', 'style');
      stroke = parseColor(s[colorProp]) ?? { r: 0, g: 0, b: 0, a: 1 };
      const style = s[styleProp] ?? 'solid';
      strokeDashed = style === 'dashed' || style === 'dotted';
    }
  }
  if (!stroke || Object.values(strokeWeights).every((w) => w <= 0)) {
    stroke = undefined;
  }

  const tl = px(s['border-top-left-radius']);
  const tr = px(s['border-top-right-radius']);
  const br = px(s['border-bottom-right-radius']);
  const bl = px(s['border-bottom-left-radius']);

  const shadow = parseBoxShadow(s['box-shadow']);

  return {
    name: layerName(record),
    rect: record.rect,
    opacity: Math.min(1, Math.max(0, parseFloat(s.opacity ?? '1') || 1)),
    fills,
    stroke,
    strokeWeights: stroke ? strokeWeights : undefined,
    strokeDashed: stroke && strokeDashed ? true : undefined,
    cornerRadius: tl || tr || br || bl ? { tl, tr, br, bl } : undefined,
    effects: shadow ? [shadow] : undefined,
  };
}

/**
 * Primary-axis alignment. In a reversed flex container `flex-start` is the far
 * end, so with the children emitted in visual order (reversed) the flex-relative
 * keywords swap; `start`/`end`/`left`/`right` are not flex-relative and do not.
 */
function primaryAxisOf(
  justifyContent: string | undefined,
  reversed: boolean
): AutoLayoutSpec['primaryAxis'] {
  switch (justifyContent) {
    case 'center':
      return 'CENTER';
    case 'end':
    case 'right':
      return 'MAX';
    case 'start':
    case 'left':
      return 'MIN';
    case 'flex-end':
      return reversed ? 'MIN' : 'MAX';
    case 'space-between':
    case 'space-around':
    case 'space-evenly':
      return 'SPACE_BETWEEN';
    default:
      return reversed ? 'MAX' : 'MIN';
  }
}

function counterAxisOf(alignItems: string | undefined): AutoLayoutSpec['counterAxis'] {
  switch (alignItems) {
    case 'center':
      return 'CENTER';
    case 'flex-end':
    case 'end':
      return 'MAX';
    default:
      return 'MIN';
  }
}

/**
 * Can this element's children ride Figma auto-layout? Only a flex container
 * whose visible element children all flow normally — no absolute positioning,
 * no per-child margins (auto-layout has no per-child spacing). Grid and
 * everything else falls back to absolute coordinates, which is lossless.
 */
function autoLayoutFor(
  record: RawRecord,
  elementChildren: RawRecord[]
): AutoLayoutSpec | undefined {
  const s = record.styles ?? {};
  if (s.display !== 'flex' && s.display !== 'inline-flex') return undefined;
  for (const child of elementChildren) {
    const cs = child.styles ?? {};
    const pos = cs.position ?? 'static';
    if (pos !== 'static' && pos !== 'relative') return undefined;
    if (
      px(cs['margin-top']) ||
      px(cs['margin-right']) ||
      px(cs['margin-bottom']) ||
      px(cs['margin-left'])
    ) {
      return undefined;
    }
  }
  const direction = s['flex-direction'] || 'row';
  const horizontal = direction.startsWith('row');
  const flexWrap = s['flex-wrap'] || 'nowrap';
  // Figma wraps horizontal auto-layout only, and has no reverse wrap: those
  // keep absolute coordinates, which is lossless.
  if (flexWrap === 'wrap-reverse') return undefined;
  const wrap = flexWrap === 'wrap';
  if (wrap && !horizontal) return undefined;
  return {
    direction: horizontal ? 'HORIZONTAL' : 'VERTICAL',
    paddingTop: px(s['padding-top']),
    paddingRight: px(s['padding-right']),
    paddingBottom: px(s['padding-bottom']),
    paddingLeft: px(s['padding-left']),
    // gap is read on the axis the flow runs along.
    itemSpacing: px(horizontal ? s['column-gap'] : s['row-gap']),
    ...(wrap ? { wrap: true, counterAxisSpacing: px(s['row-gap']) } : {}),
    primaryAxis: primaryAxisOf(s['justify-content'], direction.endsWith('-reverse')),
    counterAxis: counterAxisOf(s['align-items']),
  };
}

function isReversed(record: RawRecord): boolean {
  return (record.styles?.['flex-direction'] ?? '').endsWith('-reverse');
}

function textAlignOf(value: string | undefined): TextDesignNode['align'] {
  switch (value) {
    case 'center':
      return 'CENTER';
    case 'right':
      return 'RIGHT';
    case 'justify':
      return 'JUSTIFIED';
    default:
      return 'LEFT';
  }
}

function decorationOf(value: string | undefined): TextDesignNode['decoration'] {
  if (!value) return 'NONE';
  if (value.includes('underline')) return 'UNDERLINE';
  if (value.includes('line-through')) return 'STRIKETHROUGH';
  return 'NONE';
}

function textNodeFrom(record: RawRecord): TextDesignNode {
  const s = record.styles ?? {};
  const base = baseFrom(record);
  const fontSize = px(s['font-size']) || 16;
  const lineHeight = s['line-height'];
  const lineHeightPx =
    !lineHeight || lineHeight === 'normal'
      ? undefined
      : lineHeight.endsWith('px')
        ? px(lineHeight)
        : parseFloat(lineHeight) * fontSize; // unitless multiplier
  const fills = fillsFromText(record);
  return {
    ...base,
    // Opacity is the parent frame's to apply; a text run has none of its own
    // (#409 — captures before the fix copied it here, doubling it).
    opacity: 1,
    kind: 'text',
    fills,
    characters: record.text ?? '',
    fontFamily: firstFontFamily(s['font-family']),
    fontWeight: parseInt(s['font-weight'] ?? '400', 10) || 400,
    fontItalic: (s['font-style'] ?? 'normal') !== 'normal',
    fontSize,
    lineHeightPx,
    letterSpacing: s['letter-spacing'] === 'normal' ? 0 : px(s['letter-spacing']),
    align: textAlignOf(s['text-align']),
    decoration: decorationOf(s['text-decoration-line']),
  };
}

function fillsFromText(record: RawRecord): Paint[] {
  const color = parseColor(record.styles?.color);
  return color ? [color] : [{ r: 0, g: 0, b: 0, a: 1 }];
}

export interface BuildOptions {
  /** Element nesting beyond this depth is dropped (reported in stats). */
  maxDepth?: number;
  /** Page-coordinate rect to keep: records wholly outside it are culled
   * (`--no-full-page` passes the viewport). */
  clip?: Rect;
}

export const DEFAULT_MAX_DEPTH = 64;

/**
 * Fold flat serializer records into the design tree.
 *
 * Records arrive in document order with `parentIndex` linking children to
 * parents, so a parent is always seen before its children. One pass decides
 * each record's disposition and attaches it to its nearest kept ancestor;
 * child lists come out in source order, elements and text interleaved. The
 * build is linear in the record count (#409: it was quadratic).
 */
export function buildDesignTree(
  records: RawRecord[],
  options: BuildOptions = {}
): DesignTreeResult {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  // owner[i]: the kept record i's subtree hangs from, -1 for top level, -2 when culled.
  const CULLED = -2;
  const owner = new Int32Array(records.length);
  // carry[i]: opacity of the transparent boxes between record i and its owner.
  const carry = new Float64Array(records.length);
  const kept = new Uint8Array(records.length);
  const children = new Map<number, number[]>();
  let rootIndex = -1;

  records.forEach((record, i) => {
    const p = record.parentIndex;
    const valid = p >= 0 && p < i;
    if (valid && owner[p] === CULLED) {
      owner[i] = CULLED;
      return;
    }
    let attachTo = -1;
    let inherited = 1;
    if (valid) {
      if (kept[p]) {
        attachTo = p;
      } else {
        attachTo = owner[p];
        const parentOpacity = parseFloat(records[p].styles?.opacity ?? '1');
        const own = records[p].styles?.display === 'contents' ? 1 : parentOpacity;
        inherited = carry[p] * (Number.isFinite(own) ? own : 1);
      }
    } else if (p !== -1) {
      // A dangling parent link: nothing to hang from.
      owner[i] = CULLED;
      return;
    }

    const disposition = dispositionOf(record, options.clip);
    if (disposition === 'cull') {
      owner[i] = CULLED;
      return;
    }
    owner[i] = attachTo;
    carry[i] = inherited;
    if (disposition === 'transparent') return;

    kept[i] = 1;
    if (attachTo === -1) {
      if (rootIndex === -1 && record.kind === 'element') rootIndex = i;
      return;
    }
    const list = children.get(attachTo);
    if (list) list.push(i);
    else children.set(attachTo, [i]);
  });

  const rootRecord: RawRecord =
    rootIndex === -1
      ? { kind: 'element', parentIndex: -1, tag: 'body', rect: { x: 0, y: 0, width: 0, height: 0 }, styles: {} }
      : records[rootIndex];

  const fonts = new Map<string, FontSpec>();
  const stats = { elements: 0, texts: 0, images: 0, placeholders: 0, truncated: 0 };

  function build(index: number, record: RawRecord, depth: number): DesignNode {
    const inherited = index >= 0 ? carry[index] : 1;
    if (record.kind === 'text') {
      stats.texts += 1;
      const node = textNodeFrom(record);
      node.opacity = inherited;
      const key = `${node.fontFamily}|${node.fontWeight}|${node.fontItalic}`;
      if (!fonts.has(key)) {
        fonts.set(key, {
          family: node.fontFamily,
          weight: node.fontWeight,
          italic: node.fontItalic,
        });
      }
      return node;
    }

    const base = baseFrom(record);
    base.opacity *= inherited;
    const tag = record.tag ?? '';
    if (tag === 'img') {
      stats.images += 1;
      return { ...base, kind: 'image', src: record.src };
    }
    if (PLACEHOLDER_TAGS.has(tag)) {
      stats.placeholders += 1;
      return {
        ...base,
        kind: 'rect',
        label: tag,
        fills: base.fills.length > 0 ? base.fills : [{ r: 0.9, g: 0.9, b: 0.9, a: 1 }],
      };
    }

    stats.elements += 1;
    const kids = index >= 0 ? (children.get(index) ?? []) : [];
    const layout = autoLayoutFor(
      record,
      kids.map((k) => records[k]).filter((k) => k.kind === 'element')
    );

    const built: DesignNode[] = [];
    if (depth >= maxDepth) {
      stats.truncated += kids.length;
    } else {
      for (const k of kids) built.push(build(k, records[k], depth + 1));
      // Auto-layout lays children out in list order; a reversed flex
      // container shows them last-first.
      if (layout && isReversed(record)) built.reverse();
    }

    return {
      ...base,
      kind: 'frame',
      clipsContent: clips(record),
      layout,
      children: built,
    };
  }

  const top = build(rootIndex, rootRecord, 0);
  const root: FrameDesignNode =
    top.kind === 'frame'
      ? top
      : {
          kind: 'frame',
          name: 'page',
          rect: { x: 0, y: 0, width: 0, height: 0 },
          opacity: 1,
          fills: [],
          clipsContent: true,
          children: [top],
        };
  return { root, fonts: [...fonts.values()], stats };
}

function s_over(record: RawRecord, prop: string): string {
  return (record.styles ?? {})[prop] ?? '';
}
