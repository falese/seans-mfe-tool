/**
 * Emits the Figma import bundle for a design tree: a `manifest.json` + a
 * `code.js` a developer drops into Figma desktop (Plugins → Development →
 * Import plugin from manifest) to get real, editable layers — frames, text,
 * fills, strokes, shadows, and auto-layout where the source layout was flex.
 *
 * The emitted `code.js` is a small generic executor driven by data: the tree
 * is flattened here into a preorder op list (`emitFigmaOps`), so all of the
 * mapping logic is unit-testable in Node and the plugin stays one small code
 * path instead of per-node codegen.
 */

import type { DesignNode, FontSpec, FrameDesignNode } from './design-tree';

export interface FigmaOp {
  id: number;
  /** Parent op id; -1 means figma.currentPage. */
  parent: number;
  type: 'frame' | 'text' | 'rect' | 'image';
  name: string;
  /** Absolute page coordinates — the executor subtracts the parent's to get
   * Figma's parent-relative x/y. Meaningless when `flowed`. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** True when the parent uses auto-layout — x/y are then meaningless. */
  flowed: boolean;
  opacity: number;
  fills?: Array<{ r: number; g: number; b: number; a: number }>;
  stroke?: { r: number; g: number; b: number; a: number };
  strokeWeights?: { top: number; right: number; bottom: number; left: number };
  strokeDashed?: boolean;
  cornerRadius?: { tl: number; tr: number; br: number; bl: number };
  effects?: Array<{
    inner: boolean;
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: { r: number; g: number; b: number; a: number };
  }>;
  clips?: boolean;
  layout?: {
    direction: 'HORIZONTAL' | 'VERTICAL';
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    itemSpacing: number;
    primaryAxis: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxis: 'MIN' | 'CENTER' | 'MAX';
  };
  text?: {
    characters: string;
    fontIndex: number;
    fontSize: number;
    lineHeightPx?: number;
    letterSpacing: number;
    align: string;
    decoration: string;
  };
  src?: string;
  label?: string;
}

export interface FigmaFontEntry {
  family: string;
  weight: number;
  italic: boolean;
  /** Ordered style names to try with figma.loadFontAsync — weight naming is
   * font-specific ('Semi Bold' vs 'Semibold'), so the plugin tries the list
   * and falls back to Inter Regular. */
  styles: string[];
}

const WEIGHT_STYLES: Record<number, string[]> = {
  100: ['Thin', 'Regular'],
  200: ['Extra Light', 'Ultra Light', 'Light', 'Regular'],
  300: ['Light', 'Regular'],
  400: ['Regular', 'Normal', 'Book'],
  500: ['Medium', 'Regular'],
  600: ['Semi Bold', 'SemiBold', 'Demi Bold', 'Medium', 'Regular'],
  700: ['Bold', 'Regular'],
  800: ['Extra Bold', 'Ultra Bold', 'Bold', 'Regular'],
  900: ['Black', 'Heavy', 'Bold', 'Regular'],
};

export function fontStyleCandidates(weight: number, italic: boolean): string[] {
  const rounded = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  const base = WEIGHT_STYLES[rounded] ?? WEIGHT_STYLES[400];
  const names = italic ? [...base.map((s) => `${s} Italic`), 'Italic', ...base] : [...base];
  return [...new Set(names)];
}

/**
 * Flatten the tree into creation ops, parents strictly before children so the
 * executor can append as it goes. Children of an auto-layout frame are marked
 * `flowed` and keep no coordinates.
 */
export function emitFigmaOps(
  root: FrameDesignNode,
  fonts: FontSpec[]
): { ops: FigmaOp[]; fonts: FigmaFontEntry[] } {
  const fontEntries: FigmaFontEntry[] = fonts.map((f) => ({
    family: f.family,
    weight: f.weight,
    italic: f.italic,
    styles: fontStyleCandidates(f.weight, f.italic),
  }));
  const fontIndex = new Map(fontEntries.map((f, i) => [`${f.family}|${f.weight}|${f.italic}`, i]));

  const ops: FigmaOp[] = [];
  let nextId = 0;

  function visit(node: DesignNode, parentId: number, flowed: boolean): void {
    const id = nextId++;
    const base = {
      id,
      parent: parentId,
      name: node.name,
      x: node.rect.x,
      y: node.rect.y,
      width: node.rect.width,
      height: node.rect.height,
      flowed,
      opacity: node.opacity,
      fills: node.fills.length > 0 ? node.fills : undefined,
      stroke: node.stroke,
      strokeWeights: node.strokeWeights,
      strokeDashed: node.strokeDashed,
      cornerRadius: node.cornerRadius,
      effects: node.effects?.map((e) => ({
        inner: e.inner,
        x: e.x,
        y: e.y,
        blur: e.blur,
        spread: e.spread,
        color: e.color,
      })),
    };

    if (node.kind === 'text') {
      const key = `${node.fontFamily}|${node.fontWeight}|${node.fontItalic}`;
      ops.push({
        ...base,
        type: 'text',
        text: {
          characters: node.characters,
          fontIndex: fontIndex.get(key) ?? 0,
          fontSize: node.fontSize,
          lineHeightPx: node.lineHeightPx,
          letterSpacing: node.letterSpacing,
          align: node.align,
          decoration: node.decoration,
        },
      });
      return;
    }

    if (node.kind === 'image') {
      ops.push({ ...base, type: 'image', src: node.src });
      return;
    }

    if (node.kind === 'rect') {
      ops.push({ ...base, type: 'rect', label: node.label });
      return;
    }

    ops.push({
      ...base,
      type: 'frame',
      clips: node.clipsContent,
      layout: node.layout,
    });
    const childFlowed = node.layout !== undefined;
    for (const child of node.children) {
      visit(child, id, childFlowed);
    }
  }

  visit(root, -1, false);
  return { ops, fonts: fontEntries };
}

export interface BundleMeta {
  name: string;
  sourceUrl?: string;
}

export function renderPluginBundle(
  root: FrameDesignNode,
  fonts: FontSpec[],
  meta: BundleMeta
): Record<string, string> {
  const { ops, fonts: fontEntries } = emitFigmaOps(root, fonts);

  const manifest = JSON.stringify(
    {
      name: `seans-mfe-tool import — ${meta.name}`,
      api: '1.0.0',
      main: 'code.js',
      editorType: ['figma'],
    },
    null,
    2
  );

  const code = `// Generated by seans-mfe-tool design:export${meta.sourceUrl ? ` from ${meta.sourceUrl}` : ''}.
// Recreates the captured design as editable Figma layers. Do not edit by hand —
// re-run the export to pick up UI changes.
const PAGE_NAME = ${JSON.stringify(meta.name)};
const OPS = ${JSON.stringify(ops)};
const FONTS = ${JSON.stringify(fontEntries)};
// Ops carry absolute page coordinates; Figma wants parent-relative, so the
// executor subtracts. Root's parent is the page — treated as origin 0,0.
const BY_ID = new Map(OPS.map((o) => [o.id, o]));

function toPaints(paints) {
  if (!paints || paints.length === 0) return [];
  return paints.map((p) => ({ type: 'SOLID', color: { r: p.r, g: p.g, b: p.b }, opacity: p.a }));
}

async function resolveFont(spec) {
  for (const style of spec.styles) {
    try {
      await figma.loadFontAsync({ family: spec.family, style });
      return { family: spec.family, style };
    } catch (e) { /* try the next candidate */ }
  }
  for (const family of ['Inter', 'Roboto', 'Arial']) {
    try {
      await figma.loadFontAsync({ family, style: 'Regular' });
      return { family, style: 'Regular' };
    } catch (e) { /* try the next fallback */ }
  }
  const err = new Error('No usable font found (tried ' + spec.family + ' and fallbacks)');
  throw err;
}

async function applyImageFill(node, src) {
  if (!src) return;
  try {
    const image = await figma.createImageAsync(src);
    node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
  } catch (e) {
    // Unreachable URL (localhost, auth-gated CDN): keep a placeholder fill so
    // the layer still exists at the right footprint.
    node.fills = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.9 }, opacity: 1 }];
  }
}

async function main() {
  const nodes = new Map();
  for (const op of OPS) {
    const parent = op.parent === -1 ? figma.currentPage : nodes.get(op.parent);
    let node;
    if (op.type === 'text') {
      node = figma.createText();
      const t = op.text;
      node.fontName = await resolveFont(FONTS[t.fontIndex]);
      node.characters = t.characters;
      node.fontSize = t.fontSize;
      if (t.lineHeightPx) node.lineHeight = { unit: 'PIXELS', value: t.lineHeightPx };
      if (t.letterSpacing) node.letterSpacing = { unit: 'PIXELS', value: t.letterSpacing };
      node.textAlignHorizontal = t.align;
      if (t.decoration && t.decoration !== 'NONE') node.textDecoration = t.decoration;
    } else if (op.type === 'frame') {
      node = figma.createFrame();
      node.clipsContent = !!op.clips;
      if (op.layout) {
        node.layoutMode = op.layout.direction;
        node.paddingTop = op.layout.paddingTop;
        node.paddingRight = op.layout.paddingRight;
        node.paddingBottom = op.layout.paddingBottom;
        node.paddingLeft = op.layout.paddingLeft;
        node.itemSpacing = op.layout.itemSpacing;
        node.primaryAxisAlignItems = op.layout.primaryAxis;
        node.counterAxisAlignItems = op.layout.counterAxis;
      }
    } else {
      // 'rect' (placeholder) and 'image' both materialize as rectangles.
      node = figma.createRectangle();
    }

    node.name = op.label ? op.name + ' (' + op.label + ')' : op.name;
    node.resize(Math.max(op.width, 0.01), Math.max(op.height, 0.01));
    parent.appendChild(node);
    if (!op.flowed) {
      const parentOp = op.parent === -1 ? undefined : BY_ID.get(op.parent);
      node.x = op.x - (parentOp ? parentOp.x : 0);
      node.y = op.y - (parentOp ? parentOp.y : 0);
    }
    node.opacity = op.opacity;
    node.fills = toPaints(op.fills);
    if (op.type === 'rect' && node.fills.length === 0) {
      node.fills = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.9 }, opacity: 1 }];
    }
    if (op.type === 'image') await applyImageFill(node, op.src);
    if (op.stroke && op.strokeWeights) {
      node.strokes = [{ type: 'SOLID', color: { r: op.stroke.r, g: op.stroke.g, b: op.stroke.b }, opacity: op.stroke.a }];
      if (node.type === 'FRAME' || node.type === 'RECTANGLE') {
        node.strokeTopWeight = op.strokeWeights.top;
        node.strokeRightWeight = op.strokeWeights.right;
        node.strokeBottomWeight = op.strokeWeights.bottom;
        node.strokeLeftWeight = op.strokeWeights.left;
      } else {
        node.strokeWeight = Math.max(op.strokeWeights.top, op.strokeWeights.right, op.strokeWeights.bottom, op.strokeWeights.left);
      }
      if (op.strokeDashed) node.dashPattern = [4, 4];
    }
    if (op.cornerRadius && node.type !== 'TEXT') {
      node.topLeftRadius = op.cornerRadius.tl;
      node.topRightRadius = op.cornerRadius.tr;
      node.bottomRightRadius = op.cornerRadius.br;
      node.bottomLeftRadius = op.cornerRadius.bl;
    }
    if (op.effects && node.type !== 'TEXT') {
      node.effects = op.effects.map((e) => ({
        type: e.inner ? 'INNER_SHADOW' : 'DROP_SHADOW',
        color: { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a },
        offset: { x: e.x, y: e.y },
        radius: e.blur,
        spread: e.spread,
        visible: true,
        blendMode: 'NORMAL',
      }));
    }
    nodes.set(op.id, node);
  }
  const root = nodes.get(0);
  if (root) figma.viewport.scrollAndZoomIntoView([root]);
  figma.closePlugin('Imported ' + OPS.length + ' layers as "' + PAGE_NAME + '"');
}

main().catch((e) => {
  console.error(e);
  figma.closePlugin('Import failed: ' + e.message);
});
`;

  const readme = `# Figma import — ${meta.name}

Generated by \`seans-mfe-tool design:export\`${meta.sourceUrl ? ` from \`${meta.sourceUrl}\`` : ''}.

## Use it

1. Open **Figma desktop** (the plugin API needs the desktop app or a browser with the Figma agent).
2. **Plugins → Development → Import plugin from manifest…** and pick \`manifest.json\` in this directory.
3. Run the plugin (**Plugins → Development → seans-mfe-tool import — ${meta.name}**).
4. The captured design lands on the canvas as editable layers — frames, text,
   fills, strokes, and auto-layout where the source layout was flex.

## Fidelity notes (POC)

- Flex containers become real auto-layout frames only when every child flows
  (no margins, no absolute positioning); everything else uses absolute
  coordinates — lossless, but less editable.
- Images fill from their source URL when Figma can reach it; otherwise they
  render as gray placeholders (localhost URLs won't resolve inside Figma).
- \`svg\`/\`canvas\`/\`iframe\`/\`video\` are placeholder rectangles.
- CSS gradients and multi-layer backgrounds are flattened to the background
  color; only the first \`box-shadow\` layer is kept.
- Fonts resolve by name against Figma's font list with sensible fallbacks —
  a family Figma doesn't have comes in as Inter.

\`../design.json\` is the normalized design tree the plugin consumed;
\`../screenshot.png\` is the reference render of the captured page.
`;

  return {
    'manifest.json': `${manifest}\n`,
    'code.js': code,
    'README.md': readme,
  };
}
