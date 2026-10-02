import { buildDesignTree, parseColor, parseBoxShadow, firstFontFamily, px } from '../design-tree';
import type { RawRecord } from '../design-tree';

const rect = (x = 0, y = 0, width = 100, height = 50) => ({ x, y, width, height });

function el(overrides: Partial<RawRecord>): RawRecord {
  return {
    kind: 'element',
    parentIndex: 0,
    tag: 'div',
    rect: rect(),
    styles: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      'overflow-x': 'visible',
      'overflow-y': 'visible',
    },
    ...overrides,
  };
}

function txt(overrides: Partial<RawRecord>): RawRecord {
  return {
    kind: 'text',
    parentIndex: 0,
    text: 'Hello',
    rect: rect(0, 0, 50, 16),
    styles: {
      color: 'rgb(10, 20, 30)',
      'font-family': '"Inter", sans-serif',
      'font-size': '16px',
      'font-weight': '400',
      'font-style': 'normal',
      'line-height': 'normal',
      'text-align': 'left',
      'letter-spacing': 'normal',
      'text-decoration-line': 'none',
      opacity: '1',
      visibility: 'visible',
    },
    ...overrides,
  };
}

const ROOT = el({ parentIndex: -1, tag: 'body', rect: rect(0, 0, 800, 600) });

describe('parse helpers', () => {
  it('parses rgb/rgba with alpha', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parseColor('rgba(0, 128, 255, 0.5)')).toEqual({ r: 0, g: 128 / 255, b: 1, a: 0.5 });
    expect(parseColor('rgba(0,0,0,0)')).toBeUndefined();
    expect(parseColor('transparent')).toBeUndefined();
  });

  it('parses hex colors', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 2);
  });

  it('parses the first box-shadow layer', () => {
    expect(parseBoxShadow('rgba(0,0,0,0.2) 0px 4px 12px 2px')).toEqual({
      x: 0,
      y: 4,
      blur: 12,
      spread: 2,
      inner: false,
      color: { r: 0, g: 0, b: 0, a: 0.2 },
    });
    expect(parseBoxShadow('none')).toBeUndefined();
    expect(parseBoxShadow('inset rgb(0,0,0) 1px 1px 0px')?.inner).toBe(true);
  });

  it('reads first font family and px values', () => {
    expect(firstFontFamily('"Segoe UI", Roboto, sans-serif')).toBe('Segoe UI');
    expect(firstFontFamily('Inter')).toBe('Inter');
    expect(px('12.5px')).toBe(12.5);
    expect(px('auto')).toBe(0);
  });
});

describe('buildDesignTree', () => {
  it('culls invisible and zero-size records', () => {
    const hidden = el({ styles: { display: 'none' } });
    const zero = el({ rect: rect(0, 0, 0, 0) });
    const shown = el({ id: 'ok' });
    const { root, stats } = buildDesignTree([ROOT, hidden, zero, shown]);
    expect(root.children.map((c) => c.name)).toEqual(['div#ok']);
    expect(stats.elements).toBe(2); // root + shown
  });

  it('maps img to image nodes and svg/canvas to placeholders', () => {
    const img = el({ tag: 'img', src: 'https://x/y.png' });
    const svg = el({ tag: 'svg' });
    const { root, stats } = buildDesignTree([ROOT, img, svg]);
    const kinds = root.children.map((c) => c.kind);
    expect(kinds).toEqual(['image', 'rect']);
    const svgNode = root.children[1];
    expect(svgNode.kind).toBe('rect');
    if (svgNode.kind === 'rect') expect(svgNode.label).toBe('svg');
    expect(stats.images).toBe(1);
    expect(stats.placeholders).toBe(1);
  });

  it('attaches text runs to their parent element and collects fonts', () => {
    const parent = el({});
    const t = txt({ parentIndex: 1 });
    const { root, fonts, stats } = buildDesignTree([ROOT, parent, t]);
    const frame = root.children[0];
    expect(frame.kind).toBe('frame');
    if (frame.kind === 'frame') {
      expect(frame.children[0].kind).toBe('text');
      const tn = frame.children[0];
      if (tn.kind === 'text') {
        expect(tn.characters).toBe('Hello');
        expect(tn.fontFamily).toBe('Inter');
        expect(tn.fontWeight).toBe(400);
      }
    }
    expect(stats.texts).toBe(1);
    expect(fonts).toEqual([{ family: 'Inter', weight: 400, italic: false }]);
  });

  it('marks flex containers with flowing children as auto-layout', () => {
    const flex = el({
      styles: {
        display: 'flex',
        'flex-direction': 'row',
        'justify-content': 'center',
        'align-items': 'flex-end',
        'column-gap': '8px',
        'padding-top': '4px',
        'padding-right': '6px',
        'padding-bottom': '4px',
        'padding-left': '6px',
        'overflow-x': 'visible',
        'overflow-y': 'visible',
      },
    });
    const kidA = el({ parentIndex: 1 });
    const kidB = el({ parentIndex: 1 });
    const { root } = buildDesignTree([ROOT, flex, kidA, kidB]);
    const frame = root.children[0];
    expect(frame.kind).toBe('frame');
    if (frame.kind === 'frame') {
      expect(frame.layout).toEqual({
        direction: 'HORIZONTAL',
        paddingTop: 4,
        paddingRight: 6,
        paddingBottom: 4,
        paddingLeft: 6,
        itemSpacing: 8,
        primaryAxis: 'CENTER',
        counterAxis: 'MAX',
      });
    }
  });

  it('falls back to absolute positioning when a flex child has margins', () => {
    const flex = el({ styles: { display: 'flex' } });
    const margined = el({ parentIndex: 1, styles: { 'margin-left': '10px' } });
    const { root } = buildDesignTree([ROOT, flex, margined]);
    const frame = root.children[0];
    if (frame.kind === 'frame') expect(frame.layout).toBeUndefined();
  });

  it('falls back for absolutely positioned children', () => {
    const flex = el({ styles: { display: 'flex' } });
    const abs = el({ parentIndex: 1, styles: { position: 'absolute' } });
    const { root } = buildDesignTree([ROOT, flex, abs]);
    const frame = root.children[0];
    if (frame.kind === 'frame') expect(frame.layout).toBeUndefined();
  });

  it('drops descendants beyond maxDepth and counts them', () => {
    const a = el({ parentIndex: 0 });
    const b = el({ parentIndex: 1 });
    const c = el({ parentIndex: 2 });
    const { root, stats } = buildDesignTree([ROOT, a, b, c], { maxDepth: 1 });
    const frameA = root.children[0];
    expect(frameA.kind).toBe('frame');
    if (frameA.kind === 'frame') expect(frameA.children).toHaveLength(0);
    expect(stats.truncated).toBe(1);
  });

  it('carries background fills, borders, radii and shadows onto frames', () => {
    const styled = el({
      styles: {
        display: 'block',
        'background-color': 'rgba(255, 0, 0, 0.8)',
        'border-top-width': '2px',
        'border-top-color': 'rgb(0,0,0)',
        'border-top-style': 'dashed',
        'border-top-left-radius': '8px',
        'box-shadow': 'rgba(0,0,0,0.3) 1px 2px 4px 0px',
        'overflow-x': 'hidden',
      },
    });
    const { root } = buildDesignTree([ROOT, styled]);
    const frame = root.children[0];
    expect(frame.fills[0]).toEqual({ r: 1, g: 0, b: 0, a: 0.8 });
    expect(frame.strokeWeights?.top).toBe(2);
    expect(frame.strokeDashed).toBe(true);
    expect(frame.cornerRadius?.tl).toBe(8);
    expect(frame.effects?.[0]).toMatchObject({ x: 1, y: 2, blur: 4, inner: false });
    if (frame.kind === 'frame') expect(frame.clipsContent).toBe(true);
  });
});
